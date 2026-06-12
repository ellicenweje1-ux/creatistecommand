# CLAUDE.md — project handover & working notes

Read this first in every new session. It replaces lost chat history.

**Founder / platform owner:** Ellice Nweje — founder of The Creatiste Command
(account owner, ellicenweje1@gmail.com). Ellice runs The Creatiste Catering and built
this platform; all decisions are hers. (Git-history heads-up: some early commits were
authored under a relative's Google login that was used to access Claude, so older
commit authorship may show a different name/email — the project is entirely Ellice's.)

## Latest session (2026-06-12, fifth wave — tier comparison table + portal Home guide)
- Branch `claude/determined-carson-cogamv` — merge to `main` to deploy.
- **Tier comparison table** on the public landing page (`pages/Landing.jsx`,
  `#compare` inside the `#pricing` section): tick/✗ matrix so visitors can compare
  memberships at a glance. 24 rows in 4 groups (Plan & run events / Kitchen &
  shopping / Business & money / Team & the edge); each row is `[benefit, min plan
  level]` in the `COMPARE` const — **levels mirror the real server gating** (1 Solo,
  2 Pro, 3 Elite; quotes/team/Mise=3, clients/tastings/orders/routes/suppliers/
  designs/finance/enquiry=2). Plan names/prices/trial copy stay live from
  `/billing/plans`; only the matrix rows are hardcoded — if Ellice changes what a
  tier includes, update `COMPARE` too. Pro column highlighted + "Most popular";
  tfoot = onboarding fee + Choose CTAs; ticks have `sr-only` Included/Not included;
  mobile h-scrolls (min-w 620px table in overflow wrapper).
- **Portal Home — module guide** (`pages/Home.jsx`, now the `/app` index route):
  21 circular module "bubbles" in 4 groups (Run the operation / In the kitchen /
  Grow the business / Help & housekeeping). Hover (or keyboard focus) = floating
  blurb tooltip; click = guide modal: what it is, "Why it earns its place" (3 ticks),
  "How to use it well" (numbered steps), gold "Chef's tip", plan badge + "Open X"
  CTA that navigates. Plan-locked bubbles (below user's level) show a lock chip,
  dimmed icon, and the modal swaps in an upgrade banner + "See membership options"
  → /app/settings (content still visible = upsell). `ownerOnly` modules
  (Finance/Quotes) hidden from staff, mirroring the sidebar. All copy lives in the
  `GROUPS` const in Home.jsx — edit there to reword any module guide. Stagger
  entrance via `.bubble-in` (index.css). Tooltip is `z-[45]` — above the fixed
  sidebar (z-40, was clipping left-column tooltips), below modals (z-50).
- **Dashboard moved** `/app` → `/app/dashboard` (Home took the index). Sidebar:
  Home (icon `home`) then Dashboard (new `pulse` icon in ui.jsx). Mobile bottom nav
  unchanged (Dashboard/Bookings/Tasks/Shopping) — `mobileMain` indices in App.jsx
  updated for the inserted Home item; Home reachable on mobile via brand-logo tap
  (→ /app) and the More sheet. All existing `navigate('/app')` flows (login,
  onboarding success, founders tour first login) now land on the guide — intended.
- Verified with Playwright (desktop + 390px, dark + light): tick matrix counts
  Solo 9 / Pro 19 / Elite 24 of 24, tfoot CTAs, mobile h-scroll; 21 bubbles for
  elite owner / 10 locks on Solo / 19 bubbles for staff; hover tooltip, modal
  content, CTA navigation, locked modal → settings; bottom nav + More sheet; no
  console errors.

## Previous session (2026-06-12, fourth wave — landing intro film + hook sections)
- **Embedded intro film** on the public landing page (`frontend/src/introfilm.jsx`,
  branch `claude/nice-tesla-az74mn`): a 6-scene, ~70s animated brand film that looks
  and behaves like a video player (poster + play button, segmented click-to-seek
  progress, pause/resume, restart, mute) but is pure React/CSS — no video file to
  host, crisp at any size, always on-brand. **Warm female voiceover** via the
  browser's SpeechSynthesis: `pickVoice()` prefers female en-GB voices (Sonia/Libby/
  Kate/"Google UK English Female"…), rate .95/pitch 1.06; speech text spells the
  brand phonetically ("Cree-ay-teest") so every engine pronounces it right, captions
  show the real spelling and run always (graceful fallback where TTS is missing —
  sound icon dims, scenes advance on timers). Scenes: hook questions ("Have you ever
  been in a position where…"), exact welcome line Ellice specified ("…the
  comprehensive management platform and one-stop shop designed for chefs, caterers
  and all culinary professionals"), feature montage, chaos→"one command centre" gap
  story, CTA end-card → /register. Scene timing waits for BOTH the per-scene timer
  AND utterance end (8s safety cap); pause cancels speech and resume restarts the
  current scene so voice/motion stay in sync; `.if-*` keyframes live in index.css.
- **Landing page additions** (`pages/Landing.jsx`): hero now has "Watch the intro ·
  1 min" → `#film` section (dark, framed); new `#why` section = 4 "Have you ever…?"
  hook cards (each pain → how the platform answers it) + "The gap we fill" panel
  ("You were trained for the pass — not the paperwork"); nav links The intro / Why
  Creatiste / Pricing. New icons in ui.jsx: play/pause/replay/sound/soundOff.
- **GOTCHA — never use Tailwind `text-base` in this repo**: the theme defines a
  *colour* token named `base`, so Tailwind emits BOTH font-size and colour rules for
  `text-base` and the colour (= page background!) wins → invisible text. Existing
  uses survive only because an explicit text-colour class happens to sort later.
  Use `text-[16px]` instead. (Bit the film twice via `sm:`/`md:` variants.)
- Verified with Playwright (desktop + 390px mobile, dark + light themes): poster →
  play → captions/scene visuals per scene, seek via segments, pause/resume, mute
  toggle, end-card CTA → /register, hooks/gap/pricing sections render, no console
  errors. NOTE: headless chromium has no TTS voices — voiceover needs a quick
  listen on a real device after deploy (Chrome/Edge/Mac/iOS all ship female voices).

## Previous session (2026-06-12, third wave — onboarding calls, 5-day trial, badges)
- **Verification-first access**: every new account (founder or standard) must book a
  **video onboarding session** and have Ellice mark it complete before the workspace
  opens. Register → status stays `pending` → /onboarding shows a slot picker (Step 1
  of 2) → booked card with join link → on completion (`Admin → Onboarding`) the user
  gets `users.onboarded_at` and the **5-day free trial** starts right then
  (DEFAULT_TRIAL_DAYS=5; boot migrates old 3→5). Gate enforced server-side in
  `auth._owner_active` + client-side in RequireActive; pre-existing active/trialing
  users are grandfathered at boot (onboarded_at = created_at).
- **Booking system** (`routers/onboarding.py`, `frontend/src/booking.jsx`):
  Mon–Sat 09:00–17:00 slots, 45 min, 14-day horizon, 3h lead, global calendar
  (everyone books Ellice), double-book → 409, rebook replaces, cancel endpoint,
  emails to client + SUPPORT_EMAIL. Video link per session: **Zoom** auto-created
  when ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET set (server-to-server OAuth);
  `MEETING_URL` env = fixed personal room; default = unique **Jitsi Meet** room
  (free, zero setup, works in demo).
- **Admin → Onboarding tab**: Ellice's call calendar (upcoming grouped by date +
  past), session modal with join link, Complete (= verify & start trial)/no-show/
  cancel, notes + pasted transcript, **"Summarise with AI"** → Claude key points
  (summary/key points/action items/feature requests/sentiment) stored on the
  session (`ai_summary`); 503 without ANTHROPIC_API_KEY.
- **Founders day-5 = a call now**: check-in modal leads with a slot picker
  (kind=checkin, founders-only) + the 3 written questions as optional prep;
  booking the call or sending the form clears the nag; booked call shown in
  Settings founders card + admin Founders/Onboarding tabs. days_in counts from
  onboarded_at (trial start).
- **Founders invite page badges**: perks are now structured {icon,title,text}
  badge cards ("Founders only" chips) incl. new **Testimonial spotlight** (logo on
  site + direct link to their business as advertising) + "How joining works"
  4-step (call-first). Old string perks migrate at boot. (Logo-wall on the public
  landing page not built yet — perk is promised, collect logos via avatar_url
  later.)
- **Stripe trial billing**: checkout during trial now passes
  `subscription_data.trial_period_days` = remaining trial days → card taken at
  subscribe, first charge lands when the trial ends (auto-renews after). Demo mode
  unchanged. "No card needed" copy everywhere now says *for the trial*.
- Verified end-to-end (API + Playwright): register→pending→402 w/ booking message,
  book slot, 409 double-book, admin completes → trialing w/ +5d trial & workspace
  200, founder day-5 modal books real check-in call, AI summarize 503s gracefully,
  founders activation still £59/waived.

## Previous session (2026-06-12, second session — Founders Membership)
- Built the **Founders Membership**: a private, invite-only launch programme for the
  platform's first chefs. Developed on `claude/vibrant-newton-jah29i` — merge to
  `main` to deploy.
- How it works (all editable live in **Admin → Founders**):
  - Secret invite link `/founders/<code>` (code auto-generated at bootstrap, stored
    in `platform_settings.founders` JSON). Never linked from public pages; wrong
    code and closed programme both 404 identically. Ellice shares it by hand.
  - Limited **founding seats** (default 10). Full Elite access (`plan="founders"`,
    level 3) at a **lifetime rate** (default £59/mo vs £129 Elite) with the
    onboarding fee **waived** (default £0 vs £399). Normal 3-day trial still applies.
  - Register with `founders_code` → numbered seat (`founder_number`), gold badge in
    sidebar/Settings, founders-only activation card on /onboarding (Stripe checkout
    and demo mode both handle plan `founders`).
  - **Walkthrough onboarding**: 5-step welcome tour on first login (persisted via
    `users.tour_done`); last step sets up the day-5 catch-up expectation.
  - **Day-5 check-in** (`CHECK_IN_AFTER_DAYS=5` in routers/founders.py): modal asks
    Ellice's 3 questions (thoughts / how it benefited / what to change) →
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
  email Ellice.

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
founded by Ellice Nweje (who also runs the namesake catering business, The Creatiste
Catering). Chefs pay a one-time onboarding fee + monthly subscription; Ellice is the
platform admin. Built end-to-end in Claude Code sessions; this file is the continuity
bridge between sessions.

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
  `SMTP_*` (email notifications), `SUPPORT_EMAIL` (support inbox — Ellice will
  point this at her own domain later), `DATA_DIR=/var/data` (only after adding a
  paid persistent disk — **free tier wipes the SQLite DB on every deploy/restart**).

## Brand (exact spec from Ellice — do not drift)
- Gold `#BFA987`, ivory `#FFFBF5`, true black background. Dark "signature" theme is
  default; light mode toggle in Settings (theme tokens are CSS vars in
  `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js` — `copper`
  is the gold accent token name, kept for history).
- Font: **The Seasons** (Canva premium, not web-licensed) → substituted with
  **Playfair Display**. If Ellice buys the web licence, embed the real file.
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

## Likely next steps (Ellice's roadmap)
- Wire real Stripe keys + webhook; add `ANTHROPIC_API_KEY` for Mise; SMTP for email.
- Custom domain + `SUPPORT_EMAIL` swap.
- Plan switching from the chef dashboard (currently via admin/support).
- (done 2026-06-12) `main` created as the canonical branch — see Deployment for
  the two one-time dropdown flips (Render deploy branch + GitHub default branch).
