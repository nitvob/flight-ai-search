#!/usr/bin/env bash

set -euo pipefail

MODE="preview"

if [[ "${1:-}" == "--prod" ]]; then
  MODE="production"
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is not installed."
  echo "Install it with: npm install -g vercel"
  exit 1
fi

if [[ ! -f ".env.local" ]]; then
  echo ".env.local is missing."
  echo "Create it before deploying so you know which env vars to add in Vercel."
  exit 1
fi

echo "Running checks before deploy..."
npm run lint
npm run build

echo
echo "Deploy mode: ${MODE}"
echo "Make sure these env vars exist in Vercel before promoting the app:"
echo "- OPENAI_API_KEY"
echo "- OPENAI_MODEL"
echo "- AMADEUS_API_KEY"
echo "- AMADEUS_API_SECRET"
echo

if [[ "${MODE}" == "production" ]]; then
  vercel deploy --prod
else
  vercel deploy
fi
