from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .auth import hash_password
from .database import Base, SessionLocal, engine, ensure_columns
from .models import PlatformSettings, User
from fastapi import Depends

from .auth import require_owner, require_plan
from .routers import admin, ai, auth_router, billing, bookings, core, dashboard, finance, public, quotes, support, team, uploads

app = FastAPI(title="The Creatiste Command", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api"
app.include_router(auth_router.router, prefix=API)
app.include_router(billing.router, prefix=API)
app.include_router(admin.router, prefix=API)
app.include_router(dashboard.router, prefix=API)
app.include_router(ai.router, prefix=API)
app.include_router(uploads.router, prefix=API)
app.include_router(bookings.router, prefix=f"{API}/bookings", tags=["bookings"])
app.include_router(core.recipes, prefix=f"{API}/recipes", tags=["recipes"])
app.include_router(core.inventory, prefix=f"{API}/inventory", tags=["inventory"])
app.include_router(core.clients, prefix=f"{API}/clients", tags=["clients"])
app.include_router(core.ideas, prefix=f"{API}/ideas", tags=["ideas"])
app.include_router(core.designs, prefix=f"{API}/designs", tags=["designs"])
app.include_router(core.orders, prefix=f"{API}/orders", tags=["orders"])
app.include_router(core.shopping, prefix=f"{API}/shopping", tags=["shopping"])
app.include_router(core.tasks, prefix=f"{API}/tasks", tags=["tasks"])
app.include_router(core.routes, prefix=f"{API}/routes", tags=["routes"])
app.include_router(core.appointments, prefix=f"{API}/appointments", tags=["appointments"])
app.include_router(core.packing, prefix=f"{API}/packing", tags=["packing"])
app.include_router(core.suppliers, prefix=f"{API}/suppliers", tags=["suppliers"])
app.include_router(core.supplier_prices, prefix=f"{API}/supplier-prices", tags=["suppliers"])
app.include_router(team.shifts, prefix=f"{API}/shifts", tags=["team"])
app.include_router(team.router, prefix=API)
app.include_router(quotes.router, prefix=f"{API}/quotes", tags=["quotes"])
app.include_router(public.router, prefix=API)
app.include_router(support.router, prefix=API)
# Money is owner-only (staff never see finance) and part of the Pro tier upward
_money = [Depends(require_owner), Depends(require_plan(2))]
app.include_router(finance.invoices, prefix=f"{API}/invoices", tags=["finance"], dependencies=_money)
app.include_router(finance.expenses, prefix=f"{API}/expenses", tags=["finance"], dependencies=_money)
app.include_router(finance.router, prefix=f"{API}/finance", tags=["finance"], dependencies=_money)

app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"ok": True, "app": "The Creatiste Command"}


@app.on_event("startup")
def bootstrap():
    import json
    import uuid

    Base.metadata.create_all(bind=engine)
    ensure_columns()
    db = SessionLocal()
    try:
        settings = db.get(PlatformSettings, 1)
        if settings and "Mise" not in json.dumps(settings.plans):
            settings.plans = config.DEFAULT_PLANS  # roll plans forward to v2 feature lists
        for owner in db.query(User).filter(User.role.in_(["chef", "admin"])).all():
            if not owner.enquiry_token:
                owner.enquiry_token = uuid.uuid4().hex
        if not db.get(PlatformSettings, 1):
            db.add(PlatformSettings(id=1, currency=config.DEFAULT_CURRENCY, trial_days=config.DEFAULT_TRIAL_DAYS, plans=config.DEFAULT_PLANS))
        if not db.query(User).filter(User.email == config.ADMIN_EMAIL.lower()).first():
            db.add(User(
                email=config.ADMIN_EMAIL.lower(),
                password_hash=hash_password(config.ADMIN_PASSWORD),
                name=config.ADMIN_NAME,
                role="admin",
                subscription_status="active",
            ))
        db.commit()
    finally:
        db.close()


# --- Serve the built frontend (single-process deploys) -------------------------------------
if config.FRONTEND_DIST.exists():
    assets = config.FRONTEND_DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith(("api/", "uploads/")):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = config.FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(config.FRONTEND_DIST / "index.html")
