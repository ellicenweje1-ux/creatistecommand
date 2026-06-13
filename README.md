# The Creatiste Command

**The command centre for private chefs & caterers** — bookings, recipes, inventory, shopping runs, prep plans, supplier orders, clients, floor plans, ideas and finances in one place, built to be used on the move.

Chefs pay a **one-time onboarding fee + monthly subscription** to join; you (the platform owner) manage them, the pricing and the revenue from a built-in admin dashboard.

---

## What's inside

| Module | What it does |
|---|---|
| **Dashboard** | Today at a glance: upcoming bookings, overdue tasks, expiring stock, low stock, shopping progress, deliveries in transit, money in/out, pinned ideas |
| **Bookings** | Full event pipeline (enquiry → quoted → confirmed → in prep → completed) with list + calendar views, and a per-booking **workspace** that gathers everything below |
| **Menu builder** | Courses & dishes per booking, linkable to recipe sheets, with dietary flags |
| **Recipes** | Master sheets: ingredients, method, allergens, tags, costing & margin, photos |
| **Inventory** | Stock with quantities, units, storage location, **shelf life / expiry alerts** and low-stock thresholds; one-tap +/− adjustments |
| **Shopping** | Lists per booking, items **grouped by shop** (butcher, fishmonger, market, wholesaler…), tap-to-check-off on mobile, estimated cost totals |
| **Online orders** | Track speciality orders: supplier, ref, ETA, tracking link, late-order chase flags |
| **Tasks** | Prep / shopping / admin / service / logistics tasks with priorities, due dates, overdue grouping and per-booking scoping |
| **Route planner** | Ordered prep-day stops with ETAs and purposes — **opens the whole run in Google Maps** |
| **Clients** | Portfolio with dietary preferences, allergies, likes/dislikes, tags, star reviews and repeat-booking history |
| **Setup designs** | Drag-and-drop SVG floor planner: tables, buffet lines, bar, stations, dance floor — saved per booking |
| **Ideas** | Instant capture (⌘+Enter), pinning, tags |
| **Finance** | Invoices with line items/tax/discount, expenses with receipt uploads, monthly charts, profit, outstanding tracking |
| **Tastings diary** | Tastings, consultations, site visits and calls — linked to clients and bookings |
| **Packing checklists** | Van-load lists per booking with a one-tap standard kit |
| **Allergen matrix** | Dish-by-allergen grid (UK FSA 14) generated from recipe sheets, printable |
| **Supplier price book** | Suppliers + their prices, with cheapest-first item search |
| **Quotes** | Client-facing **approval links** — clients approve/decline from their phone, no login; convert approved quotes to invoices |
| **Public enquiry form** | Shareable branded link that feeds enquiries straight into Bookings (and emails the owner) |
| **Team** | Staff logins scoped to the owner's workspace, rota/shifts, owner-set assignments, and a full **activity audit trail** of every change |
| **Email notifications** | Enquiries, quote responses and staff assignments (SMTP-based, optional) |
| **Mise — AI sous-chef** | Claude-powered, named after *mise en place* (everything in its place before service): generate recipe sheets, **build shopping lists from a booking's menu minus current stock**, draft full prep plans working back from event day, suggest menus from client preferences, polish rough ideas |
| **Admin** | Platform owner only: chef accounts, subscription statuses, plan & pricing editor, trial settings, MRR / revenue / payment history |

## Tech stack

- **Backend** — FastAPI + SQLAlchemy (SQLite by default; any SQLAlchemy URL works), JWT auth (PyJWT + bcrypt), Stripe subscriptions, Anthropic Claude for AI, local object storage for uploads.
- **Frontend** — React 18 + Vite + Tailwind CSS, fully responsive (sidebar on desktop, bottom nav on mobile).
- **One-process deploys** — FastAPI serves the built frontend, so a single `uvicorn` process runs the whole platform.

## Quickstart

```bash
# 1. Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed          # optional: demo chef with rich sample data

# 2. Frontend
cd ../frontend
npm install && npm run build

# 3. Run everything on :8000
cd ../backend
.venv/bin/uvicorn app.main:app --port 8000
```

Or just: `./scripts/start.sh` (production-style) / `./scripts/dev.sh` (hot reload on :5173).

### Default accounts

| Role | Email | Password |
|---|---|---|
| Platform admin | `admin@creatistecommand.com` | `admin12345` |
| Demo chef — owner (after seeding) | `chef@demo.kitchen` | `demo12345` |
| Demo staff member (after seeding) | `staff@demo.kitchen` | `demo12345` |

> ⚠️ **Change the admin password** (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars) before going live.

## Configuration

Copy `.env.example` and fill in what you need. Everything degrades gracefully:

| Variable | Without it | With it |
|---|---|---|
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | **Demo billing mode** — chef activation simulated, full flow testable end-to-end | Real Stripe Checkout charging the onboarding fee + monthly subscription; webhook keeps statuses in sync |
| `ANTHROPIC_API_KEY` (or `EMERGENT_LLM_KEY`) | Mise's buttons return a friendly "not configured" message | Mise, the AI sous-chef (model: `claude-opus-4-8`, configurable via `AI_MODEL`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Email notifications silently off | Enquiry, quote-response and assignment emails |
| `SECRET_KEY` | Auto-generated and persisted for dev | Your own production signing key |

### Stripe setup (when ready to charge for real)

1. Add `STRIPE_SECRET_KEY` (from the Stripe dashboard) and set `APP_URL` to your public URL.
2. Create a webhook endpoint pointing to `https://your-domain/api/billing/webhook` for events
   `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`.
3. Pricing is **not** hardcoded — edit plans, onboarding fees, currency and trial days live in **Admin → Pricing**.

## The business model, wired in

- New chefs register → land on the **onboarding paywall** (no workspace access until activated — enforced server-side with HTTP 402).
- They pick a plan and pay **onboarding fee + first month** in one Stripe Checkout.
- The admin dashboard tracks **MRR, onboarding revenue, total revenue**, chefs by status, and lets you suspend/comp/cancel accounts, record manual payments and adjust pricing without redeploying.
- Optional free-trial period (`Admin → Pricing → trial days`) if you ever want a freemium funnel.

## API

Interactive docs at `http://localhost:8000/docs` (FastAPI/OpenAPI). All workspace endpoints are JWT-protected and owner-scoped; admin endpoints require the admin role.

## Project layout

```
backend/
  app/
    main.py          # app wiring, startup bootstrap, SPA serving
    config.py        # env-driven settings
    models.py        # SQLAlchemy models (all modules)
    auth.py          # bcrypt + JWT + access gates (incl. 402 subscription gate)
    utils.py         # generic owner-scoped CRUD factory, serialization
    seed.py          # demo data (python -m app.seed)
    routers/         # auth, billing, admin, dashboard, bookings, finance, ai, uploads, core CRUD
frontend/
  src/
    pages/           # Landing, Onboarding, Dashboard, Bookings(+workspace), Recipes,
                     # Inventory, Shopping, Orders, Tasks, Routes, Clients, Designs,
                     # Ideas, Finance, Settings, Admin
    ui.jsx           # design system (ink/cream/copper, Fraunces + Outfit)
    api.js, auth.jsx, format.js
scripts/             # dev.sh (hot reload), start.sh (single-process production)
```
