"""Bookings + the aggregated workspace payload used by the booking detail screen."""
from fastapi import Depends
from sqlalchemy.orm import Session

from ..auth import require_active
from ..database import get_db
from ..models import (
    Booking, Client, Design, Expense, Invoice, OnlineOrder, PackingList, Quote, RoutePlan, ShoppingList, Task,
)
from ..utils import crud_router, get_owned, to_dict, ws_id

router = crud_router(
    Booking, required=("title",), search_fields=("title", "venue_name", "event_type"),
    default_order=lambda m: [m.date.asc()],
)


@router.get("/{booking_id}/workspace")
def workspace(booking_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    booking = get_owned(db, Booking, booking_id, ws_id(user))

    def linked(model, order):
        return [
            to_dict(o)
            for o in db.query(model)
            .filter(model.user_id == ws_id(user), model.booking_id == booking_id)
            .order_by(order)
            .all()
        ]

    client = db.get(Client, booking.client_id) if booking.client_id else None
    if client and client.user_id != ws_id(user):
        client = None
    return {
        "booking": to_dict(booking),
        "client": to_dict(client) if client else None,
        "shopping_lists": linked(ShoppingList, ShoppingList.created_at.asc()),
        "tasks": linked(Task, Task.due_date.asc()),
        "orders": linked(OnlineOrder, OnlineOrder.expected_date.asc()),
        "routes": linked(RoutePlan, RoutePlan.date.asc()),
        "designs": linked(Design, Design.created_at.asc()),
        "packing_lists": linked(PackingList, PackingList.created_at.asc()),
        "quotes": linked(Quote, Quote.created_at.asc()),
        "invoices": linked(Invoice, Invoice.created_at.asc()),
        "expenses": linked(Expense, Expense.date.asc()),
    }
