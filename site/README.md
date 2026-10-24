# The Creatiste Catering — public website

The public, client-facing site for Ellice's catering business (thecreatistecatering.com).
It is a static Vite + React + Tailwind site, separate from the Creatiste Command app in
`../frontend`, and it uses the Command backend for anything live (enquiries today; the
"What's on" strip and diary availability next).

## Run locally
```
cd site && npm install && npm run dev
```

## Build
```
cd site && npm run build      # → site/dist
```

## Content
Every word on the site lives in `src/content/site.js`. Lines marked `TODO Ellice` are
waiting on her. Real photos go in `public/photos/` and are listed in `GALLERY.photos`.
Brochure PDFs and certificates go in `public/docs/`.

## Enquiries → The Creatiste Command
Copy `.env.example` to `.env` and set:
- `VITE_API_BASE` — the Command API origin (`https://creatistecommand.onrender.com`)
- `VITE_ENQUIRY_TOKEN` — the token at the end of your public enquiry link
  (Command → Settings → App & integrations → Public enquiry link).

With both set, the Enquire form posts straight into your Command Bookings pipeline as an
enquiry and emails you. Without them it falls back to opening an email to
`enquiries@thecreatistecatering.com`, so nothing is lost.

## Deploy (Cloudflare Pages, recommended)
- Build command: `cd site && npm ci && npm run build`
- Build output directory: `site/dist`
- Environment variables: the two above.
- Custom domain: `thecreatistecatering.com` (DNS is already at Cloudflare — add the CNAME
  Pages gives you, grey-cloud is fine). Pages serves `index.html` for unknown paths, so
  client-side routes work with the default `BrowserRouter`.

Any static host without SPA fallback: build with `VITE_ROUTER=hash VITE_BASE=./`.
