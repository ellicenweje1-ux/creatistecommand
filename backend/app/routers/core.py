"""CRUD routers for the chef workspace modules, built on the shared factory."""
from fastapi import Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_active
from ..database import get_db
from ..models import (
    Client, ClientReview, Design, Idea, InventoryItem, OnlineOrder,
    Recipe, RoutePlan, ShoppingList, Task,
)
from ..utils import crud_router, get_owned, to_dict

recipes = crud_router(Recipe, required=("title",), search_fields=("title", "category", "cuisine"))
inventory = crud_router(
    InventoryItem, required=("name",), search_fields=("name", "category", "supplier"),
    default_order=lambda m: [m.name.asc()],
)
clients = crud_router(Client, required=("name",), search_fields=("name", "company", "email"),
                      default_order=lambda m: [m.name.asc()])
ideas = crud_router(Idea, required=(), search_fields=("title", "content"),
                    default_order=lambda m: [m.pinned.desc(), m.created_at.desc()])
designs = crud_router(Design, required=("title",), search_fields=("title",))
orders = crud_router(OnlineOrder, required=("supplier",), search_fields=("supplier", "order_ref", "items_summary"),
                     default_order=lambda m: [m.expected_date.asc(), m.created_at.desc()])
shopping = crud_router(ShoppingList, required=("title",), search_fields=("title",),
                       default_order=lambda m: [m.status.asc(), m.shop_date.asc()])
tasks = crud_router(Task, required=("title",), search_fields=("title", "description"),
                    default_order=lambda m: [m.status.asc(), m.due_date.asc(), m.sort_order.asc()])
routes = crud_router(RoutePlan, required=("title",), search_fields=("title",),
                     default_order=lambda m: [m.date.asc()])


# --- Client reviews (nested under clients) -------------------------------------------------
@clients.get("/{client_id}/reviews")
def list_reviews(client_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    get_owned(db, Client, client_id, user.id)
    rows = (
        db.query(ClientReview)
        .filter(ClientReview.user_id == user.id, ClientReview.client_id == client_id)
        .order_by(ClientReview.created_at.desc())
        .all()
    )
    return [to_dict(r) for r in rows]


@clients.post("/{client_id}/reviews", status_code=201)
def add_review(client_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    get_owned(db, Client, client_id, user.id)
    rating = int(payload.get("rating") or 5)
    if not 1 <= rating <= 5:
        raise HTTPException(422, "Rating must be 1-5")
    review = ClientReview(
        user_id=user.id, client_id=client_id, rating=rating,
        comment=payload.get("comment") or "", date=payload.get("date") or "",
        booking_id=payload.get("booking_id"),
    )
    db.add(review)
    db.commit()
    return to_dict(review)


@clients.delete("/{client_id}/reviews/{review_id}", status_code=204)
def delete_review(client_id: int, review_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    review = db.get(ClientReview, review_id)
    if not review or review.user_id != user.id or review.client_id != client_id:
        raise HTTPException(404, "Review not found")
    db.delete(review)
    db.commit()


# --- Shopping list item toggle (fast path for mobile check-offs) ---------------------------
@shopping.post("/{list_id}/toggle")
def toggle_item(list_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    shopping_list = get_owned(db, ShoppingList, list_id, user.id)
    item_id = payload.get("item_id")
    items = list(shopping_list.items or [])
    for item in items:
        if item.get("id") == item_id:
            item["purchased"] = not item.get("purchased")
            break
    else:
        raise HTTPException(404, "Item not found")
    shopping_list.items = items
    db.commit()
    return to_dict(shopping_list)
