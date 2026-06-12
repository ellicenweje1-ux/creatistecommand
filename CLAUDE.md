# CLAUDE.md — project handover & working notes

Read this first in every new session. It replaces lost chat history.

**Founder / platform owner:** Ellice Nweje — founder of The Creatiste Command
(account owner, ellicenweje1@gmail.com). NOTE on "Caroline" in older notes: that's
Ellice's aunt, who runs **The Creatiste Catering**. The project previously ran under
Caroline's account, so earlier sessions credited her as owner — but the founder
directing this project is **Ellice**. Caroline is a separate person; some
operational lines below still say "Caroline" where they now mean Ellice.

## Latest session (2026-06-12, second session — Founders Membership)
- Built the **Founders Membership**: a private, invite-only launch programme for the
  platform's first chefs. Developed on `claude/vibrant-newton-jah29i` — merge to
  `main` to deploy.
- How it works (all editable live in **Admin → Founders**):
  - Secret invite link `/founders/<code>` (code auto-generated at bootstrap, stored
    in `platform_settings.founders` JSON). Never linked from public pages; wrong
    code and closed programme both 404 identically. Caroline shares it by hand.
  - Limited **founding seats** (default 10). Full Elite access (`plan="founders"`,
    level 3) at a **lifetime rate** (default £59/mo vs £129 Elite) with the
    onboarding fee **waived** (default £0 vs £399). Normal 3-day trial still applies.
  - Register with `founders_code` → numbered seat (`founder_number`), gold badge in
    sidebar/Settings, founders-only activation card on /onboarding (Stripe checkout
    and demo mode both handle plan `founders`).
  - **Walkthrough onboarding**: 5-step welcome tour on first login (persisted via
    `users.tour_done`); last step sets up the day-5 catch-up expectation.
  - **Day-5 check-in** (`CHECK_IN_AFTER_DAYS=5` in routers/founders.py): modal asks
    Caroline's 3 questions (thoughts / how it benefited / what to change) →
    `founder_feedback` table + email to SUPPORT_EMAIL; snoozable per session,
    reappears until sent.
  - **Direct line**: founders' support tickets get "[Founders direct line #N]" in
    the email subject + a priority note on the Support page.
  - **Admin → Founders tab**: seats/pricing editor, copy/regenerate invite link,
    close/reopen programme (closing kills the link for good; existing founders keep
    their rate + number), member list with days-in and check-in answers (click a
    row to read). ChefModal checkbox can grandfather an existing chef in. Overview
    MRR counts founders at the founders rate.
- New files: `backend/app/routers/founders.py`, `frontend/src/founders.jsx`
  (badge + tour + check-in components), `frontend/src/pages/Founders.jsx` (invite
  page). DB: additive columns on users/platform_settings via `ensure_columns`,
  new `founder_feedback` table via `create_all` — existing DBs migrate on boot.
- Verified end-to-end with Playwright (invite → register → tour → activate →
  backdated day-5 check-in → admin reads feedback → close programme kills link).
- **Pick up here:** wire real Stripe keys + webhook (founders checkout already
  builds the right line items); then SMTP so founder check-ins/support actually
  email Caroline.

## Previous session (2026-06-12)
- Moved the project onto the owner's own GitHub + Claude Code account (the only
  thing that was on someone else's account was the old Claude history — code and
  Render were already the owner's). Nothing to "transfer": every session reads
  this file automatically, so context carries over.
- Created **`main`** as the canonical branch (copy of `claude/vigilant-volta-da1cu9`).
  Owner to do the two one-time dropdown flips — see Deployment below. Verify they're
  done before relying on a push to `main` to deploy.
- No app code changed that session — only branch reorg + notes.

## What this is
**The Creatiste Command** — a subscription SaaS platform for private chefs & caterers,
founded by Ellice Nweje. (The Creatiste Catering is the namesake catering business run
by Ellice's aunt Caroline; earlier sessions ran under Caroline's account.) Chefs pay a
one-time onboarding fee + monthly subscription; the founder is the platform admin. Built
end-to-end in Claude Code sessions; this file is the continuity bridge between sessions.

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
- **Founders Membership** (launch only): invite-only via secret link in Admin →
  Founders; limited seats; full Elite access at a lifetime rate (£59/mo, onboarding
  waived by default). Walkthrough on first login + day-5 feedback check-in. Closing
  the programme removes it permanently; founders keep their rate. See latest
  session notes above for the full mechanics.

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
