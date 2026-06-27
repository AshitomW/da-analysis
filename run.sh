#!/bin/bash
set -e

VENV_DIR="$(dirname "$0")/backend/venv"

# echo "Training ML models..."
# "$VENV_DIR/bin/python" "$(dirname "$0")/backend/scripts/train_all.py"

echo "Starting backend..."
("$VENV_DIR/bin/uvicorn" main:app --reload --port 8000 --app-dir "$(dirname "$0")/backend") &

echo "Starting frontend..."
(cd "$(dirname "$0")/frontend" && npm run dev) &

trap 'kill 0' SIGINT SIGTERM
wait
