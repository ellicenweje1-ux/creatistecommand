# CLAUDE.md — project handover & working notes

Read this first in every new session. It replaces lost chat history.

## Latest session (2026-06-12)
- Moved the project onto the owner's own GitHub + Claude Code account (the only
  thing that was on someone else's account was the old Claude history — code and
  Render were already the owner's). Nothing to "transfer": every session reads
  this file automatically, so context carries over.
- Created **`main`** as the canonical branch (copy of `claude/vigilant-volta-da1cu9`).
  Owner to do the two one-time dropdown flips — see Deployment below. Verify they're
  done before relying on a push to `main` to deploy.
- No app code changed this session — only branch reorg + these notes.
- **Pick up here:** roadmap below is untouched. Recommended first build = wire real
  Stripe (keys + webhook + checkout) so the platform takes real payments instead of
  demo mode. Work one roadmap item per session, then update this file before /clear.

## What this is
**The Creatiste Command** — a subscription SaaS platform for private chefs & caterers,
owned by Caroline (The Creatiste Catering). Chefs pay a one-time onboarding fee +
monthly subscription; Caroline is the platform admin. Built end-to-end in Claude Code
sessions; this file is the continuity bridge between sessions/accounts.

## Deployment (IMPORTANT)
- Hosted on **Render** (web service, native Python runtime, free tier so far).
- **`main` is now the canonical branch** (created 2026-06-12 from
  `claude/vigilant-volta-da1cu9`, identical at creation). Merge/push finished work
  to `main` so the live site updates.
- One-time owner flips (each ~30s, may still be pending): Render → Settings →
  Build & Deploy → Branch → `main`; GitHub → repo Settings → General → Default
  branch → `main`. If a push to `main` doesn't trigger a deploy, the Render flip
  hasn't happened yet and Render is still watching `claude/vigilant-volta-da1cu9`.
- Build command: `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build`
- Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars on Render: `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`,
  `PYTHON_VERSION=3.11.9`. Not yet set: `ANTHROPIC_API_KEY` (enables Mise),
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (real payments; demo mode without),
  `SMTP_*` (email notifications), `SUPPORT_EMAIL` (support inbox — Caroline will
  point this at her own domain later), `DATA_DIR=/var/data` (only after adding a
  paid persistent disk — **free tier wipes the SQLite DB on every deploy/restart**).

## Brand (exact spec from Caroline — do not drift)
- Gold `#BFA987`, ivory `#FFFBF5`, true black background. Dark "signature" theme is
  default; light mode toggle in Settings (theme tokens are CSS vars in
  `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js` — `copper`
  is the gold accent token name, kept for history).
- Font: **The Seasons** (Canva premium, not web-licensed) → substituted with
  **Playfair Display**. If Caroline buys the web licence, embed the real file.
- Wordmark: "THE CREATISTE" gold caps + "command" lowercase italic ivory, letters
  justified to the same width (see `Brand` in `frontend/src/ui.jsx`).

## Architecture map
- `backend/` FastAPI + SQLite (SQLAlchemy). One process also serves the built SPA.
  - `app/utils.py` — `crud_router` factory: workspace-scoped CRUD + activity audit
    log + plan gating (`min_plan`). **Workspace scoping**: staff users act on their
    owner's data via `ws_id(user)` — never use `user.id` directly in queries.
  - `app/auth.py` — roles: admin (platform owner) / chef (business owner) / staff
    (has `owner_id`). `require_active` (402 paywall, trial-aware), `require_owner`,
    `require_plan(1|2|3)` (Solo/Pro/Elite tier gates — enforced server-side).
  - Routers: core (recipes/inventory/shopping/packing/tasks/routes/appointments/
    suppliers/designs/ideas/clients), bookings (+`/workspace` aggregate), finance
    (owner-only, Pro+), quotes (owner-only, Elite, public approval links), team
    (staff CRUD, shifts, assignments, activity trail — Elite), public (no-auth
    quote + enquiry endpoints), ai (Mise; model `claude-opus-4-8`), support
    (tickets → Admin tab + SUPPORT_EMAIL), billing (Stripe or demo mode), admin.
  - `database.ensure_columns()` = additive migration for new columns; new tables
    come from `create_all`. Seed: `python -m app.seed` (idempotent, adds v2 extras).
- `frontend/` React 18 + Vite + Tailwind. `src/ui.jsx` is the design system
  (icons, Brand, Button/Card/Modal/Badge/toast). `src/App.jsx` has grouped nav with
  plan locks + staff filtering + trial banner. Public routes: `/q/:token` (quote
  approval), `/enquire/:token` (enquiry form).

## Business model (current state)
- 3-day **no-card free trial** by default (`DEFAULT_TRIAL_DAYS`, editable in
  Admin → Pricing) → then onboarding fee + first month together at activation.
- Tiers: Solo Chef £39/mo+£99, Pro Caterer £69/mo+£199, Elite Kitchen £129/mo+£399
  (all editable live in Admin → Pricing). Quotes/Team/Mise are Elite; clients/
  tastings/orders/routes/designs/suppliers/enquiry/finance are Pro+.

## Logins (local/demo; live DB resets on deploy and reseeds nothing automatically —
## bootstrap creates only admin; run seed manually if demo data wanted)
- Platform admin: env `ADMIN_EMAIL`/`ADMIN_PASSWORD` (defaults in config.py).
- Seeded demo: chef@demo.kitchen / demo12345 (Elite), staff@demo.kitchen / demo12345.

## Verification pattern used in every session
Playwright (sync) against `http://127.0.0.1:8000` with the system chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (newer downloads are blocked).
Boot: venv at `backend/.venv`; `setsid nohup .venv/bin/uvicorn app.main:app --host
0.0.0.0 --port 8000 ... & disown`; kill via `fuser -k 8000/tcp` (NOT pkill -f —
it matches the calling shell and kills it).

## Gotchas learned the hard way
- **JSON columns**: never mutate the loaded list/dict in place — SQLAlchemy won't
  detect it and silently won't save. Build new objects and/or `flag_modified`
  (see shopping/packing toggle endpoints in `routers/core.py`).
- Google Fonts are blocked in the dev sandbox (cert errors in console = harmless).
- Render free tier sleeps + wipes SQLite on each deploy; upsell the disk before
  real customers.

## Likely next steps (Caroline's roadmap)
- Wire real Stripe keys + webhook; add `ANTHROPIC_API_KEY` for Mise; SMTP for email.
- Custom domain + `SUPPORT_EMAIL` swap.
- Plan switching from the chef dashboard (currently via admin/support).
- (done 2026-06-12) `main` created as the canonical branch — see Deployment for
  the two one-time dropdown flips (Render deploy branch + GitHub default branch).
