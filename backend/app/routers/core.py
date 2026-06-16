"""CRUD routers for the chef workspace modules, built on the shared factory."""
from fastapi import Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_active
from ..database import get_db
from ..models import (
    Appointment, Client, ClientReview, Design, Idea, InventoryItem, Menu, OnlineOrder,
    PackingList, Recipe, RoutePlan, ShoppingList, Supplier, SupplierPrice, Task,
)
from sqlalchemy.orm.attributes import flag_modified

from ..utils import crud_router, get_owned, log_activity, to_dict, ws_id

recipes = crud_router(Recipe, required=("title",), search_fields=("title", "category", "cuisine"))
menus = crud_router(Menu, required=("title",), search_fields=("title", "menu_type", "description"),
                    default_order=lambda m: [m.active.desc(), m.created_at.desc()])
inventory = crud_router(
    InventoryItem, required=("name",), search_fields=("name", "category", "supplier"),
    default_order=lambda m: [m.name.asc()],
)
clients = crud_router(Client, required=("name",), search_fields=("name", "company", "email"),
                      default_order=lambda m: [m.name.asc()], min_plan=2)
ideas = crud_router(Idea, required=(), search_fields=("title", "content"),
                    default_order=lambda m: [m.pinned.desc(), m.created_at.desc()])
designs = crud_router(Design, required=("title",), search_fields=("title",), min_plan=2)
orders = crud_router(OnlineOrder, required=("supplier",), search_fields=("supplier", "order_ref", "items_summary"),
                     default_order=lambda m: [m.expected_date.asc(), m.created_at.desc()], min_plan=2)
shopping = crud_router(ShoppingList, required=("title",), search_fields=("title",),
                       default_order=lambda m: [m.status.asc(), m.shop_date.asc()])
tasks = crud_router(Task, required=("title",), search_fields=("title", "description"),
                    default_order=lambda m: [m.status.asc(), m.due_date.asc(), m.sort_order.asc()])
routes = crud_router(RoutePlan, required=("title",), search_fields=("title",),
                     default_order=lambda m: [m.date.asc()], min_plan=2)
appointments = crud_router(Appointment, required=("title",), search_fields=("title", "location"),
                           default_order=lambda m: [m.date.asc(), m.start_time.asc()], min_plan=2)
packing = crud_router(PackingList, required=("title",), search_fields=("title",),
                      default_order=lambda m: [m.created_at.desc()])
suppliers = crud_router(Supplier, required=("name",), search_fields=("name", "category", "contact_name"),
                        default_order=lambda m: [m.name.asc()], min_plan=2)
supplier_prices = crud_router(SupplierPrice, required=("item_name",), search_fields=("item_name",),
                              default_order=lambda m: [m.item_name.asc()], min_plan=2)


# --- Client reviews (nested under clients) -------------------------------------------------
@clients.get("/{client_id}/reviews")
def list_reviews(client_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    get_owned(db, Client, client_id, ws_id(user))
    rows = (
        db.query(ClientReview)
        .filter(ClientReview.user_id == ws_id(user), ClientReview.client_id == client_id)
        .order_by(ClientReview.created_at.desc())
        .all()
    )
    return [to_dict(r) for r in rows]


@clients.post("/{client_id}/reviews", status_code=201)
def add_review(client_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    get_owned(db, Client, client_id, ws_id(user))
    rating = int(payload.get("rating") or 5)
    if not 1 <= rating <= 5:
        raise HTTPException(422, "Rating must be 1-5")
    review = ClientReview(
        user_id=ws_id(user), client_id=client_id, rating=rating,
        comment=payload.get("comment") or "", date=payload.get("date") or "",
        booking_id=payload.get("booking_id"),
    )
    db.add(review)
    db.commit()
    return to_dict(review)


@clients.delete("/{client_id}/reviews/{review_id}", status_code=204)
def delete_review(client_id: int, review_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    review = db.get(ClientReview, review_id)
    if not review or review.user_id != ws_id(user) or review.client_id != client_id:
        raise HTTPException(404, "Review not found")
    db.delete(review)
    db.commit()


# --- Shopping list item toggle (fast path for mobile check-offs) ---------------------------
@shopping.post("/{list_id}/toggle")
def toggle_item(list_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    shopping_list = get_owned(db, ShoppingList, list_id, ws_id(user))
    item_id = payload.get("item_id")
    old_items = shopping_list.items or []
    if not any(item.get("id") == item_id for item in old_items):
        raise HTTPException(404, "Item not found")
    # Build NEW dicts: mutating the loaded JSON in place looks unchanged to
    # SQLAlchemy's change detection and is silently never written to the DB.
    shopping_list.items = [
        {**item, "purchased": not item.get("purchased")} if item.get("id") == item_id else item
        for item in old_items
    ]
    flag_modified(shopping_list, "items")
    db.commit()
    db.refresh(shopping_list)
    return to_dict(shopping_list)


# --- Packing list item toggle (mirror of the shopping fast path) ---------------------------
@packing.post("/{list_id}/toggle")
def toggle_packed(list_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    packing_list = get_owned(db, PackingList, list_id, ws_id(user))
    item_id = payload.get("item_id")
    old_items = packing_list.items or []
    if not any(item.get("id") == item_id for item in old_items):
        raise HTTPException(404, "Item not found")
    packing_list.items = [
        {**item, "packed": not item.get("packed")} if item.get("id") == item_id else item
        for item in old_items
    ]
    flag_modified(packing_list, "items")
    log_activity(db, user, "updated", packing_list)
    db.commit()
    db.refresh(packing_list)
    return to_dict(packing_list)


# --- Supplier price search: "who sells X, cheapest first?" ----------------------------------
@suppliers.get("/prices/search")
def search_prices(q: str = "", db: Session = Depends(get_db), user=Depends(require_active)):
    query = db.query(SupplierPrice).filter(SupplierPrice.user_id == ws_id(user))
    if q:
        query = query.filter(SupplierPrice.item_name.ilike(f"%{q}%"))
    rows = query.order_by(SupplierPrice.price.asc()).limit(100).all()
    names = {s.id: s.name for s in db.query(Supplier).filter(Supplier.user_id == ws_id(user)).all()}
    return [{**to_dict(r), "supplier_name": names.get(r.supplier_id, "?")} for r in rows]
