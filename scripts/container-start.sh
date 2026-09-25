#!/bin/sh
set -eu
python -m alembic upgrade head
python -m backend.seed
exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}"
