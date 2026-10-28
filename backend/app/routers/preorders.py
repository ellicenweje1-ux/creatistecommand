"""Pre-orders: customers order from a chef's own website (a lunch service, a pop-up) and pay by
card before the order is confirmed. The chef's "offer" (menu with choice groups, collection slots,
delivery policy, order cut-off) lives on their Command account; the public site reads it, and every
order is PRICED HERE from that offer, never from the browser.

Payment goes to the chef's own Stripe account (PREORDER_STRIPE_SECRET_KEY) — deliberately separate
from the platform's subscription billing. Until the key is set, the site shows the menu and offers
WhatsApp/email ordering instead (house pattern: inert until configured).

Paid orders roll up into ONE confirmed Booking per day per offer ("Clean Dream pre-orders"), so they
show on the chef's calendar, dashboard and ICS feed without flooding the diary, and each customer
becomes a Client. Both emails (customer confirmation + chef notification) list every box by name so
labelling is a read-off."""
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config, mailer, ratelimit
from ..auth import require_plan
from ..database import get_db
from ..models import Booking, Client, PreOrder, User
from ..utils import ws_id
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
                             {"name": "Parsley"}, {"name": "Rocket"}]},
                {"id": "sauces", "label": "Sauces", "pick": "optional, 25p each", "min": 0, "max": 4,
                 "options": [{"name": "Hot honey", "surcharge": 0.25}, {"name": "Sriracha", "surcharge": 0.25},
                             {"name": "Balsamic glaze", "surcharge": 0.25}, {"name": "Raspberry balsamic glaze", "surcharge": 0.25}]},
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


def _tz():
    return ZoneInfo(config.ONBOARDING_TZ)


def offer_for(user: User) -> dict:
    o = user.preorder_offer or {}
    return o if o.get("items") else DEFAULT_OFFER


def open_dates(offer: dict, now: datetime | None = None) -> list[dict]:
    """The next bookable days, in the business's local time, honouring the order cut-off."""
    now = now or datetime.now(_tz())
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
    return bool(config.PREORDER_STRIPE_SECRET_KEY)


def _stripe():
    import stripe
    stripe.api_key = config.PREORDER_STRIPE_SECRET_KEY
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
        picked = [str(x) for x in (choices_in.get(g["id"]) or []) if str(x).strip()]
        opts = {o["name"]: o for o in g.get("options") or []}
        unknown = [p for p in picked if p not in opts]
        if unknown:
            raise HTTPException(422, f"'{unknown[0]}' isn't an option for {g['label']}")
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
                price += float(g.get("extra_premium_price") if o.get("premium") else g.get("extra_price") or 0)
        if picked:
            choices[g["id"]] = picked
            summary.append(f"{g['label']}: {', '.join(picked)}")
    return {"item": item["name"], "item_id": item["id"], "for": label, "summary": "; ".join(summary), "choices": choices,
            "note": (box.get("note") or "").strip()[:200], "price": round(price, 2)}


@public_router.get("/{token}")
def get_offer(token: str, db: Session = Depends(get_db)):
    owner = _owner(token, db)
    offer = offer_for(owner)
    return {"offer": offer, "dates": open_dates(offer), "payments": "stripe" if payments_enabled() else "off",
            "business": owner.business_name or owner.name}


def _summary(order: PreOrder) -> dict:
    return {
        "public_id": order.public_id, "status": order.status, "title": order.offer_title, "name": order.customer_name,
        "date": order.for_date, "fulfilment": order.fulfilment, "slot": order.slot_label,
        "delivery_address": order.delivery_address, "total": order.subtotal, "currency": order.currency,
        "boxes": [{"for": b["for"], "item": b["item"], "summary": b["summary"], "price": b["price"]} for b in order.boxes or []],
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

    pretty_date = datetime.strptime(order.for_date, "%Y-%m-%d").strftime("%A %-d %B")
    box_text = "\n".join(f"  • {b['for']}: {b['item']}, {b['summary']}{' [' + b['note'] + ']' if b.get('note') else ''} (£{b['price']:.2f})" for b in order.boxes or [])
    where = order.slot_label + (f"\n  {order.delivery_address}" if order.delivery_address else "")
    biz = owner.business_name or owner.name
    mailer.send_email(
        order.email, f"Payment received: your {order.offer_title} order is confirmed for {pretty_date}",
        f"Hi {order.customer_name},\n\nThank you, your payment has been received and your order is confirmed. This email is your receipt.\n\n"
        f"When: {pretty_date}\nWhere: {where}\n\n{box_text}\n\nTotal paid: £{order.subtotal:.2f}\n"
        + (f"Allergies noted: {order.allergies}\n" if order.allergies else "")
        + ("\nDelivery: we'll message you on WhatsApp to confirm the drop and the mileage fee.\n" if order.fulfilment == "delivery" else "")
        + f"\nOrder reference: {order.public_id}\n\n— {biz}",
    )
    mailer.send_email(
        owner.email, f"[{order.offer_title}] Paid order · {pretty_date} · {len(order.boxes or [])} box(es) · {order.customer_name}",
        f"{order.customer_name} · {order.phone} · {order.email}\nWhen: {pretty_date}\nWhere: {where}\n\n{box_text}\n\n"
        + (f"Allergies: {order.allergies}\n" if order.allergies else "")
        + (f"Note: {order.note}\n" if order.note else "")
        + f"Paid £{order.subtotal:.2f} · ref {order.public_id}\n\nIt's on your Bookings as '{title}' for that day.\n\n— The Creatiste Command",
    )


@public_router.get("/status/{public_id}")
def order_status(public_id: str, db: Session = Depends(get_db)):
    order = db.query(PreOrder).filter(PreOrder.public_id == public_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return _summary(order)


@public_router.post("/confirm")
def confirm(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Called when the customer lands back from Stripe. Works even with no webhook configured."""
    order = db.query(PreOrder).filter(PreOrder.public_id == (payload.get("public_id") or "")).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "pending_payment" and payments_enabled():
        session_id = payload.get("session_id") or order.stripe_session_id
        try:
            session = _stripe().checkout.Session.retrieve(session_id)
        except Exception:
            session = None
        if session and session.get("metadata", {}).get("public_id") == order.public_id and session.get("payment_status") == "paid":
            mark_paid(db, order, session.get("payment_intent") or "")
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
    if event["type"] == "checkout.session.completed":
        data = event["data"]["object"]
        order = db.query(PreOrder).filter(PreOrder.public_id == (data.get("metadata") or {}).get("public_id", "")).first()
        if order and data.get("payment_status") == "paid":
            mark_paid(db, order, data.get("payment_intent") or "")
    return {"ok": True}


def build_order(owner: User, payload: dict) -> PreOrder:
    """Validate a public order payload against the chef's offer and build the (unsaved) PreOrder.
    Shared by the card path (Stripe Checkout) and the bank-transfer path."""
    offer = offer_for(owner)
    name = (payload.get("name") or "").strip()[:160]
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()[:40]
    if not name:
        raise HTTPException(422, "Please give your full name")
    if not email or not EMAIL_RE.match(email):
        raise HTTPException(422, "Please give a valid email so we can send your confirmation")
    if not phone:
        raise HTTPException(422, "Please give a phone number so we can reach you about your order")
    date = (payload.get("date") or "").strip()[:10]
    if date not in {d["date"] for d in open_dates(offer)}:
        raise HTTPException(422, "That day isn't open for orders. Pick one of the dates offered.")
    fulfilment = payload.get("fulfilment") or "collection"
    slot_label, slot_id, address = "", "", ""
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
        slot_id, slot_label = slot["id"], f"{slot['label']} | {slot['place']} @ {slot['time']}"
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
        boxes=boxes, subtotal=subtotal, currency=offer.get("currency") or "GBP",
    )


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
    order.pay_method = "bank"
    db.add(order)
    db.commit()
    lines = "\n".join(f"- {b['for']}: {b['item']} ({b['summary']}) £{b['price']:.2f}" for b in order.boxes)
    where = order.delivery_address if order.fulfilment == "delivery" else order.slot_label
    mailer.send_email(
        owner.email, f"{order.offer_title}: bank-transfer order from {order.customer_name} for {order.for_date} (awaiting payment)",
        f"{order.customer_name} · {order.phone} · {order.email}\nFor {order.for_date} · {where}\n\n{lines}\n\nTotal £{order.subtotal:.2f}\n"
        f"{('Allergies: ' + order.allergies) if order.allergies else ''}\n{('Note: ' + order.note) if order.note else ''}\n\n"
        f"Once the transfer lands, mark it paid under Pre-orders in The Creatiste Command (that confirms the booking and emails the customer).",
    )
    mailer.send_email(
        order.email, f"Your {order.offer_title} order for {order.for_date} (awaiting your bank transfer)",
        f"Hi {order.customer_name},\n\nThank you for your order for {order.for_date}.\n\n{lines}\n\nTotal £{order.subtotal:.2f}\n{where}\n\n"
        f"Please send the bank transfer with your name as the reference. Your order is confirmed once we have sent a receipt of payment "
        f"and the final collection or delivery details by WhatsApp.",
    )
    return {"ok": True, "public_id": order.public_id, "status": order.status, "total": order.subtotal}


@public_router.post("/{token}", status_code=201)
def place_order(request: Request, token: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    owner = _owner(token, db)
    ip = ratelimit.client_ip(request)
    if ratelimit.count(f"preorder:{ip}", 600) >= 8:
        raise HTTPException(429, "A few orders have come from here already. Please wait a little while.")
    ratelimit.record(f"preorder:{ip}", 600)
    if (payload.get("company") or "").strip():  # honeypot
        return {"ok": True, "public_id": secrets.token_hex(8), "status": "pending_payment", "url": ""}
    if not payments_enabled():
        raise HTTPException(503, "Online payment isn't switched on yet. Order by WhatsApp or email instead.")

    order = build_order(owner, payload)
    db.add(order)
    db.flush()
    boxes, subtotal, offer = order.boxes, order.subtotal, offer_for(owner)

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
        success_url=f"{return_url}/cleandream/confirmed?order={order.public_id}&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{return_url}/cleandream?cancelled={order.public_id}",
        metadata={"preorder_id": str(order.id), "public_id": order.public_id},
    )
    order.stripe_session_id = session.id
    db.commit()
    return {"ok": True, "public_id": order.public_id, "status": order.status, "total": subtotal, "url": session.url}



# ── Chef side ─────────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_orders(from_date: str = "", to_date: str = "", db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
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


@router.get("/offer")
def get_my_offer(db: Session = Depends(get_db), user: User = Depends(require_plan(2))):
    owner = db.get(User, ws_id(user))
    return {"offer": offer_for(owner), "is_default": not bool((owner.preorder_offer or {}).get("items")),
            "dates": open_dates(offer_for(owner)), "payments": "stripe" if payments_enabled() else "off",
            "template": DEFAULT_OFFER, "token": owner.enquiry_token}


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
    owner.preorder_offer = dict(offer)  # fresh object so SQLAlchemy persists the JSON
    db.commit()
    return {"offer": owner.preorder_offer, "dates": open_dates(owner.preorder_offer)}
