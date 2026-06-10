#!/usr/bin/env bash
# Development mode: FastAPI with reload on :8000 + Vite dev server on :5173.
set -e
cd "$(dirname "$0")/.."

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
fi
[ -d frontend/node_modules ] || (cd frontend && npm install)

(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap "kill $BACK" EXIT
cd frontend && npm run dev
