"""Mise as an assistant: say or type what you need and it does the admin.

One box (frontend/src/assistant.jsx). The owner types, or records their voice (transcribed by a speech service, see
/assistant/transcribe), and Claude turns it into things in the app: to-dos (business or personal), notes, draft invoices,
pencilled-in jobs, blocked-out time, shop / prep times, shopping items, and answers about the week and the money.

Rules of the road:
  * Nothing here ever reaches a client. Drafts are drafts; sending an invoice, a receipt or a message stays the owner's tap.
  * Everything it creates is reported back as a card with an undo (POST /assistant/undo).
  * Inert until ANTHROPIC_API_KEY is set (503 with a plain message), like every other Mise feature. Elite plan, owner only.

Each request carries a fresh, compact picture of the business (context_text) so the model can use real ids and dates.
"""
import difflib
import json
import logging
import urllib.error
import urllib.request
import uuid
from datetime import date as _date, datetime, timedelta

import anthropic
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import config, ratelimit
from ..auth import require_plan
from ..database import get_db
from ..models import Booking, Client, DiaryBlock, Idea, Invoice, ShoppingList, Task, User
from ..utils import effective_doc_format, next_doc_seq, render_doc_number, ws_id
from . import today as today_mod
from .today import local_now, local_today, money, pretty_day, pretty_time

log = logging.getLogger("creatiste.assistant")
router = APIRouter(prefix="/assistant", tags=["assistant"])

TASK_CATEGORIES = ("prep", "shopping", "admin", "service", "logistics", "other")
MAX_ROUNDS = 3
MAX_TEXT = 6000

SYSTEM = """You are Mise, the assistant inside The Creatiste Command, the app a chef or caterer uses to run their business. The person talking to you is the business owner, usually on their phone and often dictating by voice between jobs. Your job is to take things off their mind: turn what they say into to-dos, notes, calendar entries and draft invoices in the app, and answer questions about their week and their money from the business details you are given.

How to work
- Every request comes with a fresh picture of the business: today's date, their services and packages, their clients, the next three weeks of the diary, open to-dos, unpaid invoices and what is waiting for them. Treat it as the truth about the app right now, and use the ids in it when you call a tool.
- Act straight away when the request is clear. Use the tools, several at once when needed: a brain dump is usually one add_todos call with many items, plus any other tools it needs. Do not ask for confirmation first. Everything you create is a draft or can be undone with one tap, and nothing you do reaches a client: sending an invoice, a receipt or a message is always the owner's own tap in the app, never yours.
- Ask one short question instead of guessing only when something essential is missing, or when two readings would give different results: which of two clients with the same first name, or an invoice with no price and nothing earlier to copy.
- Voice dictation mishears names. If a name is not in the client list but one in the list sounds very like it (Eva for Iva), use the one in the list and say which you used. The same goes for service and package names.
- Dates: the diary lists every day with its date, so read dates off it. "Tuesday" means the next Tuesday coming; "next week Tuesday" means the Tuesday of next week. Give dates to tools as YYYY-MM-DD and times as 24-hour HH:MM. If no time was given, leave the time out.
- To-dos: one to-do for each separate thing to do, short, starting with the action ("Call the bank", "Book the MOT"). Anything about the business (clients, suppliers, invoices, the kitchen) goes in the business list; everything else (family, home, health, errands) goes in the personal list. Give a due date only when one was said or clearly implied. A thought or idea that is not an action (a menu idea, something to remember about a client) is a note: use save_note.
- Invoices: draft_invoice creates a draft and puts the job on the calendar. Prices come from what the owner says, or, when they say "same as last time" or give no price for a client who has been invoiced before, from that client's last invoice (set copy_last). Never invent a price. When the owner says a client has paid, use mark_invoice_paid on the matching unpaid invoice; if more than one could match, ask which.
- The diary: every job's shop and prep steps sit on a suggested day until the owner gives them a day or a time; use plan_step for "shop for Rita on Monday at 8". Use move_job to move a job's day or set its time on the day, block_time for time they are not available, and pencil_in to hold a day for a client before there is an invoice.
- Questions ("what's on this week", "who hasn't paid", "what did I charge Rita last time") are answered from the business details; call client_history when you need a client's past invoices. If the answer is not in what you have, say so plainly.
- "Chase" or "remind" someone about money: write the message with draft_message, one per client. The owner sends it themselves.
- Things you cannot do here (confirm or decline a date request, send or email anything, mark a website order as paid, delete records, change settings): say in one sentence where in the app to do it. Date requests are answered at the top of the Calendar.

How to reply
- The app shows a card under your reply for each thing you did, with the details and an undo. So keep your own words short: one or two plain sentences, written before your tool calls as if they will work ("Done, those are on your list."). If a tool then reports a problem you will be told, and you can say what happened and what you need.
- Do not repeat what the cards already show, and do not use headings, bullet lists or markdown. For a question, answer in a few plain sentences.
- Write the way a capable assistant speaks to a busy owner: direct and warm, British English, pounds."""


def _props(**p) -> dict:
    return p


S = {"type": "string"}
I = {"type": "integer"}  # noqa: E741
N = {"type": "number"}
B = {"type": "boolean"}
DATE = {"type": "string", "description": "YYYY-MM-DD"}
TIME = {"type": "string", "description": "24-hour HH:MM"}

TOOLS = [
    {"name": "add_todos", "description": "Add one or more to-dos to the owner's lists. Use for anything they need to do, at work or in their own life.",
     "input_schema": {"type": "object", "required": ["todos"], "properties": _props(todos={
         "type": "array", "items": {"type": "object", "required": ["title", "list"], "properties": _props(
             title={"type": "string", "description": "Short, starting with the action"},
             list={"type": "string", "enum": ["business", "personal"]},
             due_date=DATE, due_time=TIME,
             priority={"type": "string", "enum": ["low", "medium", "high"]},
             notes={"type": "string", "description": "Any extra detail they gave"})}})}},
    {"name": "complete_todos", "description": "Tick off to-dos the owner says are done. Use the ids from OPEN TO-DOS.",
     "input_schema": {"type": "object", "required": ["ids"], "properties": _props(ids={"type": "array", "items": I})}},
    {"name": "update_todo", "description": "Change a to-do: its wording, its date or time (an empty string clears it), or which list it is on.",
     "input_schema": {"type": "object", "required": ["id"], "properties": _props(
         id=I, title=S, due_date=DATE, due_time=TIME, list={"type": "string", "enum": ["business", "personal"]})}},
    {"name": "save_note", "description": "Save a thought, idea or something to remember that is not an action, to the owner's notes (My Brain).",
     "input_schema": {"type": "object", "required": ["title", "text"], "properties": _props(title=S, text=S)}},
    {"name": "add_client", "description": "Add a new client. Only when the owner asks, or confirms someone is new.",
     "input_schema": {"type": "object", "required": ["name"], "properties": _props(
         name=S, email=S, phone=S, regular={"type": "boolean", "description": "Already consulted: may book dates ahead on the website"})}},
    {"name": "draft_invoice", "description": "Create a draft invoice for a client. With a service day it also puts the job on the calendar with its shop and prep. Nothing is sent.",
     "input_schema": {"type": "object", "properties": _props(
         client_id={"type": "integer", "description": "From CLIENTS. Preferred."},
         client_name={"type": "string", "description": "Only when the id is not known"},
         service={"type": "string", "description": "One of SERVICES, as written there"},
         package={"type": "string", "description": "One of that service's packages, if they named one"},
         service_date={"type": "string", "description": "The day the work happens (first day for a package), YYYY-MM-DD"},
         service_days={"type": "array", "items": DATE, "description": "Every day, only when they named the days of a package covering several days"},
         time={"type": "string", "description": "Start time on the day, 24-hour HH:MM"},
         items={"type": "array", "description": "The lines to charge, with the prices the owner said", "items": {
             "type": "object", "required": ["description", "unit_price"], "properties": _props(description=S, quantity=N, unit_price=N)}},
         copy_last={"type": "boolean", "description": "Copy the lines and terms from this client's last invoice"},
         notes=S)}},
    {"name": "mark_invoice_paid", "description": "Mark an unpaid invoice as paid today (the owner said the money arrived). No email is sent.",
     "input_schema": {"type": "object", "required": ["invoice_id"], "properties": _props(invoice_id=I)}},
    {"name": "pencil_in", "description": "Hold a day for a client before there is an invoice. It goes on the calendar and closes that time on the website.",
     "input_schema": {"type": "object", "required": ["service", "date"], "properties": _props(
         client_id=I, client_name=S, service=S, date=DATE, time=TIME, note=S)}},
    {"name": "block_time", "description": "Block out time the owner is not available for work (an appointment, a day off, a holiday).",
     "input_schema": {"type": "object", "required": ["title", "date"], "properties": _props(
         title=S, date=DATE, end_date={"type": "string", "description": "Last day, for several days off in a row, YYYY-MM-DD"},
         start_time=TIME, end_time=TIME)}},
    {"name": "plan_step", "description": "Give a job's shop, prep or other step its day and, if said, its time. Use the job id from the DIARY.",
     "input_schema": {"type": "object", "required": ["job_id", "step", "day"], "properties": _props(
         job_id=I, step={"type": "string", "description": "shop, prep, or the step's name"}, day=DATE, time=TIME)}},
    {"name": "move_job", "description": "Move a job to another day and/or set its time on the day. Use the job id from the DIARY.",
     "input_schema": {"type": "object", "required": ["job_id"], "properties": _props(job_id=I, date=DATE, time=TIME)}},
    {"name": "add_shopping_items", "description": "Add items to a shopping list: an open one (by id from SHOPPING LISTS) or a new one.",
     "input_schema": {"type": "object", "required": ["items"], "properties": _props(
         list_id=I, new_list_title=S, shop_date=DATE,
         items={"type": "array", "items": {"type": "object", "required": ["name"], "properties": _props(
             name=S, quantity=N, unit=S, shop=S)}})}},
    {"name": "client_history", "description": "Look up a client's recent invoices (lines, prices, dates) and what they have coming up.",
     "input_schema": {"type": "object", "properties": _props(client_id=I, client_name=S)}},
    {"name": "draft_message", "description": "Write a message for the owner to send to a client themselves by WhatsApp or email (a payment reminder, a confirmation).",
     "input_schema": {"type": "object", "required": ["text"], "properties": _props(client_id=I, client_name=S, subject=S, text=S)}},
]


# ───────────────────────────── availability ─────────────────────────────
def transcribe_provider() -> str:
    if config.ELEVENLABS_API_KEY:
        return "elevenlabs"
    if config.OPENAI_API_KEY:
        return "openai"
    return ""


def status_for(user: User) -> dict:
    """What this login can use: the assistant itself (Elite, owner, AI key set) and voice dictation (a speech key set)."""
    plan_ok = user.role == "admin" or user.workspace_plan_level >= 3
    on = bool(config.ANTHROPIC_API_KEY) and plan_ok and user.role != "staff"
    why = ""
    if user.role == "staff":
        why = "staff"
    elif not plan_ok:
        why = "plan"
    elif not config.ANTHROPIC_API_KEY:
        why = "off"
    return {"enabled": on, "voice": on and bool(transcribe_provider()), "why": why, "name": "Mise"}


@router.get("/status")
def status(user: User = Depends(require_plan(1))):
    return status_for(user)


def _gate(user: User) -> None:
    if user.role == "staff":
        raise HTTPException(403, "The assistant is for the business owner.")
    if not (user.role == "admin" or user.workspace_plan_level >= 3):
        raise HTTPException(403, "The assistant is part of the Elite Kitchen plan. Upgrade in Settings to switch it on.")
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(503, "The assistant isn't switched on yet. It needs the AI key set on the server.")


# ───────────────────────────── the picture of the business ─────────────────────────────
def _d(iso: str) -> str:
    try:
        d = _date.fromisoformat(iso[:10])
        return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"
    except ValueError:
        return iso or ""


def context_text(db: Session, owner: User, user: User) -> str:
    from .diary import rules_for
    from .jobs import calendar_days, setup_for

    now = local_now()
    today = now.date()
    setup = setup_for(db, owner)
    rules = rules_for(owner)
    wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    out = [f"TODAY: {today.strftime('%A')} {today.day} {today.strftime('%B %Y')} ({today.isoformat()}), {now.strftime('%H:%M')} UK time",
           f"BUSINESS: {owner.business_name or owner.name or 'the business'}",
           "WORKING DAYS: " + " ".join(wd[i] for i in rules["work_days"])]

    out.append("\nSERVICES (name · how it runs · packages):")
    kinds = {"sameday": "same-day orders", "delivered": "meal prep, delivered", "inhome": "in-home cooking", "event": "events and catering", "other": "other"}
    for s in setup["services"]:
        line = f"- {s['name']} · {kinds.get(s['category'], s['category'])}"
        if s.get("packages"):
            line += " · packages: " + "; ".join(f"{p['name']} ({p['days']} day{'s' if p['days'] != 1 else ''} a week, {p['hours']:g}h a day)" for p in s["packages"])
        out.append(line)

    clients = db.query(Client).filter(Client.user_id == owner.id).order_by(Client.name.asc()).limit(400).all()
    out.append("\nCLIENTS (id · name):")
    for c in clients:
        bits = [str(c.id), c.name]
        if c.company:
            bits.append(c.company)
        if not c.email and not c.phone:
            bits.append("no contact details")
        out.append("- " + " · ".join(bits))
    if not clients:
        out.append("- none yet")

    cal = calendar_days(db, owner, today, today + timedelta(days=20), today=today)
    out.append("\nDIARY, the next three weeks (job ids in brackets; steps marked 'suggested day' have not been given a day by the owner yet):")
    for day in cal["days"]:
        d = _date.fromisoformat(day["date"])
        head = f"{d.strftime('%a')} {d.day} {d.strftime('%b')} = {day['date']}" + (" (today)" if d == today else "") + ("" if day["workday"] else " (not a working day)")
        parts = []
        for e in day["entries"]:
            t = f" {e['time']}" + (f"-{e['end']}" if e.get("end") else "") if e.get("time") else ""
            if e["kind"] == "day":
                parts.append(f"{e['label']} · {e['who']} · {e['sub']}{t} [job {e['job_id']}]")
            elif e["kind"] in ("shop", "prep", "custom"):
                parts.append(f"{e['label']} for {e['who']}{t}{' (suggested day)' if e.get('auto') else ''} [job {e['job_id']}, for {e['job_date']}]")
            elif e["kind"] == "held":
                parts.append(f"Held for {e['who']} ({e['sub'].lower()})")
            elif e["kind"] == "todo":
                if not e.get("done"):
                    parts.append(f"To-do{' (overdue)' if e.get('overdue') else ''}: {e['who']}{t} [to-do {e['task_id']}]")
            else:
                parts.append(f"Not available: {e['who']}{t or ' all day'}")
        out.append(f"{head}: " + ("; ".join(parts) if parts else "free"))

    tasks = db.query(Task).filter(Task.user_id == owner.id, Task.status != "done").order_by(Task.due_date.asc()).limit(120).all()
    out.append("\nOPEN TO-DOS (id · list · due · title):")
    for t in tasks:
        due = (f"{_d(t.due_date)} {t.due_time}".strip() if t.due_date else "no date")
        out.append(f"- {t.id} · {'personal' if (t.category or '') == 'personal' else 'business'} · {due} · {t.title}")
    if not tasks:
        out.append("- none")

    unpaid = today_mod.unpaid_invoices(db, owner.id, today)
    out.append("\nUNPAID INVOICES (id · number · client · total · status · sent · due):")
    for i in unpaid[:60]:
        out.append(f"- {i['id']} · {i['number']} · {i['client'] or 'no client'} · {money(i['total'], owner)} · {i['status']} · "
                   f"{_d(i['issue_date']) or '?'} · {_d(i['due_date']) or 'no due date'}")
    if not unpaid:
        out.append("- none")
    names = {c.id: c.name for c in clients}
    drafts = db.query(Invoice).filter(Invoice.user_id == owner.id, Invoice.status == "draft").order_by(Invoice.id.desc()).limit(20).all()
    if drafts:
        out.append("DRAFT INVOICES, not sent yet (id · number · client · total):")
        for inv in drafts:
            out.append(f"- {inv.id} · {inv.number} · {names.get(inv.client_id, 'no client')} · {money(today_mod._invoice_total(inv), owner)}")

    waiting = today_mod.needs(db, owner, today)
    out.append("\nWAITING FOR THE OWNER:")
    for n in waiting:
        out.append(f"- {n['text']}. {n['sub']}")
    if not waiting:
        out.append("- nothing")

    lists = db.query(ShoppingList).filter(ShoppingList.user_id == owner.id, ShoppingList.status == "open").order_by(ShoppingList.shop_date.asc()).limit(15).all()
    out.append("\nSHOPPING LISTS, open (id · title · date · items):")
    for sl in lists:
        out.append(f"- {sl.id} · {sl.title} · {_d(sl.shop_date) or 'no date'} · {len(sl.items or [])} items")
    if not lists:
        out.append("- none")
    return "\n".join(out)


# ───────────────────────────── small helpers ─────────────────────────────
class ToolError(Exception):
    """Something the model (and then the owner) should be told about in plain words."""


def _day(v, *, required: bool = False, field: str = "date") -> str:
    v = str(v or "").strip()[:10]
    if not v:
        if required:
            raise ToolError(f"I need the {field}.")
        return ""
    try:
        _date.fromisoformat(v)
    except ValueError:
        raise ToolError(f"'{v}' is not a date I can use (YYYY-MM-DD).")
    return v


def _time(v) -> str:
    v = str(v or "").strip()
    if not v:
        return ""
    try:
        h, m = v.split(":")[:2]
        h, m = int(h), int(m)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return f"{h:02d}:{m:02d}"
    except ValueError:
        pass
    raise ToolError(f"'{v}' is not a time I can use (HH:MM).")


def _when(day: str, t: str = "", today: _date | None = None) -> str:
    if not day:
        return ""
    return pretty_day(day, today) + (f", {pretty_time(t)}" if t else "")


def find_client(db: Session, uid: int, client_id=None, name: str = "") -> Client:
    """The client the model means: by id when given, else by name (exact, then first name, then a close spelling)."""
    if client_id:
        try:
            c = db.get(Client, int(client_id))
        except (TypeError, ValueError):
            c = None
        if c and c.user_id == uid:
            return c
    name = (name or "").strip()
    if not name:
        raise ToolError("Which client is this for?")
    rows = db.query(Client).filter(Client.user_id == uid).all()
    low = name.lower()
    exact = [c for c in rows if c.name.lower() == low]
    if len(exact) == 1:
        return exact[0]
    first = exact or ([c for c in rows if c.name.lower().split()[:1] == [low]] if len(low.split()) == 1 else [])
    if len(first) == 1:
        return first[0]
    if len(first) > 1:
        raise ToolError(f"More than one client matches '{name}': {', '.join(c.name for c in first[:6])}. Ask which one.")
    part = [c for c in rows if low in c.name.lower()]
    if len(part) == 1:
        return part[0]
    close = difflib.get_close_matches(low, [c.name.lower() for c in rows], n=3, cutoff=0.75)
    if len(close) == 1:
        return next(c for c in rows if c.name.lower() == close[0])
    hint = f" The closest are: {', '.join(c.name for c in rows if c.name.lower() in close)}." if close else ""
    raise ToolError(f"There is no client called '{name}'.{hint} Ask whether to add them as a new client, or which client they meant.")


def _service(setup: dict, name: str) -> dict | None:
    from .jobs import match_service

    name = (name or "").strip()
    if not name:
        return None
    svc = match_service(setup["services"], name)
    if svc:
        return svc
    close = difflib.get_close_matches(name.lower(), [s["name"].lower() for s in setup["services"]], n=1, cutoff=0.7)
    return next((s for s in setup["services"] if s["name"].lower() == close[0]), None) if close else None


def _fit_note(db: Session, user: User, day: str, service: str) -> str:
    """A plain warning when the day is already full or not a working day (the owner can still go ahead)."""
    try:
        from .diary import check_slot

        r = check_slot(day, service, 0, db, user)
        return "" if r["fits"] else r["message"]
    except Exception:
        return ""


def card(kind: str, title: str, lines: list[str] | None = None, **extra) -> dict:
    return {"id": uuid.uuid4().hex[:10], "kind": kind, "title": title, "lines": [x for x in (lines or []) if x], **extra}


# ───────────────────────────── the tools ─────────────────────────────
def t_add_todos(db, owner, user, a, today):
    made, lines, skipped = [], [], []
    open_titles = {t.title.strip().lower() for t in db.query(Task).filter(Task.user_id == owner.id, Task.status != "done").all()}
    for raw in (a.get("todos") or [])[:40]:
        title = str((raw or {}).get("title") or "").strip()[:300]
        if not title:
            continue
        if title.lower() in open_titles:
            skipped.append(title)
            continue
        personal = (raw.get("list") or "business") == "personal"
        due = t = ""
        try:
            due = _day(raw.get("due_date"))
            t = _time(raw.get("due_time"))
        except ToolError:
            pass
        pr = raw.get("priority") if raw.get("priority") in ("low", "medium", "high") else ""
        task = Task(user_id=owner.id, title=title, description=str(raw.get("notes") or "").strip()[:2000],
                    category="personal" if personal else "admin", priority=pr, status="todo", due_date=due, due_time=t if due else "")
        db.add(task)
        made.append(task)
        open_titles.add(title.lower())
        lines.append(" · ".join(x for x in [title, _when(due, t if due else "", today), "Personal" if personal else ""] if x))
    db.flush()
    if not made and not skipped:
        raise ToolError("There was nothing to add.")
    lines += [f"{s} (already on your list)" for s in skipped]
    n = len(made)
    title = f"Added {n} to-do{'s' if n != 1 else ''}" if n else "Already on your list"
    return {"card": card("todos", title, lines, link={"to": "/app/tasks", "label": "Open to-dos"},
                         undo={"kind": "tasks", "ids": [t.id for t in made]} if made else None),
            "data": f"Added {n}." + (f" Already there: {', '.join(skipped)}." if skipped else "")}


def _own_tasks(db, owner, ids) -> list[Task]:
    out = []
    for i in (ids or [])[:40]:
        try:
            t = db.get(Task, int(i))
        except (TypeError, ValueError):
            t = None
        if t and t.user_id == owner.id:
            out.append(t)
    return out


def t_complete_todos(db, owner, user, a, today):
    tasks = [t for t in _own_tasks(db, owner, a.get("ids")) if t.status != "done"]
    if not tasks:
        raise ToolError("I couldn't find that to-do among the open ones.")
    for t in tasks:
        t.status = "done"
        t.completed_at = datetime.utcnow()
    return {"card": card("done", f"Ticked off {len(tasks)}" if len(tasks) > 1 else "Ticked off", [t.title for t in tasks],
                         undo={"kind": "tasks_reopen", "ids": [t.id for t in tasks]}), "data": "Done."}


def t_update_todo(db, owner, user, a, today):
    tasks = _own_tasks(db, owner, [a.get("id")])
    if not tasks:
        raise ToolError("I couldn't find that to-do.")
    t = tasks[0]
    before = {"title": t.title, "due_date": t.due_date, "due_time": t.due_time, "category": t.category}
    if a.get("title"):
        t.title = str(a["title"]).strip()[:300]
    if "due_date" in a:
        t.due_date = _day(a.get("due_date"))
        if not t.due_date:
            t.due_time = ""
    if "due_time" in a:
        t.due_time = _time(a.get("due_time")) if t.due_date else ""
    if a.get("list") in ("business", "personal"):
        if a["list"] == "personal":
            t.category = "personal"
        elif (t.category or "") == "personal":
            t.category = "admin"
    t.due_reminder_for = ""
    return {"card": card("todos", "Updated to-do", [" · ".join(x for x in [t.title, _when(t.due_date, t.due_time, today) or "no date",
                                                                                "Personal" if t.category == "personal" else ""] if x)],
                         undo={"kind": "task_update", "id": t.id, "before": before}), "data": "Updated."}


def t_save_note(db, owner, user, a, today):
    title = str(a.get("title") or "").strip()[:200]
    text = str(a.get("text") or "").strip()[:8000]
    if not title and not text:
        raise ToolError("There was nothing to save.")
    idea = Idea(user_id=owner.id, title=title or text[:60], content=text, tags=["mise"])
    db.add(idea)
    db.flush()
    return {"card": card("note", "Saved to My Brain", [idea.title], link={"to": "/app/ideas", "label": "Open My Brain"},
                         undo={"kind": "note", "id": idea.id}), "data": "Saved."}


def t_add_client(db, owner, user, a, today):
    name = str(a.get("name") or "").strip()[:160]
    if not name:
        raise ToolError("I need the client's name.")
    email = str(a.get("email") or "").strip().lower()[:255]
    rows = db.query(Client).filter(Client.user_id == owner.id).all()
    existing = next((c for c in rows if c.name.lower() == name.lower() or (email and (c.email or "").lower() == email)), None)
    if existing:
        return {"card": card("client", "Already a client", [existing.name], link={"to": "/app/clients", "label": "Open clients"}),
                "data": f"{existing.name} is already a client (id {existing.id})."}
    c = Client(user_id=owner.id, name=name, email=email, phone=str(a.get("phone") or "").strip()[:40], regular=bool(a.get("regular")))
    db.add(c)
    db.flush()
    return {"card": card("client", "New client added", [" · ".join(x for x in [c.name, c.email, c.phone, "Regular" if c.regular else ""] if x)],
                         link={"to": "/app/clients", "label": "Open clients"}, undo={"kind": "client", "id": c.id}),
            "data": f"Added {c.name} (id {c.id})."}


def _last_invoice(db, uid: int, client_id: int, service: str = "") -> Invoice | None:
    """The client's most recent invoice with lines on it: for that service when one is named, else any."""
    rows = (db.query(Invoice).filter(Invoice.user_id == uid, Invoice.client_id == client_id, Invoice.status != "void")
            .order_by(Invoice.id.desc()).limit(30).all())
    rows = [r for r in rows if any(not i.get("section") for i in (r.items or []))]
    if service:
        rows = [r for r in rows if (r.service_type or "").lower() == service.lower()]
    return rows[0] if rows else None


def _package_days(first: str, n: int, work_days: list[int]) -> list[str]:
    """The days a package covering several days a week lands on: Mon/Wed/Fri (or Mon to Fri) for a week starting on a Monday,
    as the invoice editor picks them; from any other day, the next working days in a row."""
    d = _date.fromisoformat(first)
    if d.weekday() == 0:
        idx = [0, 2, 4] if n == 3 else list(range(min(n, 7)))
        return [(d + timedelta(days=i)).isoformat() for i in idx]
    out = []
    while len(out) < n and len(out) < 7:
        if d.weekday() in work_days or not work_days:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def t_draft_invoice(db, owner, user, a, today):
    from .diary import rules_for
    from .finance import invoice_total, sync_booking
    from .jobs import package_of, setup_for

    client = find_client(db, owner.id, a.get("client_id"), a.get("client_name") or "")
    setup = setup_for(db, owner)
    svc = _service(setup, a.get("service") or "")
    service_name = svc["name"] if svc else str(a.get("service") or "").strip()[:80]

    pkg = None
    pkg_name = str(a.get("package") or "").strip()
    if pkg_name:
        pkg = package_of(svc, pkg_name) if svc else None
        if not pkg and svc and svc.get("packages"):
            close = difflib.get_close_matches(pkg_name.lower(), [p["name"].lower() for p in svc["packages"]], n=1, cutoff=0.6)
            pkg = next((p for p in svc["packages"] if p["name"].lower() == close[0]), None) if close else None
        if not pkg:
            names = ", ".join(p["name"] for p in (svc or {}).get("packages") or []) or "none set up"
            raise ToolError(f"'{pkg_name}' is not one of the packages for {service_name or 'that service'} ({names}).")

    items = []
    for it in (a.get("items") or [])[:40]:
        desc = str((it or {}).get("description") or "").strip()[:300]
        try:
            price = round(float(it.get("unit_price")), 2)
            qty = float(it.get("quantity") or 1)
        except (TypeError, ValueError):
            raise ToolError("I need a price for each line.")
        if desc:
            items.append({"id": uuid.uuid4().hex[:8], "description": desc, "qty": qty if qty > 0 else 1, "unit_price": price})
    copied, source = None, ""
    if not items and pkg and pkg.get("price") and not a.get("copy_last"):
        items = [{"id": uuid.uuid4().hex[:8], "description": f"{service_name} · {pkg['name']}", "qty": 1, "unit_price": float(pkg["price"])}]
        source = "your package price"
    if not items:
        copied = _last_invoice(db, owner.id, client.id, service_name)
        if not copied:
            what = f"{service_name} invoice" if service_name else "invoice"
            raise ToolError(f"I need to know what to charge: {client.name} has no earlier {what} to copy and no price was given. Ask for the price.")
        items = [{**dict(i), "id": uuid.uuid4().hex[:8]} for i in (copied.items or []) if not i.get("deposit_credit")]
        source = f"their last invoice, {copied.number}" if copied.number else "their last invoice"
        if not service_name:
            service_name = copied.service_type or ""
            svc = _service(setup, service_name)
        if not pkg and copied.service_package and svc:
            pkg = package_of(svc, copied.service_package)

    day = _day(a.get("service_date"))
    days = sorted({_day(d) for d in (a.get("service_days") or []) if str(d or "").strip()})
    if days and not day:
        day = days[0]
    if pkg and pkg["days"] > 1 and day:
        days = days if len(days) > 1 else _package_days(day, pkg["days"], rules_for(owner)["work_days"])
        day = days[0]
    else:
        days = []
    t = _time(a.get("time")) or (copied.service_time if copied else "") or ""

    taken = day and (db.query(Booking.id).filter(Booking.user_id == owner.id, Booking.client_id == client.id, Booking.date == day,
                                                 Booking.status.in_(("enquiry", "quoted", "confirmed", "in_prep"))).first())
    warn = _fit_note(db, user, day, service_name) if day and not taken else ""

    seq = next_doc_seq(db, Invoice, owner.id)
    number = render_doc_number(effective_doc_format(owner, "invoice"), seq)
    pct = float(owner.invoice_deposit_percent or 0)
    inv = Invoice(
        user_id=owner.id, client_id=client.id, number=number, status="draft", issue_date=today.isoformat(), due_date="", paid_date="",
        items=items, tax_rate=(copied.tax_rate if copied else 0) or 0, discount=(copied.discount if copied else 0) or 0,
        deposit_type=(copied.deposit_type if copied else ("percent" if pct else "")) or "",
        deposit_value=(copied.deposit_value if copied else pct) or 0,
        notes=str(a.get("notes") or "").strip()[:4000] or (copied.notes if copied else (owner.invoice_notes_default or "")) or "",
        service_date=day, service_type=service_name, service_time=t, service_package=pkg["name"] if pkg else "", service_days=days,
    )
    db.add(inv)
    db.flush()
    booking_created = False
    if day:
        res = sync_booking(inv.id, db, user)
        booking_created = bool(res.get("created"))
        db.refresh(inv)
    total = invoice_total(inv)
    when = ""
    if day:
        when = (", ".join(pretty_day(d, today) for d in days) if days else pretty_day(day, today)) + (f" at {pretty_time(t)}" if t else "")
    lines = [client.name, " · ".join(x for x in [service_name, pkg["name"] if pkg else ""] if x), when]
    for it in items[:8]:
        if it.get("section"):
            continue
        q = it.get("qty") or 1
        lines.append(f"{it.get('description')}: {money((it.get('unit_price') or 0) * q, owner)}" + (f" ({q:g} at {money(it.get('unit_price') or 0, owner)})" if q != 1 else ""))
    lines.append(f"Total {money(total, owner)}" + (f" (from {source})" if source else ""))
    if not day:
        lines.append("No service day yet, so it is not on your calendar. Open it to add the day.")
    else:
        lines.append(warn)
        bk = db.get(Booking, inv.booking_id) if inv.booking_id else None
        if bk and bk.deposit_paid and not bk.deposit_applied and bk.deposit_amount:
            lines.append(f"Their {money(bk.deposit_amount, owner)} deposit is already paid. Open the invoice to take it off.")
    return {"card": card("invoice", f"Draft invoice {number}", lines, action={"type": "open_invoice", "id": inv.id, "label": "Open invoice"},
                         undo={"kind": "invoice", "id": inv.id, "booking_id": inv.booking_id if booking_created else None}),
            "data": f"Draft {number} for {client.name}, total {money(total, owner)}" + (f" (lines from {source})" if source else "")
                    + (f", on the calendar for {day}." if day else ", no service day yet.") + (f" Note: {warn}" if warn else "")}


def t_mark_invoice_paid(db, owner, user, a, today):
    from .finance import invoice_total, sync_booking

    try:
        inv = db.get(Invoice, int(a.get("invoice_id")))
    except (TypeError, ValueError):
        inv = None
    if not inv or inv.user_id != owner.id:
        raise ToolError("I couldn't find that invoice.")
    if inv.status == "paid":
        raise ToolError(f"Invoice {inv.number} is already marked paid.")
    if inv.status == "void":
        raise ToolError(f"Invoice {inv.number} is void.")
    before = {"status": inv.status, "paid_date": inv.paid_date}
    inv.status, inv.paid_date = "paid", today.isoformat()
    db.flush()
    if inv.service_date and inv.client_id:
        sync_booking(inv.id, db, user)
    client = db.get(Client, inv.client_id) if inv.client_id else None
    action = {"type": "send_receipt", "id": inv.id, "label": f"Email receipt to {client.name.split()[0]}"} if client and client.email and not inv.file_url else None
    return {"card": card("paid", "Marked paid", [f"{inv.number} · {client.name if client else 'no client'} · {money(invoice_total(inv), owner)}"],
                         action=action, undo={"kind": "paid", "id": inv.id, "before": before}),
            "data": f"{inv.number} marked paid. No receipt has been sent."}


def t_pencil_in(db, owner, user, a, today):
    from .jobs import ensure_plan, setup_for

    client = find_client(db, owner.id, a.get("client_id"), a.get("client_name") or "")
    day = _day(a.get("date"), required=True, field="day")
    t = _time(a.get("time"))
    setup = setup_for(db, owner)
    svc = _service(setup, a.get("service") or "")
    name = svc["name"] if svc else str(a.get("service") or "").strip()[:80]
    if not name:
        raise ToolError("Which service is this for?")
    clash = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id == client.id, Booking.date == day,
                                      Booking.status.in_(("quoted", "confirmed", "in_prep"))).first())
    if clash:
        raise ToolError(f"{client.name} is already on the calendar for {pretty_day(day, today)}.")
    warn = _fit_note(db, user, day, name)
    bk = Booking(user_id=owner.id, client_id=client.id, title=f"{client.name} · {name}", event_type=name, status="quoted", date=day,
                 start_time=t, notes=("Pencilled in. " + str(a.get("note") or "").strip())[:2000])
    db.add(bk)
    db.flush()
    ensure_plan(db, owner, bk, setup)
    return {"card": card("job", "Pencilled in", [f"{client.name} · {name}", _when(day, t, today), warn],
                         link={"to": f"/app/calendar?job={bk.id}", "label": "Open on calendar"}, undo={"kind": "booking", "id": bk.id}),
            "data": f"Pencilled in (job {bk.id})." + (f" Note: {warn}" if warn else "")}


def t_block_time(db, owner, user, a, today):
    day = _day(a.get("date"), required=True, field="day")
    end = _day(a.get("end_date"))
    if end and end <= day:
        end = ""
    start, finish = _time(a.get("start_time")), _time(a.get("end_time"))
    if finish and not start:
        finish = ""
    if start and finish and finish <= start:
        finish = ""
    title = str(a.get("title") or "").strip()[:160] or "Busy"
    whole = not start
    b = DiaryBlock(user_id=owner.id, title=title, kind="off" if whole else "busy", date=day, end_date=end if whole else "",
                   start_time=start, end_time=finish)
    db.add(b)
    db.flush()
    span = pretty_day(day, today) + (f" to {pretty_day(end, today)}" if end and whole else "")
    hours = f"{pretty_time(start)}" + (f" to {pretty_time(finish)}" if finish else "") if start else "all day"
    return {"card": card("block", "Blocked out", [title, f"{span}, {hours}"], link={"to": "/app/calendar", "label": "Open calendar"},
                         undo={"kind": "block", "id": b.id}), "data": "Blocked."}


def _job_for(db, owner, job_id) -> Booking:
    try:
        bk = db.get(Booking, int(job_id))
    except (TypeError, ValueError):
        bk = None
    if not bk or bk.user_id != owner.id:
        raise ToolError("I couldn't find that job in the diary.")
    return bk


def _http(fn, *args):
    """Run one of the app's own endpoint functions, turning its HTTP error into a plain message for the model."""
    try:
        return fn(*args)
    except HTTPException as exc:
        raise ToolError(str(exc.detail))


def t_plan_step(db, owner, user, a, today):
    from .jobs import job_detail, plan_session

    bk = _job_for(db, owner, a.get("job_id"))
    detail = job_detail(db, owner, bk)
    want = str(a.get("step") or "").strip().lower()
    si = next((i for i, st in enumerate(detail["steps"]) if st["kind"] == want or st["name"].lower() == want), None)
    if si is None:
        si = next((i for i, st in enumerate(detail["steps"]) if want and want in st["name"].lower()), None)
    if si is None:
        names = ", ".join(st["name"] for st in detail["steps"]) or "none"
        raise ToolError(f"That job has no '{want or 'such'}' step (its steps: {names}).")
    st = detail["steps"][si]
    day, t = _day(a.get("day"), required=True, field="day"), _time(a.get("time"))
    if not (st["window"][0] <= day <= st["window"][1]):
        raise ToolError(f"{st['name']} for {detail['who']} can be any day from {_d(st['window'][0])} to {_d(st['window'][1])}; {_d(day)} is outside that.")
    before = dict(st["sessions"][0])
    _http(plan_session, bk.id, {"si": si, "ii": 0, "day": day, "time": t}, db, user)
    return {"card": card("step", f"{st['name']} for {detail['who']}", [_when(day, t, today) + ("" if t else ", any time")],
                         link={"to": f"/app/calendar?job={bk.id}", "label": "Open on calendar"},
                         undo={"kind": "step", "job_id": bk.id, "si": si, "before": before}), "data": "Planned."}


def t_move_job(db, owner, user, a, today):
    from .jobs import job_detail, update_job

    bk = _job_for(db, owner, a.get("job_id"))
    detail = job_detail(db, owner, bk)
    payload, before = {}, {}
    if str(a.get("date") or "").strip():
        payload["date"] = _day(a.get("date"))
        before["date"] = bk.date
    if "time" in a and str(a.get("time") or "").strip():
        payload["start"] = _time(a.get("time"))
        before["start"] = bk.start_time or ""
    if not payload:
        raise ToolError("I need the new day or the time.")
    out = _http(update_job, bk.id, payload, db, user)
    return {"card": card("job", f"{detail['who']} · {detail['service']}",
                         [("Moved to " if "date" in payload else "") + _when(out["date"], out.get("start_time") or "", today)],
                         link={"to": f"/app/calendar?job={bk.id}", "label": "Open on calendar"},
                         undo={"kind": "job", "job_id": bk.id, "before": before}), "data": "Done."}


def t_add_shopping_items(db, owner, user, a, today):
    items = []
    for raw in (a.get("items") or [])[:60]:
        name = str((raw or {}).get("name") or "").strip()[:200]
        if not name:
            continue
        try:
            qty = float(raw.get("quantity")) if raw.get("quantity") not in (None, "") else ""
        except (TypeError, ValueError):
            qty = ""
        items.append({"id": uuid.uuid4().hex[:8], "name": name, "qty": qty, "unit": str(raw.get("unit") or "").strip()[:20],
                      "shop": str(raw.get("shop") or "").strip()[:80] or "Anywhere", "category": "", "est_cost": 0, "purchased": False, "note": ""})
    if not items:
        raise ToolError("There was nothing to add to the list.")
    sl, created = None, False
    if a.get("list_id"):
        try:
            sl = db.get(ShoppingList, int(a["list_id"]))
        except (TypeError, ValueError):
            sl = None
        if sl and sl.user_id != owner.id:
            sl = None
    if not sl:
        day = _day(a.get("shop_date"))
        title = str(a.get("new_list_title") or "").strip()[:200] or (f"Shopping · {pretty_day(day)}" if day else "Shopping list")
        sl = ShoppingList(user_id=owner.id, title=title, shop_date=day, status="open", items=[])
        db.add(sl)
        created = True
    sl.items = [*(sl.items or []), *items]   # a fresh list, so the change is saved
    db.flush()
    lines = [" ".join(str(x) for x in [f"{i['qty']:g}" if i["qty"] != "" else "", i["unit"], i["name"]] if x) for i in items]
    return {"card": card("shopping", f"Added to {sl.title}", lines, link={"to": "/app/shopping", "label": "Open shopping"},
                         undo={"kind": "shopping", "list_id": sl.id, "item_ids": [i["id"] for i in items], "created": created}),
            "data": f"Added {len(items)} to '{sl.title}'."}


def t_client_history(db, owner, user, a, today):
    from .finance import invoice_total

    client = find_client(db, owner.id, a.get("client_id"), a.get("client_name") or "")
    rows = (db.query(Invoice).filter(Invoice.user_id == owner.id, Invoice.client_id == client.id, Invoice.status != "void")
            .order_by(Invoice.id.desc()).limit(6).all())
    out = [f"{client.name} (id {client.id})" + (f", {client.email}" if client.email else "") + (f", {client.phone}" if client.phone else "")]
    if not rows:
        out.append("No invoices yet.")
    for inv in rows:
        out.append(f"Invoice {inv.number} · {inv.status} · issued {inv.issue_date or '?'}" + (f" · for {inv.service_type} on {inv.service_date}" if inv.service_date else "")
                   + f" · total {money(invoice_total(inv), owner)}")
        for it in (inv.items or [])[:12]:
            if it.get("section"):
                out.append(f"   [{it.get('description', '')}]")
            else:
                out.append(f"   {it.get('description', '')} · {it.get('qty') or 1:g} at {money(it.get('unit_price') or 0, owner)}")
    coming = (db.query(Booking).filter(Booking.user_id == owner.id, Booking.client_id == client.id, Booking.date >= today.isoformat(),
                                       Booking.status.in_(("enquiry", "quoted", "confirmed", "in_prep"))).order_by(Booking.date.asc()).limit(8).all())
    for bk in coming:
        out.append(f"Coming up: {bk.event_type or bk.title} on {bk.date} ({bk.status}) [job {bk.id}]")
    return {"data": "\n".join(out), "followup": True}


def t_draft_message(db, owner, user, a, today):
    text = str(a.get("text") or "").strip()[:3000]
    if not text:
        raise ToolError("There was no message to write.")
    client = None
    if a.get("client_id") or a.get("client_name"):
        client = find_client(db, owner.id, a.get("client_id"), a.get("client_name") or "")
    phone = "".join(ch for ch in (client.phone if client else "") or "" if ch.isdigit())
    if phone.startswith("0"):
        phone = "44" + phone[1:]
    return {"card": card("message", f"Message for {client.name}" if client else "Message", [], text=text,
                         subject=str(a.get("subject") or "").strip()[:160], phone=phone, email=(client.email if client else "") or ""),
            "data": "Written for the owner to send."}


HANDLERS = {
    "add_todos": t_add_todos, "complete_todos": t_complete_todos, "update_todo": t_update_todo, "save_note": t_save_note,
    "add_client": t_add_client, "draft_invoice": t_draft_invoice, "mark_invoice_paid": t_mark_invoice_paid, "pencil_in": t_pencil_in,
    "block_time": t_block_time, "plan_step": t_plan_step, "move_job": t_move_job, "add_shopping_items": t_add_shopping_items,
    "client_history": t_client_history, "draft_message": t_draft_message,
}


def run_tool(db: Session, owner: User, user: User, name: str, args: dict, today: _date) -> dict:
    """Run one tool and commit it, or roll it back whole if it fails. Returns {ok, data, card?, followup?}."""
    fn = HANDLERS.get(name)
    if not fn:
        return {"ok": False, "data": f"There is no tool called {name}."}
    try:
        out = fn(db, owner, user, args if isinstance(args, dict) else {}, today)
        db.commit()
        return {"ok": True, **out}
    except ToolError as exc:
        db.rollback()
        return {"ok": False, "data": str(exc)}
    except HTTPException as exc:
        db.rollback()
        return {"ok": False, "data": str(exc.detail)}
    except Exception as exc:  # a bug in a tool must not lose the whole reply
        db.rollback()
        log.exception("assistant tool %s failed", name)
        return {"ok": False, "data": f"That didn't work ({type(exc).__name__})."}


# ───────────────────────────── the model ─────────────────────────────
def model_call(messages: list[dict]):
    """One request to Claude. Kept on its own so tests can stand in for it."""
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=90.0, max_retries=1)
    return client.messages.create(
        model=config.ASSISTANT_MODEL,
        max_tokens=4000,
        system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    )


def _call(messages: list[dict]):
    try:
        return model_call(messages)
    except anthropic.AuthenticationError:
        raise HTTPException(503, "The AI key was rejected. Check ANTHROPIC_API_KEY on the server.")
    except anthropic.RateLimitError:
        raise HTTPException(429, "Mise is busy for a moment. Try again shortly.")
    except anthropic.APIConnectionError:
        raise HTTPException(502, "Mise couldn't be reached just now. Try again in a moment.")
    except anthropic.APIStatusError as exc:
        log.warning("assistant model error %s: %s", getattr(exc, "status_code", "?"), getattr(exc, "message", exc))
        raise HTTPException(502, f"Mise had a problem answering ({getattr(exc, 'status_code', 'error')}). Try again.")


def _history(raw) -> list[dict]:
    """Earlier turns of this conversation as plain text (the app keeps them; the server keeps nothing)."""
    out = []
    for h in (raw or [])[-10:]:
        role = (h or {}).get("role")
        text = str((h or {}).get("text") or "").strip()[:2500]
        if role in ("user", "assistant") and text:
            out.append({"role": role, "content": text})
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out


@router.post("")
def ask(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_plan(1))):
    """{text, history?: [{role, text}]} -> {reply, cards: [...]}. Cards are what was done (each with an undo) or written."""
    _gate(user)
    text = str(payload.get("text") or "").strip()
    if not text:
        raise HTTPException(422, "Say or type what you need.")
    if len(text) > MAX_TEXT:
        raise HTTPException(422, "That's a lot in one go. Send it in two or three parts.")
    owner = db.get(User, ws_id(user))
    key = f"assistant:{owner.id}"
    if ratelimit.count(key, 3600) >= config.ASSISTANT_RATE_MAX:
        raise HTTPException(429, "That's a lot of requests in an hour. Give it a little while.")
    ratelimit.record(key, 3600)
    today = local_today()
    messages = _history(payload.get("history"))
    messages.append({"role": "user", "content": f"<business>\n{context_text(db, owner, user)}\n</business>\n\n<request>\n{text}\n</request>"})

    cards, reply = [], ""
    for round_no in range(MAX_ROUNDS):
        resp = _call(messages)
        blocks = list(getattr(resp, "content", None) or [])
        said = "".join(getattr(b, "text", "") for b in blocks if getattr(b, "type", "") == "text").strip()
        uses = [b for b in blocks if getattr(b, "type", "") == "tool_use"]
        if getattr(resp, "stop_reason", "") == "refusal":
            reply = said or "I can't help with that one."
            break
        if not uses:
            reply = said or reply
            break
        results, again = [], False
        for u in uses:
            res = run_tool(db, owner, user, u.name, u.input, today)
            if res.get("card"):
                cards.append(res["card"])
            if not res["ok"] or res.get("followup"):
                again = True
            results.append({"type": "tool_result", "tool_use_id": u.id, "content": str(res.get("data") or ("Done." if res["ok"] else "Failed.")),
                            **({} if res["ok"] else {"is_error": True})})
        db.commit()
        reply = said or reply
        if not again or round_no == MAX_ROUNDS - 1:
            break
        messages.append({"role": "assistant", "content": blocks})
        messages.append({"role": "user", "content": results})
    db.commit()
    if not reply:
        reply = "Done." if cards else "I didn't catch anything to do there. Try saying it another way."
    return {"reply": reply, "cards": [c for c in cards if c]}


# ───────────────────────────── undo ─────────────────────────────
@router.post("/undo")
def undo(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_plan(1))):
    """Take back one thing the assistant did. The card carries what to undo; every id is checked against this business."""
    if user.role == "staff":
        raise HTTPException(403, "The assistant is for the business owner.")
    from .jobs import ensure_plan, plan_session, update_job

    owner = db.get(User, ws_id(user))
    u = payload.get("undo") or {}
    kind = u.get("kind")

    def own(model, i):
        try:
            obj = db.get(model, int(i))
        except (TypeError, ValueError):
            obj = None
        return obj if obj and obj.user_id == owner.id else None

    if kind == "tasks":
        for t in _own_tasks(db, owner, u.get("ids")):
            db.delete(t)
    elif kind == "tasks_reopen":
        for t in _own_tasks(db, owner, u.get("ids")):
            t.status, t.completed_at = "todo", None
    elif kind == "task_update":
        t = own(Task, u.get("id"))
        b = u.get("before") or {}
        if t:
            t.title = str(b.get("title") or t.title)[:300]
            t.due_date = str(b.get("due_date") or "")[:10]
            t.due_time = str(b.get("due_time") or "")[:5]
            t.category = str(b.get("category") or t.category)[:20]
            t.due_reminder_for = ""
    elif kind == "note":
        obj = own(Idea, u.get("id"))
        if obj:
            db.delete(obj)
    elif kind == "client":
        c = own(Client, u.get("id"))
        if c:
            used = db.query(Booking.id).filter(Booking.client_id == c.id).first() or db.query(Invoice.id).filter(Invoice.client_id == c.id).first()
            if used:
                raise HTTPException(422, "That client now has bookings or invoices, so they are staying. Remove them from Clients if you need to.")
            db.delete(c)
    elif kind == "invoice":
        inv = own(Invoice, u.get("id"))
        if inv:
            if inv.status != "draft":
                raise HTTPException(422, "That invoice has been sent or paid since. Change it in Finance.")
            bk = own(Booking, u.get("booking_id")) if u.get("booking_id") else None
            db.delete(inv)
            db.flush()
            if bk and not db.query(Invoice.id).filter(Invoice.booking_id == bk.id).first() and bk.status == "quoted" and not bk.date_hold:
                db.delete(bk)
    elif kind == "paid":
        inv = own(Invoice, u.get("id"))
        b = u.get("before") or {}
        if inv and b.get("status") in ("draft", "sent", "overdue"):
            inv.status, inv.paid_date = b["status"], str(b.get("paid_date") or "")[:10]
    elif kind == "booking":
        bk = own(Booking, u.get("id"))
        if bk:
            if db.query(Invoice.id).filter(Invoice.booking_id == bk.id).first():
                raise HTTPException(422, "That job has an invoice now, so it is staying on your calendar.")
            db.delete(bk)
    elif kind == "block":
        obj = own(DiaryBlock, u.get("id"))
        if obj and not obj.source:
            db.delete(obj)
    elif kind == "step":
        bk = own(Booking, u.get("job_id"))
        b = u.get("before") or {}
        if bk:
            if b.get("auto"):
                plan_session(bk.id, {"si": u.get("si"), "ii": 0, "day": "", "time": ""}, db, user)
            else:
                plan_session(bk.id, {"si": u.get("si"), "ii": 0, "day": b.get("day", ""), "time": b.get("time", "")}, db, user)
    elif kind == "job":
        bk = own(Booking, u.get("job_id"))
        b = u.get("before") or {}
        if bk and b:
            update_job(bk.id, {k: v for k, v in b.items() if k in ("date", "start")}, db, user)
            ensure_plan(db, owner, bk)
    elif kind == "shopping":
        sl = own(ShoppingList, u.get("list_id"))
        if sl:
            gone = set(u.get("item_ids") or [])
            sl.items = [i for i in (sl.items or []) if i.get("id") not in gone]
            if u.get("created") and not sl.items:
                db.delete(sl)
    else:
        raise HTTPException(422, "There is nothing to undo there.")
    db.commit()
    return {"ok": True}


# ───────────────────────────── voice: speech to text ─────────────────────────────
def _multipart(fields: dict[str, str], filename: str, content_type: str, data: bytes) -> tuple[bytes, str]:
    boundary = "----cc" + uuid.uuid4().hex
    out = []
    for k, v in fields.items():
        out.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    out.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode())
    out.append(data)
    out.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(out), f"multipart/form-data; boundary={boundary}"


def _post(url: str, headers: dict, body: bytes, content_type: str) -> dict:
    req = urllib.request.Request(url, data=body, method="POST", headers={
        **headers, "Content-Type": content_type, "Accept": "application/json",
        # Speech APIs sit behind bot filters that refuse the default Python user agent (as Resend's does).
        "User-Agent": "Mozilla/5.0 (compatible; TheCreatisteCommand/1.0; +https://creatistecommand.onrender.com)",
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8", "replace") or "{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400] if exc.fp else ""
        raise RuntimeError(f"{exc.code}: {detail}") from None


def speech_to_text(data: bytes, content_type: str, hint: str = "") -> str:
    """Send a recording to the configured speech service and return what was said. Kept on its own so tests can stand in."""
    ct = (content_type or "audio/mp4").split(";")[0].strip().lower()
    ext = {"audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav",
           "audio/x-wav": "wav", "audio/mpeg": "mp3", "video/mp4": "mp4", "video/webm": "webm"}.get(ct, "m4a")
    lang = config.TRANSCRIBE_LANGUAGE
    provider = transcribe_provider()
    if provider == "elevenlabs":
        fields = {"model_id": config.TRANSCRIBE_MODEL or "scribe_v1", "tag_audio_events": "false"}
        if lang:
            fields["language_code"] = lang
        body, mime = _multipart(fields, f"speech.{ext}", ct, data)
        out = _post("https://api.elevenlabs.io/v1/speech-to-text", {"xi-api-key": config.ELEVENLABS_API_KEY}, body, mime)
    elif provider == "openai":
        fields = {"model": config.TRANSCRIBE_MODEL or "gpt-4o-transcribe", "response_format": "json"}
        if lang:
            fields["language"] = lang
        if hint:
            fields["prompt"] = hint[:800]
        body, mime = _multipart(fields, f"speech.{ext}", ct, data)
        out = _post("https://api.openai.com/v1/audio/transcriptions", {"Authorization": f"Bearer {config.OPENAI_API_KEY}"}, body, mime)
    else:
        raise RuntimeError("no speech service configured")
    return str(out.get("text") or "").strip()


def _vocabulary(db: Session, owner: User) -> str:
    """The names this business uses, to help the speech service spell them (where it accepts a hint)."""
    from .jobs import setup_for

    words = [s["name"] for s in setup_for(db, owner)["services"]]
    words += [c.name for c in db.query(Client).filter(Client.user_id == owner.id).order_by(Client.id.desc()).limit(60).all()]
    return ", ".join(words)


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(require_plan(1))):
    """A voice recording in, its words out. Nothing is stored: the audio goes to the speech service and is dropped."""
    _gate(user)
    if not transcribe_provider():
        raise HTTPException(503, "Voice isn't switched on yet. It needs a speech key set on the server.")
    owner = db.get(User, ws_id(user))
    key = f"transcribe:{owner.id}"
    if ratelimit.count(key, 3600) >= config.ASSISTANT_RATE_MAX * 2:
        raise HTTPException(429, "That's a lot of recordings in an hour. Give it a little while.")
    data = await file.read()
    if len(data) < 800:
        raise HTTPException(422, "I didn't hear anything. Hold the button and speak, then tap again to stop.")
    if len(data) > config.TRANSCRIBE_MAX_MB * 1024 * 1024:
        raise HTTPException(413, "That recording is too long. Keep it under a few minutes.")
    ratelimit.record(key, 3600)
    try:
        text = speech_to_text(data, file.content_type or "", _vocabulary(db, owner))
    except Exception as exc:
        log.warning("transcription failed: %s", exc)
        raise HTTPException(502, "I couldn't make out that recording. Try again, or type it.")
    if not text:
        raise HTTPException(422, "I didn't catch any words. Try again a little closer to the phone.")
    return {"text": text}
