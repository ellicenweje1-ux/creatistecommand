"""Invoices, expenses and finance reporting."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import config, mailer
from ..auth import require_active
from ..database import get_db
from ..models import Client, Expense, Invoice, User
from ..utils import crud_router, effective_doc_format, get_owned, log_activity, next_doc_seq, render_doc_number, to_dict, ws_id

invoices = crud_router(
    Invoice, required=(), search_fields=("number", "notes"),
    default_order=lambda m: [m.created_at.desc()],
)
expenses = crud_router(
    Expense, required=("description",), search_fields=("description", "category", "supplier"),
    default_order=lambda m: [m.date.desc()],
)

router = APIRouter()


def invoice_total(inv: Invoice) -> float:
    subtotal = sum((i.get("qty") or 0) * (i.get("unit_price") or 0) for i in (inv.items or []))
    taxed = (subtotal - (inv.discount or 0)) * (1 + (inv.tax_rate or 0) / 100)
    return round(max(taxed, 0), 2)


@router.get("/summary")
def summary(year: int | None = None, db: Session = Depends(get_db), user=Depends(require_active)):
    year = year or date.today().year
    invs = db.query(Invoice).filter(Invoice.user_id == ws_id(user)).all()
    exps = db.query(Expense).filter(Expense.user_id == ws_id(user)).all()

    monthly = [{"month": m, "invoiced": 0.0, "paid": 0.0, "expenses": 0.0} for m in range(1, 13)]
    totals = {"invoiced": 0.0, "paid": 0.0, "outstanding": 0.0, "expenses": 0.0}
    by_category: dict[str, float] = {}

    def month_of(datestr: str):
        try:
            y, m, _ = datestr.split("-")
            return (int(y), int(m))
        except (ValueError, AttributeError):
            return (0, 0)

    for inv in invs:
        if inv.status == "void":
            continue
        total = invoice_total(inv)
        y, m = month_of(inv.issue_date)
        if y == year:
            monthly[m - 1]["invoiced"] += total
        totals["invoiced"] += total
        if inv.status == "paid":
            totals["paid"] += total
            py, pm = month_of(inv.paid_date or inv.issue_date)
            if py == year:
                monthly[pm - 1]["paid"] += total
        elif inv.status in ("sent", "overdue"):
            totals["outstanding"] += total

    for exp in exps:
        totals["expenses"] += exp.amount or 0
        y, m = month_of(exp.date)
        if y == year:
            monthly[m - 1]["expenses"] += exp.amount or 0
        if exp.category:
            by_category[exp.category] = by_category.get(exp.category, 0) + (exp.amount or 0)

    totals = {k: round(v, 2) for k, v in totals.items()}
    totals["profit"] = round(totals["paid"] - totals["expenses"], 2)
    open_invoices = [
        {**to_dict(i), "total": invoice_total(i)}
        for i in invs if i.status in ("sent", "overdue")
    ]
    return {
        "year": year,
        "totals": totals,
        "monthly": [{**m, "invoiced": round(m["invoiced"], 2), "paid": round(m["paid"], 2), "expenses": round(m["expenses"], 2)} for m in monthly],
        "by_category": [{"category": k, "amount": round(v, 2)} for k, v in sorted(by_category.items(), key=lambda kv: -kv[1])],
        "open_invoices": open_invoices,
    }


@invoices.post("/{invoice_id}/share")
def share_invoice(invoice_id: int, send: bool = False, db: Session = Depends(get_db), user=Depends(require_active)):
    """Mint (once) the read-only public link for an in-app invoice. With send=true, also
    emails the client the link and marks the invoice sent."""
    inv = get_owned(db, Invoice, invoice_id, ws_id(user))
    if not inv.public_token:
        inv.public_token = uuid.uuid4().hex
    link = f"{config.APP_URL.rstrip('/')}/i/{inv.public_token}"
    emailed = False
    if send:
        if inv.status == "draft":
            inv.status = "sent"
        owner = db.get(User, ws_id(user))
        client = db.get(Client, inv.client_id) if inv.client_id else None
        if client and client.user_id == ws_id(user) and client.email:
            biz = (owner.business_name or owner.name) if owner else "your caterer"
            mailer.send_email(
                client.email, f"Invoice {inv.number} from {biz}",
                f"Hi {client.name},\n\nYour invoice {inv.number} is ready to view and download here:\n{link}\n\n{biz}",
            )
            emailed = True
        log_activity(db, user, "updated", inv, summary=f"Sent invoice {inv.number or inv.id}")
    db.commit()
    db.refresh(inv)
    return {**to_dict(inv), "public_url": link, "emailed": emailed}


@invoices.post("/{invoice_id}/duplicate")
def duplicate_invoice(invoice_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    """Copy an invoice into a fresh draft (new number, no sent-link/paid state) — the
    quickest way to raise the next similar invoice."""
    src = get_owned(db, Invoice, invoice_id, ws_id(user))
    owner = db.get(User, ws_id(user))
    seq = next_doc_seq(db, Invoice, ws_id(user))
    fmt = effective_doc_format(owner, "invoice") if owner else "INV-{YYYY}-{nnn}"
    dup = Invoice(
        user_id=ws_id(user), booking_id=src.booking_id, client_id=src.client_id,
        number=render_doc_number(fmt, seq), status="draft",
        issue_date=date.today().isoformat(), due_date="", paid_date="",
        items=[dict(i) for i in (src.items or [])],
        tax_rate=src.tax_rate, discount=src.discount,
        deposit_type=src.deposit_type, deposit_value=src.deposit_value, notes=src.notes,
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)
    log_activity(db, user, "created", dup, summary=f"Duplicated invoice {src.number or src.id}")
    return to_dict(dup)


@router.get("/next-invoice-number")
def next_invoice_number(db: Session = Depends(get_db), user=Depends(require_active)):
    owner = db.get(User, ws_id(user))  # staff use their owner's format
    seq = next_doc_seq(db, Invoice, ws_id(user))
    fmt = effective_doc_format(owner, "invoice") if owner else "INV-{YYYY}-{nnn}"
    return {"number": render_doc_number(fmt, seq), "seq": seq, "format": fmt}


def _invoice_subtotal(inv: Invoice) -> float:
    return round(sum((i.get("qty") or 0) * (i.get("unit_price") or 0) for i in (inv.items or [])), 2)


@router.get("/export/invoices.csv")
def export_invoices(db: Session = Depends(get_db), user=Depends(require_active)):
    """Invoices as CSV for the accountant. Owner-only + Pro (gated on the router mount)."""
    from .exports import csv_response

    invs = db.query(Invoice).filter(Invoice.user_id == ws_id(user)).order_by(Invoice.issue_date.asc()).all()
    names = {c.id: c.name for c in db.query(Client).filter(Client.user_id == ws_id(user)).all()}
    rows = [
        [
            inv.number, inv.status, inv.issue_date, inv.due_date, inv.paid_date,
            names.get(inv.client_id, ""), _invoice_subtotal(inv), inv.discount,
            inv.tax_rate, invoice_total(inv), inv.notes,
        ]
        for inv in invs
    ]
    return csv_response(
        "creatiste-invoices.csv",
        ["Number", "Status", "Issued", "Due", "Paid on", "Client", "Subtotal",
         "Discount", "Tax %", "Total", "Notes"],
        rows,
    )


@router.get("/export/expenses.csv")
def export_expenses(db: Session = Depends(get_db), user=Depends(require_active)):
    from .exports import csv_response

    exps = db.query(Expense).filter(Expense.user_id == ws_id(user)).order_by(Expense.date.asc()).all()
    rows = [[e.date, e.category, e.description, e.supplier, e.amount] for e in exps]
    return csv_response(
        "creatiste-expenses.csv",
        ["Date", "Category", "Description", "Supplier", "Amount"],
        rows,
    )
