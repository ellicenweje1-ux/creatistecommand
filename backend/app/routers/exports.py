"""CSV exports — 'your data is yours'. Plain CSV any spreadsheet or accountant can open.

Downloads carry the auth token in the header (the frontend uses api.download), so these
are normal authenticated, workspace-scoped endpoints. Finance has its own CSV endpoints
in finance.py (gated owner-only + Pro) using the shared csv_response helper here.
"""
import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import require_active, require_plan
from ..database import get_db
from ..models import Booking, Client
from ..utils import ws_id

router = APIRouter(prefix="/exports", tags=["exports"])


def csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    """Build a downloadable CSV. Excel opens UTF-8 cleanly with a BOM, so prepend one."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow(["" if v is None else v for v in row])
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/clients.csv")
def clients_csv(db: Session = Depends(get_db), user=Depends(require_plan(2))):
    rows = (
        db.query(Client).filter(Client.user_id == ws_id(user)).order_by(Client.name.asc()).all()
    )
    out = [
        [
            c.name, c.company, c.email, c.phone, c.address,
            ", ".join(c.dietary or []), c.allergies, c.likes, c.dislikes,
            ", ".join(c.tags or []), c.notes,
            c.created_at.strftime("%Y-%m-%d") if c.created_at else "",
        ]
        for c in rows
    ]
    return csv_response(
        "creatiste-clients.csv",
        ["Name", "Company", "Email", "Phone", "Address", "Dietary", "Allergies",
         "Likes", "Dislikes", "Tags", "Notes", "Added"],
        out,
    )


@router.get("/bookings.csv")
def bookings_csv(db: Session = Depends(get_db), user=Depends(require_active)):
    rows = (
        db.query(Booking).filter(Booking.user_id == ws_id(user)).order_by(Booking.date.asc()).all()
    )
    names = {c.id: c.name for c in db.query(Client).filter(Client.user_id == ws_id(user)).all()}
    out = [
        [
            b.date, b.start_time, b.end_time, b.title, b.status.replace("_", " "),
            b.event_type, b.menu_type, b.guest_count, b.quoted_price,
            "yes" if b.deposit_paid else "no", names.get(b.client_id, ""),
            b.venue_name, b.venue_address, b.dietary_notes, b.notes,
        ]
        for b in rows
    ]
    return csv_response(
        "creatiste-bookings.csv",
        ["Date", "Start", "End", "Title", "Status", "Event type", "Menu", "Guests",
         "Quoted price", "Deposit paid", "Client", "Venue", "Venue address",
         "Dietary notes", "Notes"],
        out,
    )
