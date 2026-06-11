"""Support requests: stored as tickets (visible in platform admin) and emailed to
SUPPORT_EMAIL — swap that env var for your own domain's inbox whenever you're ready."""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config, mailer
from ..auth import get_current_user
from ..database import get_db
from ..models import SupportTicket

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/request", status_code=201)
def create_request(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    subject = (payload.get("subject") or "").strip()
    message = (payload.get("message") or "").strip()
    if not subject or not message:
        raise HTTPException(422, "Give your request a subject and a message")
    ticket = SupportTicket(
        user_id=user.id, email=user.email, name=user.name or user.business_name or "",
        subject=subject[:300], message=message[:5000],
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    mailer.send_email(
        config.SUPPORT_EMAIL, f"[Support #{ticket.id}] {subject}",
        f"From: {ticket.name} <{ticket.email}>\nPlan/business: {user.business_name or '-'}\n\n{message}\n\n"
        f"— The Creatiste Command support",
    )
    return {"ok": True, "ticket_id": ticket.id}
