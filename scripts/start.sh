#!/usr/bin/env bash
# Production-style single process: build the frontend, serve everything from FastAPI on :8000.
set -e
cd "$(dirname "$0")/.."

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
fi
[ -d frontend/node_modules ] || (cd frontend && npm install)
(cd frontend && npm run build)

cd backend
exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
