"""Client-facing quotes: owner drafts a quote, sends a public approval link, the client
approves or declines from their phone — no login needed on their side."""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config, mailer
from ..auth import require_owner, require_plan
from ..database import get_db
from ..models import Client, Invoice, Quote
from ..utils import crud_router, get_owned, log_activity, next_doc_number, to_dict, ws_id

QUOTE_PLAN = 3  # Elite Kitchen

router = crud_router(
    Quote, required=(), search_fields=("number", "title", "notes"),
    default_order=lambda m: [m.created_at.desc()], min_plan=QUOTE_PLAN,
)
# Money stays owner-only on top of the plan gate
router.dependencies.append(Depends(require_owner))


@router.get("/meta/next-number")
def next_quote_number(db: Session = Depends(get_db), user=Depends(require_owner)):
    return {"number": next_doc_number(db, Quote, ws_id(user), user.quote_prefix)}


@router.post("/{quote_id}/send")
def send_quote(quote_id: int, db: Session = Depends(get_db), user=Depends(require_owner)):
    quote = get_owned(db, Quote, quote_id, ws_id(user))
    if not quote.public_token:
        quote.public_token = uuid.uuid4().hex
    if not quote.valid_until:
        quote.valid_until = (date.today() + timedelta(days=14)).isoformat()
    quote.status = "sent"
    log_activity(db, user, "updated", quote, summary=f"Sent quote {quote.number or quote.id}")
    db.commit()
    db.refresh(quote)
    link = f"{config.APP_URL}/q/{quote.public_token}"
    client = db.get(Client, quote.client_id) if quote.client_id else None
    if client and client.user_id == ws_id(user) and client.email:
        mailer.send_email(
            client.email, f"Your quote from {user.business_name or user.name}",
            f"Hi {client.name},\n\nYour quote {quote.number} is ready to review and approve online:\n{link}\n\n"
            f"Valid until {quote.valid_until}.\n\n{user.business_name or user.name}",
        )
    return {**to_dict(quote), "public_url": link}


@router.post("/{quote_id}/to-invoice", status_code=201)
def quote_to_invoice(quote_id: int, db: Session = Depends(get_db), user=Depends(require_owner)):
    quote = get_owned(db, Quote, quote_id, ws_id(user))
    invoice = Invoice(
        user_id=ws_id(user), booking_id=quote.booking_id, client_id=quote.client_id,
        number=next_doc_number(db, Invoice, ws_id(user), user.invoice_prefix), status="draft",
        issue_date=date.today().isoformat(), items=quote.items,
        tax_rate=quote.tax_rate, discount=quote.discount,
        notes=f"From approved quote {quote.number}".strip(),
    )
    db.add(invoice)
    db.flush()
    log_activity(db, user, "created", invoice, summary=f"Invoice from quote {quote.number or quote.id}")
    db.commit()
    db.refresh(invoice)
    return to_dict(invoice)
