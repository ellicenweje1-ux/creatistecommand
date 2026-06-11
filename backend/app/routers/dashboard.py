"""Single aggregate endpoint powering the home dashboard."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_active
from ..database import get_db
from ..models import Booking, Idea, InventoryItem, OnlineOrder, ShoppingList, Task
from ..utils import to_dict, ws_id
from .finance import invoice_total
from ..models import Expense, Invoice

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), user=Depends(require_active)):
    today = date.today().isoformat()
    horizon = (date.today() + timedelta(days=21)).isoformat()
    soon = (date.today() + timedelta(days=7)).isoformat()
    month_prefix = today[:7]

    upcoming = (
        db.query(Booking)
        .filter(Booking.user_id == ws_id(user), Booking.date >= today, Booking.date <= horizon,
                Booking.status.notin_(["cancelled", "completed"]))
        .order_by(Booking.date.asc()).limit(6).all()
    )
    inventory = db.query(InventoryItem).filter(InventoryItem.user_id == ws_id(user)).all()
    expiring = sorted(
        (i for i in inventory if i.expiry_date and today <= i.expiry_date <= soon),
        key=lambda i: i.expiry_date,
    )[:8]
    expired = [i for i in inventory if i.expiry_date and i.expiry_date < today]
    low_stock = [
        i for i in inventory
        if i.low_stock_threshold and (i.quantity or 0) <= i.low_stock_threshold
    ][:8]

    open_tasks = (
        db.query(Task)
        .filter(Task.user_id == ws_id(user), Task.status != "done")
        .order_by(Task.due_date.asc()).all()
    )
    overdue = [t for t in open_tasks if t.due_date and t.due_date < today]
    due_today = [t for t in open_tasks if t.due_date == today]

    open_lists = (
        db.query(ShoppingList)
        .filter(ShoppingList.user_id == ws_id(user), ShoppingList.status == "open")
        .order_by(ShoppingList.shop_date.asc()).all()
    )
    lists_payload = []
    for sl in open_lists[:5]:
        items = sl.items or []
        done = sum(1 for i in items if i.get("purchased"))
        lists_payload.append({**to_dict(sl), "total_items": len(items), "purchased_items": done})

    in_transit = (
        db.query(OnlineOrder)
        .filter(OnlineOrder.user_id == ws_id(user), OnlineOrder.status.in_(["ordered", "shipped", "delayed"]))
        .order_by(OnlineOrder.expected_date.asc()).limit(6).all()
    )

    invs = db.query(Invoice).filter(Invoice.user_id == ws_id(user)).all()
    month_paid = sum(invoice_total(i) for i in invs if i.status == "paid" and (i.paid_date or "").startswith(month_prefix))
    outstanding = sum(invoice_total(i) for i in invs if i.status in ("sent", "overdue"))
    exps = db.query(Expense).filter(Expense.user_id == ws_id(user)).all()
    month_expenses = sum(e.amount or 0 for e in exps if (e.date or "").startswith(month_prefix))

    pinned_ideas = (
        db.query(Idea).filter(Idea.user_id == ws_id(user), Idea.pinned.is_(True))
        .order_by(Idea.updated_at.desc()).limit(4).all()
    )

    return {
        "today": today,
        "upcoming_bookings": [to_dict(b) for b in upcoming],
        "expiring": [to_dict(i) for i in expiring],
        "expired_count": len(expired),
        "low_stock": [to_dict(i) for i in low_stock],
        "tasks": {
            "open": len(open_tasks),
            "overdue": len(overdue),
            "due_today": len(due_today),
            "next": [to_dict(t) for t in (overdue + due_today + [t for t in open_tasks if t.due_date and t.due_date > today])[:7]],
        },
        "shopping_lists": lists_payload,
        "orders_in_transit": [to_dict(o) for o in in_transit],
        "finance": {
            "month_paid": round(month_paid, 2),
            "outstanding": round(outstanding, 2),
            "month_expenses": round(month_expenses, 2),
        },
        "pinned_ideas": [to_dict(i) for i in pinned_ideas],
    }
