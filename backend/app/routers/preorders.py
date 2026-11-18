"""Pre-orders: customers order from a chef's own website (a lunch service, a pop-up) and pay by
card before the order is confirmed. The chef's "offer" (menu with choice groups, collection slots,
delivery policy, order cut-off) lives on their Command account; the public site reads it, and every
order is PRICED HERE from that offer, never from the browser.

Card payments go into ONE business's Stripe account and are only offered on that business's own pages (card_ready):
its own account when PREORDER_STRIPE_SECRET_KEY is set, otherwise the platform's Stripe account (STRIPE_SECRET_KEY),
which the platform owner can use for her own catering business. On the platform account, paid sessions also reach the
platform's billing webhook, which hands them to settle_session here, so no second webhook is needed. Every confirmation
asks Stripe whether the session is paid rather than trusting the caller. With no key at all, the site takes bank
transfers or hands the order to WhatsApp/email (house pattern: inert until configured).

A chef can run more than one order page: the main one (users.preorder_offer, e.g. a weekday lunch service) and any number
of one-off events (users.preorder_offers, e.g. a pop-up on a single night with a closing time and an optional box limit).
Every public call names its page by slug (?offer= / "offer" in the order); no slug means the main page.

Paid orders roll up into ONE confirmed Booking per day per offer ("Clean Dream pre-orders"), so they
show on the chef's calendar, dashboard and ICS feed without flooding the diary, and each customer
becomes a Client. Both emails (customer confirmation + chef notification) list every box by name so
labelling is a read-off."""
import copy
import re
import secrets
from datetime import date as _date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config, mailer, notify, ratelimit
from ..auth import require_plan
from ..database import get_db
from ..models import Booking, Client, PreOrder, User
from ..utils import stripe_plain, ws_id
from ..utils import EMAIL_RE

public_router = APIRouter(prefix="/public/preorder", tags=["preorders"])
router = APIRouter(prefix="/preorders", tags=["preorders"])

DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Ellice's Clean Dream lunch, as the starter template every chef can edit.
DEFAULT_OFFER = {
    "slug": "clean-dream",
    "title": "Clean Dream",
    "intro": "Clean, whole-food lunch bowls, cooked fresh and served hot.",
    "currency": "GBP",
    "cutoff": "10:00",
    "days": [0, 1, 2, 3, 4],
    "days_ahead": 5,
    "items": [
        {
            "id": "bowl", "name": "Build your own bowl", "price": 8,
            "desc": "Whole-food lunch bowl, cooked fresh and served hot.",
            "groups": [
                {"id": "base", "label": "Base", "pick": "choose one, or two for half and half", "min": 1, "max": 2,
                 "options": [{"name": "Whole sweet potato"}, {"name": "Tomato & pepper bulgur"}, {"name": "Spring mix"}]},
                {"id": "protein", "label": "Protein", "pick": "choose one", "min": 1, "max": 1,
                 "options": [{"name": "Beef mince"}, {"name": "Chicken mince"}, {"name": "Tofu mince"},
                             {"name": "Steak", "surcharge": 3}, {"name": "Blackened prawns", "surcharge": 2}]},
                {"id": "toppings", "label": "Toppings", "pick": "choose up to five", "min": 0, "max": 5,
                 "extra_price": 0.5, "extra_premium_price": 1,
                 "options": [{"name": "Avocado", "premium": True}, {"name": "Feta", "premium": True},
                             {"name": "Cottage cheese", "premium": True}, {"name": "Boiled egg", "premium": True},
                             {"name": "Fried egg", "premium": True}, {"name": "Cherry tomatoes"}, {"name": "Red onion"},
                             {"name": "Sweetcorn"}, {"name": "Pomegranate"}, {"name": "Pickled pink slaw"},
                             {"name": "Sliced pickles"}, {"name": "Pickled jalapeño"}, {"name": "Coriander"},
                             {"name": "Parsley"}, {"name": "Rocket"},
                             # sauces count as toppings; beyond the five they are 25p each rather than 50p
                             {"name": "Hot honey", "extra_price": 0.25}, {"name": "Sriracha", "extra_price": 0.25},
                             {"name": "Balsamic glaze", "extra_price": 0.25}, {"name": "Raspberry balsamic glaze", "extra_price": 0.25}]},
                {"id": "extra_protein", "label": "Extra protein", "pick": "optional", "min": 0, "max": 2,
                 "options": [{"name": "Beef mince", "surcharge": 2}, {"name": "Chicken mince", "surcharge": 2},
                             {"name": "Tofu mince", "surcharge": 2}, {"name": "Steak", "surcharge": 4},
                             {"name": "Blackened prawns", "surcharge": 3}]},
                # Only asked when steak is in the bowl (protein or extra protein); then it must be answered.
                {"id": "steak_cooked", "label": "Steak", "pick": "medium or well done", "min": 1, "max": 1,
                 "requires": {"groups": ["protein", "extra_protein"], "option": "Steak"},
                 "options": [{"name": "Medium"}, {"name": "Well done"}]},
            ],
        },
    ],
    "slots": [
        {"id": "w5", "label": "Collection point 1", "place": "Sandringham Mews Car Park, W5", "time": "1:00pm"},
        {"id": "sw15", "label": "Collection point 2", "place": "Sainsbury’s Putney Car Park, SW15", "time": "2:30pm"},
    ],
    "delivery": {
        "enabled": True, "per_mile": 0.65,
        "note": "Deliveries available between the collection locations upon request, at an additional £0.65 per mile. "
                "We confirm delivery by WhatsApp after you order and the delivery fee is charged separately.",
    },
    "allergens_note": "Tell us about allergies when you order. We will go in depth if anything needs checking.",
}


# Ellice's Soulfood Friday 2.0 (a one-night Thanksgiving pop-up, Friday 20 November 2026), as on her printed menu:
# four combos, extras, and the plantain caramel sponge cake. Loaded onto her account once (apply_owner_offers) and
# offered to any chef as a starting point for their own pop-up. Repeats are allowed (two portions of wings is two proteins).
_SF_PROTEINS = [
    {"name": "Smothered cajun butter wings", "desc": "Fried, then baked in a creamy, cajun butter-style sauce with peppers and onions."},
    {"name": "Jerk pot roast", "desc": "Spicy slow-braised beef with butter beans."},
    {"name": "Crispy fried shrimp", "desc": "Fried golden, finished with a hot honey drizzle."},
]
_SF_VEG = {"name": "Deep fried smoked tofu", "desc": "Vegetarian. Finished with a hot honey drizzle."}
_SF_SIDES = ["Sweet potato yams", "Creamy mac", "Smoked turkey greens", "Garlic parm fried corn", "Honey butter cornbread",
             "Croissant milk rolls"]
_SF_DESSERTS = ["Plantain caramel sponge cake, whipped cream", "Plantain caramel sponge cake, custard"]
_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 6: "six"}


def _sf_extras() -> list[dict]:
    return [
        {"id": "extra_protein", "label": "Extra protein", "pick": "optional · £5.50 each", "min": 0, "max": 6, "repeat": True,
         "options": [{**p, "surcharge": 5.5} for p in _SF_PROTEINS + [_SF_VEG]]},
        {"id": "extra_side", "label": "Extra side", "pick": "optional · £3.50 each", "min": 0, "max": 12, "repeat": True,
         "options": [{"name": n, "surcharge": 3.5} for n in _SF_SIDES]},
        {"id": "dessert", "label": "Dessert", "pick": "optional · £6.50 each", "min": 0, "max": 6, "repeat": True,
         "desc": "Plantain caramel sponge cake: sweet mascarpone glaze, caramelised apples, with whipped cream or custard.",
         "options": [{"name": n, "surcharge": 6.5} for n in _SF_DESSERTS]},
    ]


def _sf_combo(cid: str, name: str, price: float, proteins: int, sides: int) -> dict:
    return {
        "id": cid, "name": name, "price": price, "desc": f"{proteins} protein{'s' if proteins > 1 else ''} + {sides} sides",
        "groups": [
            {"id": "protein", "label": "Protein" if proteins == 1 else "Proteins", "pick": f"choose {_WORDS[proteins]}",
             "min": proteins, "max": proteins, "repeat": True, "options": [dict(p) for p in _SF_PROTEINS + [_SF_VEG]]},
            {"id": "sides", "label": "Sides", "pick": f"choose {_WORDS[sides]}", "min": sides, "max": sides, "repeat": True,
             "options": [{"name": n} for n in _SF_SIDES]},
            *_sf_extras(),
        ],
    }


SOULFOOD_OFFER = {
    "slug": "soulfood-friday-2",
    "title": "Soulfood Friday 2.0",
    "kind": "popup",
    "path": "soulfood",                       # the page on the chef's own site: thecreatistecatering.com/soulfood
    "intro": "A one-night Thanksgiving soul food pop-up. Pre-order and pay now, then collect under your name on the night.",
    "currency": "GBP",
    "date": "2026-11-20",
    "closes": "2026-11-18T09:00",             # local time; after this the page shows that pre-orders have closed
    "rev": 3,                                 # bump to push a menu or closing-time change onto the saved copy once (apply_owner_offers)
    "pay": "card",                            # card through Stripe when it is connected; bank transfer until then
    "capacity": 0,                            # most boxes to take (0 = no limit)
    "paused": False,
    "items": [
        _sf_combo("combo-1", "Combo 1", 17, 1, 3),
        _sf_combo("combo-2", "Combo 2", 21, 2, 3),
        _sf_combo("combo-3", "Combo 3", 23, 2, 4),
        {"id": "all-in", "name": "All in", "price": 30, "desc": "3 proteins + all sides",
         "groups": [
             {"id": "protein", "label": "Proteins", "pick": "all three", "min": 3, "max": 3, "fixed": True,
              "options": [dict(p) for p in _SF_PROTEINS]},
             {"id": "sides", "label": "Sides", "pick": "all six", "min": 6, "max": 6, "fixed": True,
              "options": [{"name": n} for n in _SF_SIDES]},
             *_sf_extras(),
         ]},
        {"id": "dessert-only", "name": "Dessert", "price": 6.5,
         "desc": "Plantain caramel sponge cake on its own: sweet mascarpone glaze, caramelised apples, with whipped cream or custard.",
         "groups": [{"id": "dessert", "label": "Dessert", "pick": "whipped cream or custard", "min": 1, "max": 1,
                     "options": [{"name": n} for n in _SF_DESSERTS]}]},
    ],
    "slots": [{"id": "popup", "label": "Collect at the pop-up", "place": "East Croydon", "time": "6.30pm till late"}],
    "delivery": {"enabled": False},
    "collect_note": "Collect under your name at the pop-up in East Croydon on Friday 20 November, from 6.30pm. Live updates "
                    "via Partiful, and we will message you before the night.",
    "allergens_note": "Please tell us about any allergies before you pay. Vegetarian? Choose the deep fried smoked tofu.",
}


def _tz():
    return ZoneInfo(config.ONBOARDING_TZ)


def offer_for(user: User) -> dict:
    o = user.preorder_offer or {}
    return o if o.get("items") else DEFAULT_OFFER


def extra_offers(user: User) -> list[dict]:
    return [o for o in (user.preorder_offers or []) if isinstance(o, dict) and o.get("items") and o.get("slug")]


def all_offers(user: User) -> list[dict]:
    main = offer_for(user)
    return [main] + [o for o in extra_offers(user) if o.get("slug") != main.get("slug")]


def find_offer(user: User, slug: str = "") -> dict:
    """The order page a request means: by slug, or the main page when no slug is given."""
    slug = (slug or "").strip()
    if not slug:
        return offer_for(user)
    for o in all_offers(user):
        if o.get("slug") == slug:
            return o
    raise HTTPException(404, "This order page is not available.")


def _closes(offer: dict) -> datetime | None:
    try:
        return datetime.fromisoformat(str(offer.get("closes") or "")[:16]).replace(tzinfo=_tz()) if offer.get("closes") else None
    except ValueError:
        return None


def _pretty_when(dt: datetime) -> str:
    h = dt.hour % 12 or 12
    t = f"{h}{':%02d' % dt.minute if dt.minute else ''}{'pm' if dt.hour >= 12 else 'am'}"
    return f"{dt.strftime('%A')} {dt.day} {dt.strftime('%B')} at {t}"


def invited(offer: dict, key: str | None) -> bool:
    """The order page's private link: a secret code that keeps it open for the people it is shared with after it has
    closed to the public. Bank transfer only. Pause still stops it, and nothing opens once the day has passed."""
    want = str(offer.get("private_key") or "")
    return bool(want) and bool(key) and secrets.compare_digest(want, str(key))


def offer_state(offer: dict, now: datetime | None = None, private: bool = False) -> str:
    """open | paused | closed (pre-orders over) | finished (the day has passed). A lunch service is always open.
    `private`: the request came through the page's private link, so the closing time does not apply."""
    now = now or datetime.now(_tz())
    if offer.get("paused"):
        return "paused"
    if offer.get("date"):
        try:
            if _date.fromisoformat(offer["date"]) < now.date():
                return "finished"
        except ValueError:
            return "closed"
        closes = _closes(offer)
        if closes and now >= closes and not private:
            return "closed"
    return "open"


def public_copy(offer: dict) -> dict:
    """The offer as the public sees it: never the private link's code."""
    return {k: v for k, v in offer.items() if k != "private_key"}


def stripe_key() -> str:
    """The Stripe account pre-orders are paid into: the business's own account when one is set, else the platform's."""
    return config.PREORDER_STRIPE_SECRET_KEY or config.STRIPE_SECRET_KEY


def stripe_account() -> str:
    return "own" if config.PREORDER_STRIPE_SECRET_KEY else ("command" if config.STRIPE_SECRET_KEY else "")


def card_ready(owner: User | None) -> bool:
    """Card payments go into one business's Stripe account, so they are only offered on that business's own pages."""
    if not stripe_key() or not owner:
        return False
    acct = config.PREORDER_STRIPE_ACCOUNT
    return (owner.email or "").lower() == acct if acct else owner.role == "admin"


def payments_for(owner: User | None, offer: dict) -> str:
    return "stripe" if card_ready(owner) and offer.get("pay", "card") != "bank" else "off"


def slot_text(slot: dict) -> str:
    return f"{slot['label']} | {slot.get('place') or ''}" + (f" @ {slot['time']}" if slot.get("time") else "")


def open_dates(offer: dict, now: datetime | None = None, private: bool = False) -> list[dict]:
    """The next bookable days, in the business's local time, honouring the order cut-off. A one-off event (an offer with
    a `date`) has just that day, while it is open for orders."""
    now = now or datetime.now(_tz())
    if offer.get("date"):
        if offer_state(offer, now, private) != "open":
            return []
        d = _date.fromisoformat(offer["date"])
        return [{"date": d.isoformat(), "label": f"{DAY_LABELS[d.weekday()]} {d.day} {d.strftime('%b')}"}]
    hh, mm = (offer.get("cutoff") or "10:00").split(":")
    cutoff = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
    days = set(offer.get("days") or [0, 1, 2, 3, 4])
    out, d = [], now.date()
    if now >= cutoff:
        d = d + timedelta(days=1)
    guard = 0
    while len(out) < int(offer.get("days_ahead") or 5) and guard < 30:
        if d.weekday() in days:
            out.append({"date": d.isoformat(), "label": f"{DAY_LABELS[d.weekday()]} {d.day} {d.strftime('%b')}"})
        d += timedelta(days=1)
        guard += 1
    return out


def _owner(token: str, db: Session) -> User:
    owner = db.query(User).filter(User.enquiry_token == token, User.role.in_(["chef", "admin"])).first() if token else None
    if not owner:
        raise HTTPException(404, "This order page is not available.")
    return owner


def payments_enabled() -> bool:
    return bool(stripe_key())


def _stripe():
    import stripe
    stripe.api_key = stripe_key()
    return stripe


def price_box(offer: dict, box: dict) -> dict:
    """Validate one box against the offer and price it. Returns {item, for, summary, choices, price}."""
    item = next((i for i in offer["items"] if i["id"] == box.get("item_id")), None)
    if not item:
        raise HTTPException(422, "That menu item isn't available")
    label = (box.get("for") or "").strip()[:60]
    if not label:
        raise HTTPException(422, "Give each box a name so it can be labelled")
    choices_in = box.get("choices") or {}
    price = float(item.get("price") or 0)
    choices, summary = {}, []
    for g in item.get("groups") or []:
        req = g.get("requires")
        if req and not any(req.get("option") in (choices_in.get(gid) or []) for gid in req.get("groups") or []):
            continue  # the group doesn't apply to this box (e.g. no steak, so no "how cooked")
        opts = {o["name"]: o for o in g.get("options") or []}
        if g.get("fixed"):  # everything in the group comes with the item (the "All in" box): nothing to choose
            picked = list(opts)
        else:
            picked = [str(x) for x in (choices_in.get(g["id"]) or []) if str(x).strip()]
        unknown = [p for p in picked if p not in opts]
        if unknown:
            raise HTTPException(422, f"'{unknown[0]}' isn't an option for {g['label']}")
        if not g.get("repeat") and len(set(picked)) != len(picked):
            raise HTTPException(422, f"Each {g['label'].lower()} can only be chosen once")
        if len(picked) < int(g.get("min") or 0):
            raise HTTPException(422, f"Choose {g.get('pick') or 'an option'} for {g['label']}")
        hard_cap = int(g.get("max") or 0)
        # Groups with an extra price allow going over `max` at that price; others don't.
        if hard_cap and len(picked) > hard_cap and not (g.get("extra_price") or g.get("extra_premium_price")):
            raise HTTPException(422, f"Too many {g['label'].lower()} chosen")
        for n, name in enumerate(picked):
            o = opts[name]
            price += float(o.get("surcharge") or 0)
            if hard_cap and n >= hard_cap:
                # an option can carry its own over-the-cap price (sauces at 25p); else the group's premium/standard
                price += float(o["extra_price"] if o.get("extra_price") is not None else (g.get("extra_premium_price") if o.get("premium") else g.get("extra_price")) or 0)
        if picked:
            choices[g["id"]] = picked
            counted = []
            for name in dict.fromkeys(picked):
                n = picked.count(name)
                counted.append(f"{n}× {name}" if n > 1 else name)
            summary.append(f"{g['label']}: {', '.join(counted)}")
    return {"item": item["name"], "item_id": item["id"], "for": label, "summary": "; ".join(summary), "choices": choices,
            "note": (box.get("note") or "").strip()[:200], "price": round(price, 2)}


def boxes_taken(db: Session, owner_id: int, offer: dict, day: str) -> int:
    """Boxes already sold for an event day: paid ones, and bank-transfer orders waiting for their money (they are real)."""
    rows = (db.query(PreOrder).filter(PreOrder.user_id == owner_id, PreOrder.offer_slug == (offer.get("slug") or ""),
                                      PreOrder.for_date == day).all())
    return sum(len(o.boxes or []) for o in rows
               if o.status in ("paid", "collected") or (o.status == "pending_payment" and o.pay_method == "bank"))


def public_offer(db: Session, owner: User, offer: dict, private: bool = False) -> dict:
    out = {"offer": public_copy(offer), "dates": open_dates(offer, private=private),
           "payments": "off" if private else payments_for(owner, offer),        # the private link is bank transfer only
           "state": offer_state(offer, private=private), "business": owner.business_name or owner.name}
    if private:
        out["private"] = True
    closes = _closes(offer)
    if closes:
        out["closes_text"] = _pretty_when(closes)
    cap = int(offer.get("capacity") or 0)
    if cap and offer.get("date"):
        left = max(0, cap - boxes_taken(db, owner.id, offer, offer["date"]))
        out["boxes_left"] = left
        if left == 0 and out["state"] == "open":
            out["state"] = "sold_out"
            out["dates"] = []
    return out


@public_router.get("/{token}")
def get_offer(token: str, offer: str = "", key: str = "", db: Session = Depends(get_db)):
    owner = _owner(token, db)
    o = find_offer(owner, offer)
    return public_offer(db, owner, o, private=invited(o, key))


def _summary(order: PreOrder) -> dict:
    return {
        "public_id": order.public_id, "status": order.status, "title": order.offer_title, "offer_slug": order.offer_slug or "",
        "pay_method": order.pay_method or "card", "name": order.customer_name, "via": order.via or "",
        "date": order.for_date, "fulfilment": order.fulfilment, "slot": order.slot_label,
        "delivery_address": order.delivery_address, "total": order.subtotal, "currency": order.currency,
        "boxes": [{"for": b["for"], "item": b["item"], "summary": b["summary"], "price": b["price"]} for b in order.boxes or []],
    }


def _pretty_date(iso: str) -> str:
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%A %-d %B")
    except Exception:
        return iso or ""


def _collect_note(owner: User, order: PreOrder) -> str:
    """The order page's own note about collecting (a pop-up: under your name, time and place announced), if it has one."""
    try:
        return str(find_offer(owner, order.offer_slug or "").get("collect_note") or "").strip()
    except HTTPException:
        return ""


def awaiting_emails(owner: User, order: PreOrder) -> dict:
    """The two 'awaiting your bank transfer' emails (customer + chef) for a bank-transfer order. Pure: no sending."""
    lines = "\n".join(f"- {b['for']}: {b['item']} ({b['summary']}) £{b['price']:.2f}" for b in order.boxes or [])
    where = order.delivery_address if order.fulfilment == "delivery" else order.slot_label
    note = _collect_note(owner, order)
    where = f"{where}\n{note}" if note else where
    return {
        "customer": {
            "to": order.email,
            "subject": f"Your {order.offer_title} order for {_pretty_date(order.for_date)} (awaiting your bank transfer)",
            "body": f"Hi {order.customer_name},\n\nThank you for your order for {_pretty_date(order.for_date)}.\n\n{lines}\n\nTotal £{order.subtotal:.2f}\n{where}\n\n"
                    f"Please send the bank transfer with your name as the reference. Your order is confirmed once we have sent a receipt of payment "
                    f"and the final collection or delivery details by WhatsApp.",
        },
        "chef": {
            "to": owner.email,
            "subject": f"{order.offer_title}: bank-transfer order from {order.customer_name} for {order.for_date} (awaiting payment)",
            "body": f"{order.customer_name} · {order.phone} · {order.email}\nFor {order.for_date} · {where}\n\n{lines}\n\nTotal £{order.subtotal:.2f}\n"
                    f"{('Allergies: ' + order.allergies) if order.allergies else ''}\n{('Note: ' + order.note) if order.note else ''}\n\n"
                    f"Once the transfer lands, mark it paid under Pre-orders in The Creatiste Command (that confirms the booking and emails the customer).",
        },
    }


def receipt_url(order: PreOrder, preview: bool = False) -> str:
    """The designed receipt document for an order (a branded page the customer can keep or print)."""
    return f"{config.APP_URL.rstrip('/')}/r/{order.public_id}{'?preview=1' if preview else ''}"


def receipt_emails(owner: User, order: PreOrder) -> dict:
    """The 'payment received' receipt (customer) + the paid-order note (chef). Pure: no sending."""
    pretty_date = _pretty_date(order.for_date)
    box_text = "\n".join(f"  • {b['for']}: {b['item']}, {b['summary']}{' [' + b['note'] + ']' if b.get('note') else ''} (£{b['price']:.2f})" for b in order.boxes or [])
    where = order.slot_label + (f"\n  {order.delivery_address}" if order.delivery_address else "")
    note = _collect_note(owner, order)
    if note:
        where += f"\n{note}"
    biz = owner.business_name or owner.name
    title = f"{order.offer_title} pre-orders"
    return {
        "customer": {
            "to": order.email,
            "subject": f"Payment received: your {order.offer_title} order is confirmed for {pretty_date}",
            "body": f"Hi {order.customer_name},\n\nThank you, your payment has been received and your order is confirmed. This email is your receipt.\n\n"
                    f"When: {pretty_date}\nWhere: {where}\n\n{box_text}\n\nTotal paid: £{order.subtotal:.2f}\n"
                    + (f"Allergies noted: {order.allergies}\n" if order.allergies else "")
                    + ("\nDelivery: we'll message you on WhatsApp to confirm the drop and the mileage fee.\n" if order.fulfilment == "delivery" else "")
                    + f"\nOrder reference: {order.public_id}\nYour receipt (keep or print): {receipt_url(order)}\n\n{biz}",
        },
        "chef": {
            "to": owner.email,
            "subject": f"[{order.offer_title}] Paid order · {pretty_date} · {len(order.boxes or [])} box(es) · {order.customer_name}",
            "body": f"{order.customer_name} · {order.phone} · {order.email}\nWhen: {pretty_date}\nWhere: {where}\n\n{box_text}\n\n"
                    + (f"Allergies: {order.allergies}\n" if order.allergies else "")
                    + (f"Note: {order.note}\n" if order.note else "")
                    + f"Paid £{order.subtotal:.2f} · ref {order.public_id}\n\nIt's on your Bookings as '{title}' for that day.\n\n— The Creatiste Command",
        },
    }


def mark_paid(db: Session, order: PreOrder, payment_intent: str = ""):
    """Idempotent: confirm the order, roll it into the day's booking, create the client, send both emails."""
    if order.status != "pending_payment":
        return
    owner = db.get(User, order.user_id)
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    order.stripe_payment_intent = payment_intent or order.stripe_payment_intent

    client = db.query(Client).filter(Client.user_id == owner.id, Client.email == order.email).first()
    if not client:
        client = Client(user_id=owner.id, name=order.customer_name, email=order.email, phone=order.phone,
                        allergies=order.allergies, tags=["pre-order"])
        db.add(client)
        db.flush()
    elif order.allergies and order.allergies not in (client.allergies or ""):
        client.allergies = f"{client.allergies}\n{order.allergies}".strip()
    order.client_id = client.id

    title = f"{order.offer_title} pre-orders"
    booking = db.query(Booking).filter(Booking.user_id == owner.id, Booking.event_type == "Pre-order",
                                       Booking.date == order.for_date, Booking.title == title).first()
    lines = [f"{b['for']}: {b['item']} ({b['summary']}){' [' + b['note'] + ']' if b.get('note') else ''} £{b['price']:.2f}" for b in order.boxes or []]
    block = "\n".join([
        f"— {order.customer_name} · {order.phone} · {order.email} · {order.slot_label}"
        + (f" · {order.delivery_address}" if order.delivery_address else ""),
        *lines,
        f"  Allergies: {order.allergies}" if order.allergies else "",
        f"  Note: {order.note}" if order.note else "",
        f"  Paid £{order.subtotal:.2f} · order {order.public_id}",
    ]).replace("\n\n", "\n")
    if not booking:
        booking = Booking(user_id=owner.id, client_id=client.id, title=title, event_type="Pre-order", status="confirmed",
                          date=order.for_date, guest_count=0, notes="Paid pre-orders for the day, one block per order.\n",
                          menu=[], quoted_price=0, deposit_paid=True)
        db.add(booking)
        db.flush()
    booking.guest_count = (booking.guest_count or 0) + len(order.boxes or [])
    booking.quoted_price = round((booking.quoted_price or 0) + order.subtotal, 2)
    booking.notes = f"{booking.notes or ''}\n{block}\n".strip() + "\n"
    booking.menu = list(booking.menu or []) + [
        {"id": secrets.token_hex(4), "course": order.slot_label.split(" |")[0], "name": f"{b['for']}: {b['item']}", "notes": b["summary"], "price": b["price"]}
        for b in order.boxes or []
    ]
    order.booking_id = booking.id
    db.commit()

    mails = receipt_emails(owner, order)
    mailer.send_email(mails["customer"]["to"], mails["customer"]["subject"], mails["customer"]["body"])
    mailer.send_email(mails["chef"]["to"], mails["chef"]["subject"], mails["chef"]["body"])
    if order.pay_method != "bank":  # a bank order is marked paid by the chef, so there's nothing to tell them
        notify.notify(db, owner, "orders", f"New {order.offer_title} order · £{order.subtotal:.2f} paid",
                      f"{order.customer_name} · {_pretty_date(order.for_date)} · {len(order.boxes or [])} box(es)",
                      url="/app/preorders", tag=f"order-{order.public_id}")


@public_router.get("/receipt/{public_id}")
def receipt_document(public_id: str, preview: int = 0, db: Session = Depends(get_db)):
    """The receipt document for an order: the chef's branding + what was paid for. Public by the order's
    unguessable id (the same way the status endpoint works). Before payment it renders as a preview only."""
    order = db.query(PreOrder).filter(PreOrder.public_id == public_id).first()
    if not order:
        raise HTTPException(404, "Receipt not found")
    paid = order.status in ("paid", "collected")
    if not paid and not preview:
        raise HTTPException(404, "This order hasn't been paid yet, so there's no receipt to show.")
    owner = db.get(User, order.user_id)
    paid_at = order.paid_at.isoformat() if order.paid_at else None
    return {
        "business": {
            "name": owner.business_name or owner.name, "email": owner.business_email or owner.email or "",
            "phone": owner.phone or "", "logo": owner.avatar_url or "", "accent": owner.invoice_accent or "#BFA987",
            "footer": owner.invoice_footer or "",
        },
        "order": {**_summary(order), "paid": paid, "paid_at": paid_at, "pay_method": order.pay_method or "card",
                  "allergies": order.allergies or "", "note": order.note or "", "pretty_date": _pretty_date(order.for_date)},
        "preview": not paid,
    }


@public_router.get("/status/{public_id}")
def order_status(public_id: str, db: Session = Depends(get_db)):
    order = db.query(PreOrder).filter(PreOrder.public_id == public_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return _summary(order)


def settle_session(db: Session, session_id: str, public_id: str = "") -> PreOrder | None:
    """Mark an order paid once Stripe says its checkout session is paid. It asks Stripe rather than trusting whoever
    called (the customer's return, either webhook), so a forged notification can't confirm an unpaid order."""
    if not session_id or not payments_enabled():
        return None
    try:
        session = stripe_plain(_stripe().checkout.Session.retrieve(session_id))
    except Exception:
        return None
    pid = (session.get("metadata") or {}).get("public_id") or ""
    if not pid or (public_id and pid != public_id):
        return None
    order = db.query(PreOrder).filter(PreOrder.public_id == pid).first()
    if order and order.status == "pending_payment" and session.get("payment_status") == "paid":
        mark_paid(db, order, session.get("payment_intent") or "")
    return order


@public_router.post("/confirm")
def confirm(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Called when the customer lands back from Stripe. Works even with no webhook configured."""
    order = db.query(PreOrder).filter(PreOrder.public_id == (payload.get("public_id") or "")).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "pending_payment":
        settle_session(db, payload.get("session_id") or order.stripe_session_id, order.public_id)
    return _summary(order)


@public_router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if not payments_enabled():
        raise HTTPException(400, "Pre-order payments not configured")
    stripe = _stripe()
    if config.PREORDER_STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(body, request.headers.get("stripe-signature", ""), config.PREORDER_STRIPE_WEBHOOK_SECRET)
        except Exception:
            raise HTTPException(400, "Invalid webhook signature")
    else:
        import json
        event = json.loads(body)
    event = stripe_plain(event)
    if event["type"] == "checkout.session.completed":
        settle_session(db, event["data"]["object"].get("id") or "")
    return {"ok": True}


def build_order(owner: User, payload: dict) -> PreOrder:
    """Validate a public order payload against the chef's offer and build the (unsaved) PreOrder.
    Shared by the card path (Stripe Checkout) and the bank-transfer path."""
    offer = find_offer(owner, payload.get("offer") or "")
    private = invited(offer, payload.get("key"))
    state = offer_state(offer, private=private)
    if state != "open":
        msg = {"paused": "Orders are paused just now.", "finished": "This event has finished.",
               "closed": "Pre-orders have closed."}.get(state, "Orders aren't open.")
        raise HTTPException(422, f"{msg} {offer.get('closed_note') or ''}".strip())
    name = (payload.get("name") or "").strip()[:160]
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()[:40]
    if not name:
        raise HTTPException(422, "Please give your full name")
    if not email or not EMAIL_RE.match(email):
        raise HTTPException(422, "Please give a valid email so we can send your confirmation")
    if not phone:
        raise HTTPException(422, "Please give a phone number so we can reach you about your order")
    date = (payload.get("date") or "").strip()[:10] or (offer.get("date") or "")
    if date not in {d["date"] for d in open_dates(offer, private=private)}:
        raise HTTPException(422, "That day isn't open for orders. Pick one of the dates offered.")
    fulfilment = payload.get("fulfilment") or "collection"
    slot_label, slot_id, address = "", "", ""
    if fulfilment == "collection" and not payload.get("slot_id") and len(offer.get("slots") or []) == 1:
        payload = {**payload, "slot_id": offer["slots"][0]["id"]}   # one collection point: nothing to choose
    if fulfilment == "delivery":
        if not (offer.get("delivery") or {}).get("enabled"):
            raise HTTPException(422, "Delivery isn't offered")
        address = (payload.get("delivery_address") or "").strip()[:400]
        if not address:
            raise HTTPException(422, "Give the delivery address and postcode")
        slot_label = "Delivery (confirmed by WhatsApp)"
    else:
        fulfilment = "collection"
        slot = next((s for s in offer.get("slots") or [] if s["id"] == payload.get("slot_id")), None)
        if not slot:
            raise HTTPException(422, "Choose a collection point")
        slot_id, slot_label = slot["id"], slot_text(slot)
    boxes_in = payload.get("boxes") or []
    if not boxes_in or len(boxes_in) > 20:
        raise HTTPException(422, "Add at least one box (and at most twenty)")
    boxes = [price_box(offer, b) for b in boxes_in]
    subtotal = round(sum(b["price"] for b in boxes), 2)
    return PreOrder(
        user_id=owner.id, public_id=secrets.token_hex(10), offer_slug=offer.get("slug") or "", offer_title=offer.get("title") or "",
        status="pending_payment", customer_name=name, email=email, phone=phone,
        allergies=(payload.get("allergies") or "").strip()[:1000], for_date=date, fulfilment=fulfilment,
        slot_id=slot_id, slot_label=slot_label, delivery_address=address, note=(payload.get("note") or "").strip()[:1000],
        boxes=boxes, subtotal=subtotal, currency=offer.get("currency") or "GBP", via="private" if private else "",
    )


def check_capacity(db: Session, owner: User, order: PreOrder) -> None:
    """A one-off event can cap how many boxes it takes; refuse an order that would go over, saying how many are left."""
    offer = find_offer(owner, order.offer_slug or "")
    cap = int(offer.get("capacity") or 0)
    if not cap:
        return
    left = cap - boxes_taken(db, owner.id, offer, order.for_date)
    if len(order.boxes or []) > left:
        if left <= 0:
            raise HTTPException(422, "Sorry, pre-orders are full. Come down on the night: first come, first served.")
        raise HTTPException(422, f"Sorry, there {'is' if left == 1 else 'are'} only {left} box{'' if left == 1 else 'es'} left to pre-order.")


@public_router.post("/{token}/bank", status_code=201)
def place_bank_order(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """An order paid by bank transfer: recorded as awaiting payment so it shows on the chef's Pre-orders page
    (and in the customer's account), confirmed when the chef marks it paid. Works with no Stripe key at all."""
    owner = _owner(token, db)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"preorder:{ip}", 600) >= 8:
        raise HTTPException(429, "A few orders have come from here already. Please wait a little while.")
    ratelimit.record(f"preorder:{ip}", 600)
    if (payload.get("company") or "").strip():  # honeypot
        return {"ok": True, "public_id": secrets.token_hex(8), "status": "pending_payment"}
    order = build_order(owner, payload)
    check_capacity(db, owner, order)
    order.pay_method = "bank"
    db.add(order)
    db.commit()
    mails = awaiting_emails(owner, order)
    mailer.send_email(mails["chef"]["to"], mails["chef"]["subject"], mails["chef"]["body"])
    mailer.send_email(mails["customer"]["to"], mails["customer"]["subject"], mails["customer"]["body"])
    notify.notify(db, owner, "orders", f"New {order.offer_title} order{' (private link)' if order.via == 'private' else ''} · £{order.subtotal:.2f}",
                  f"{order.customer_name} · {_pretty_date(order.for_date)} · {len(order.boxes or [])} box(es). Paying by bank transfer: mark it paid once it lands.",
                  url="/app/preorders", tag=f"order-{order.public_id}")
    return {"ok": True, "public_id": order.public_id, "status": order.status, "total": order.subtotal}


@public_router.post("/{token}/preview")
def preview_order(token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """A dress rehearsal of a bank-transfer order: validated and priced exactly like a real one, but nothing is
    saved, emailed or charged. Returns the order summary plus the emails the customer WOULD receive (the
    awaiting-payment copy now, the receipt once the chef marks it paid). Powers the site's ?preview=1 mode."""
    owner = _owner(token, db)
    order = build_order(owner, payload)
    order.pay_method = "bank"
    order.public_id = "PREVIEW-" + order.public_id[:6]
    return {
        "ok": True, "preview": True, "summary": _summary(order),
        "emails": {"awaiting": awaiting_emails(owner, order)["customer"], "receipt": receipt_emails(owner, order)["customer"]},
    }


@public_router.post("/{token}", status_code=201)
def place_order(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    owner = _owner(token, db)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"preorder:{ip}", 600) >= 8:
        raise HTTPException(429, "A few orders have come from here already. Please wait a little while.")
    ratelimit.record(f"preorder:{ip}", 600)
    if (payload.get("company") or "").strip():  # honeypot
        return {"ok": True, "public_id": secrets.token_hex(8), "status": "pending_payment", "url": ""}
    offer = find_offer(owner, payload.get("offer") or "")
    if payload.get("key"):
        raise HTTPException(422, "Orders through this link are paid by bank transfer.")
    if payments_for(owner, offer) != "stripe":
        raise HTTPException(503, "Card payment isn't switched on for this order page yet. Pay by bank transfer instead.")

    order = build_order(owner, payload)
    check_capacity(db, owner, order)
    order.pay_method = "stripe"
    db.add(order)
    db.flush()
    boxes, subtotal = order.boxes, order.subtotal
    path = re.sub(r"[^a-z0-9-]", "", str(offer.get("path") or "cleandream").lower()) or "cleandream"

    return_url = (payload.get("return_url") or "").strip()
    if not return_url.startswith(("http://", "https://")):
        return_url = config.APP_URL
    return_url = return_url.rstrip("/")
    stripe = _stripe()
    line_items = [{
        "price_data": {"currency": order.currency.lower(),
                       "product_data": {"name": f"{offer.get('title')} · {b['item']} for {b['for']}", "description": b["summary"][:500] or None},
                       "unit_amount": int(round(b["price"] * 100))},
        "quantity": 1,
    } for b in boxes]
    session = stripe.checkout.Session.create(
        mode="payment", line_items=line_items, customer_email=order.email,
        success_url=f"{return_url}/{path}/confirmed?order={order.public_id}&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{return_url}/{path}?cancelled={order.public_id}",
        metadata={"preorder_id": str(order.id), "public_id": order.public_id, "offer": offer.get("slug") or ""},
        payment_intent_data={"description": f"{offer.get('title')} pre-order {order.public_id} · {order.customer_name}"},
    )
    order.stripe_session_id = session.id
    db.commit()
    return {"ok": True, "public_id": order.public_id, "status": order.status, "total": subtotal, "url": session.url}



# ── Chef side ─────────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_orders(from_date: str = "", to_date: str = "", db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    # Card orders still marked unpaid: ask Stripe now, so a payment whose confirmation never arrived shows as paid.
    if payments_enabled():
        stuck = (db.query(PreOrder).filter(PreOrder.user_id == ws_id(user), PreOrder.status == "pending_payment",
                                           PreOrder.pay_method != "bank", PreOrder.stripe_session_id != "")
                 .order_by(PreOrder.created_at.desc()).limit(15).all())
        for o in stuck:
            try:
                settle_session(db, o.stripe_session_id, o.public_id)
            except Exception:
                db.rollback()
    q = db.query(PreOrder).filter(PreOrder.user_id == ws_id(user))
    if from_date:
        q = q.filter(PreOrder.for_date >= from_date[:10])
    if to_date:
        q = q.filter(PreOrder.for_date <= to_date[:10])
    rows = q.order_by(PreOrder.for_date.asc(), PreOrder.created_at.asc()).all()
    return [{**_summary(o), "id": o.id, "pay_method": o.pay_method or "stripe", "phone": o.phone, "email": o.email, "allergies": o.allergies, "note": o.note,
             "paid_at": o.paid_at.isoformat() if o.paid_at else None, "booking_id": o.booking_id,
             "boxes": [{**b} for b in o.boxes or []]} for o in rows]


@router.patch("/{order_id}")
def update_order(order_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    order = db.query(PreOrder).filter(PreOrder.id == order_id, PreOrder.user_id == ws_id(user)).first()
    if not order:
        raise HTTPException(404, "Order not found")
    status = payload.get("status")
    if status not in ("paid", "collected", "cancelled", "refunded"):
        raise HTTPException(422, "Unknown status")
    if order.status == "pending_payment" and status == "paid":
        if order.pay_method != "bank":
            raise HTTPException(422, "This order hasn't been paid")
        mark_paid(db, order, payment_intent="bank-transfer")  # confirms the booking + emails, idempotent
        db.commit()
        return _summary(order)
    if order.status == "pending_payment" and status != "cancelled":
        raise HTTPException(422, "This order hasn't been paid")
    order.status = status
    db.commit()
    return _summary(order)


@router.get("/{order_id}/receipt-preview")
def receipt_preview(order_id: int, db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    """What marking this order paid will send the customer (and the chef), before it goes."""
    order = db.query(PreOrder).filter(PreOrder.id == order_id, PreOrder.user_id == ws_id(user)).first()
    if not order:
        raise HTTPException(404, "Order not found")
    owner = db.get(User, ws_id(user))
    mails = receipt_emails(owner, order)
    return {"will_send": order.status == "pending_payment" and order.pay_method == "bank", "status": order.status,
            "receipt_url": receipt_url(order, preview=order.status == "pending_payment"), **mails}


@router.get("/offer")
def get_my_offer(db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    owner = db.get(User, ws_id(user))
    return {"offer": offer_for(owner), "is_default": not bool((owner.preorder_offer or {}).get("items")),
            "dates": open_dates(offer_for(owner)), "payments": payments_for(owner, offer_for(owner)),
            "template": DEFAULT_OFFER, "token": owner.enquiry_token}


# ── Order pages (the main one plus one-off events) ─────────────────────────────────────────────────

def _page(db: Session, owner: User, offer: dict, main: bool) -> dict:
    pub = public_offer(db, owner, offer)
    return {"slug": offer.get("slug") or "", "title": offer.get("title") or "", "kind": offer.get("kind") or ("lunch" if main else "popup"),
            "main": main, "path": offer.get("path") or ("cleandream" if main else ""), "date": offer.get("date") or "",
            "closes": str(offer.get("closes") or "")[:16], "closes_text": pub.get("closes_text", ""), "state": pub["state"],
            "pay": offer.get("pay", "card"), "payments": pub["payments"], "capacity": int(offer.get("capacity") or 0),
            "boxes_left": pub.get("boxes_left"), "paused": bool(offer.get("paused")),
            "slot": (offer.get("slots") or [{}])[0], "collect_note": offer.get("collect_note") or "",
            "items": [{"id": i["id"], "name": i["name"], "price": i.get("price") or 0} for i in offer.get("items") or []],
            "private_key": offer.get("private_key") or "", "private_state": offer_state(offer, private=True),
            "offer": public_copy(offer)}


@router.get("/offers")
def list_pages(db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    owner = db.get(User, ws_id(user))
    main = offer_for(owner)
    return {"pages": [_page(db, owner, main, True)] + [_page(db, owner, o, False) for o in extra_offers(owner) if o.get("slug") != main.get("slug")],
            "card_ready": card_ready(owner), "stripe_key": bool(stripe_key()), "stripe_account": stripe_account(),
            "token": owner.enquiry_token,
            "templates": [{"id": "soulfood", "title": SOULFOOD_OFFER["title"], "added": any(o.get("slug") == SOULFOOD_OFFER["slug"] for o in extra_offers(owner))}]}


def _clean_offer(offer: dict) -> dict:
    if not isinstance(offer.get("items"), list) or not offer["items"]:
        raise HTTPException(422, "The offer needs at least one menu item")
    for item in offer["items"]:
        if not item.get("id") or not item.get("name"):
            raise HTTPException(422, "Every item needs an id and a name")
        for g in item.get("groups") or []:
            if not g.get("id") or not g.get("label") or not isinstance(g.get("options"), list):
                raise HTTPException(422, f"Group on '{item['name']}' needs an id, a label and options")
    if offer.get("delivery") and not isinstance(offer["delivery"], dict):
        raise HTTPException(422, "Delivery must be an object")
    return dict(offer)


@router.put("/offers/{slug}")
def save_page(slug: str, payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    """Change an order page. The everyday settings come as plain fields (where and when you collect, when pre-orders close,
    card or bank transfer, a box limit, pause); {offer: {...}} replaces the whole menu (the advanced editor)."""
    if user.role == "staff":
        raise HTTPException(403, "Only the business owner can change order pages")
    owner = db.get(User, ws_id(user))
    main = offer_for(owner)
    is_main = slug == (main.get("slug") or "")
    extras = [dict(o) for o in (owner.preorder_offers or []) if isinstance(o, dict)]
    idx = next((i for i, o in enumerate(extras) if o.get("slug") == slug), None)
    if not is_main and idx is None:
        raise HTTPException(404, "That order page isn't here")
    cur = copy.deepcopy(main if is_main else extras[idx])
    if isinstance(payload.get("offer"), dict):
        keep = cur.get("private_key")
        cur = _clean_offer({**payload["offer"], "slug": slug})
        if keep:
            cur["private_key"] = keep          # the advanced editor never sees the code, so it can't wipe it
    if payload.get("private_link") == "new":
        cur["private_key"] = secrets.token_urlsafe(9)      # a fresh code: any earlier private link stops working
    elif payload.get("private_link") == "off":
        cur.pop("private_key", None)
    if payload.get("pay") in ("card", "bank"):
        cur["pay"] = payload["pay"]
    if "paused" in payload:
        cur["paused"] = bool(payload["paused"])
    if "capacity" in payload:
        try:
            cur["capacity"] = max(0, min(5000, int(payload.get("capacity") or 0)))
        except (TypeError, ValueError):
            raise HTTPException(422, "The box limit should be a number")
    if "closes" in payload and cur.get("date"):
        v = str(payload.get("closes") or "").strip()[:16]
        if v:
            try:
                datetime.fromisoformat(v)
            except ValueError:
                raise HTTPException(422, "Give the closing date and time")
        cur["closes"] = v
    if "date" in payload and cur.get("date"):
        try:
            cur["date"] = _date.fromisoformat(str(payload["date"])[:10]).isoformat()
        except ValueError:
            raise HTTPException(422, "Give the date of the event")
    if ("place" in payload or "time" in payload) and cur.get("slots"):
        slot = dict(cur["slots"][0])
        if "place" in payload:
            slot["place"] = str(payload.get("place") or "").strip()[:200]
        if "time" in payload:
            slot["time"] = str(payload.get("time") or "").strip()[:60]
        cur["slots"] = [slot] + list(cur["slots"][1:])
    if "collect_note" in payload:
        cur["collect_note"] = str(payload.get("collect_note") or "").strip()[:600]
    if is_main:
        owner.preorder_offer = cur
    else:
        extras[idx] = cur
        owner.preorder_offers = extras
    db.commit()
    return _page(db, owner, cur, is_main)


@router.post("/offers")
def add_page(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    """Add an order page from a template (a pop-up). The copy is the chef's to change."""
    if user.role == "staff":
        raise HTTPException(403, "Only the business owner can add order pages")
    owner = db.get(User, ws_id(user))
    if payload.get("template") != "soulfood":
        raise HTTPException(422, "Unknown template")
    extras = [dict(o) for o in (owner.preorder_offers or []) if isinstance(o, dict)]
    if any(o.get("slug") == SOULFOOD_OFFER["slug"] for o in extras):
        raise HTTPException(422, "That pop-up is already one of your order pages")
    extras.append(copy.deepcopy(SOULFOOD_OFFER))
    owner.preorder_offers = extras
    db.commit()
    return _page(db, owner, extras[-1], False)


def apply_owner_offers(db: Session) -> bool:
    """The business owner's own order pages (The Creatiste Catering, on the platform owner's account only):
    the Soulfood Friday 2.0 pop-up until its night has passed, and Clean Dream kept on bank transfer as she asked
    (once; she can switch it to card on the Pre-orders page). When SOULFOOD_OFFER["rev"] goes up, its menu and closing
    time are pushed onto her saved copy once; her place, time, payment choice, box limit and pause are kept."""
    owner = db.query(User).filter(User.email == config.ADMIN_EMAIL.lower(), User.role == "admin").first()
    if not owner:
        return False
    changed = False
    extras = [dict(o) for o in (owner.preorder_offers or []) if isinstance(o, dict)]
    idx = next((i for i, o in enumerate(extras) if o.get("slug") == SOULFOOD_OFFER["slug"]), None)
    if idx is None and SOULFOOD_OFFER["date"] >= datetime.now(_tz()).date().isoformat():
        extras.append(copy.deepcopy(SOULFOOD_OFFER))
        owner.preorder_offers = extras
        changed = True
    elif idx is not None and int(extras[idx].get("rev") or 1) < SOULFOOD_OFFER["rev"]:
        cur = extras[idx]
        upd = {k: copy.deepcopy(SOULFOOD_OFFER[k]) for k in ("items", "closes", "allergens_note", "rev")}
        # rev 3: the time and place were announced. Fill them in unless she has already typed her own.
        slot = dict((cur.get("slots") or [{}])[0])
        if not slot.get("place") or "to be announced" in slot.get("place", ""):
            slot["place"] = SOULFOOD_OFFER["slots"][0]["place"]
        if not slot.get("time"):
            slot["time"] = SOULFOOD_OFFER["slots"][0]["time"]
        if slot.get("id"):
            upd["slots"] = [slot] + list((cur.get("slots") or [])[1:])
        if "announced on our" in (cur.get("collect_note") or ""):
            upd["collect_note"] = SOULFOOD_OFFER["collect_note"]
        extras[idx] = {**cur, **upd}
        owner.preorder_offers = extras
        changed = True
    main = dict(owner.preorder_offer or {})
    if "pay" not in main:
        owner.preorder_offer = {**(main if main.get("items") else copy.deepcopy(DEFAULT_OFFER)), "pay": "bank"}
        changed = True
    if changed:
        db.commit()
    return changed


@router.put("/offer")
def save_my_offer(payload: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    owner = db.get(User, ws_id(user))
    offer = payload.get("offer") if isinstance(payload.get("offer"), dict) else payload
    if not isinstance(offer.get("items"), list) or not offer["items"]:
        raise HTTPException(422, "The offer needs at least one menu item")
    for item in offer["items"]:
        if not item.get("id") or not item.get("name"):
            raise HTTPException(422, "Every item needs an id and a name")
        for g in item.get("groups") or []:
            if not g.get("id") or not g.get("label") or not isinstance(g.get("options"), list):
                raise HTTPException(422, f"Group on '{item['name']}' needs an id, a label and options")
    if offer.get("delivery") and not isinstance(offer["delivery"], dict):
        raise HTTPException(422, "Delivery must be an object")
    keep = {k: (owner.preorder_offer or {})[k] for k in ("pay",) if k in (owner.preorder_offer or {}) and k not in offer}
    owner.preorder_offer = {**dict(offer), **keep}  # fresh object so SQLAlchemy persists the JSON
    db.commit()
    return {"offer": owner.preorder_offer, "dates": open_dates(owner.preorder_offer)}
