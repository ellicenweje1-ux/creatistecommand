"""Invoices, expenses and finance reporting."""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_active
from ..database import get_db
from ..models import Expense, Invoice
from ..utils import crud_router, to_dict, ws_id

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


@router.get("/next-invoice-number")
def next_invoice_number(db: Session = Depends(get_db), user=Depends(require_active)):
    year = date.today().year
    count = db.query(Invoice).filter(Invoice.user_id == ws_id(user)).count()
    return {"number": f"INV-{year}-{count + 1:03d}"}
