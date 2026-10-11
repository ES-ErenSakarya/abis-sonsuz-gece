#!/bin/sh
set -eu
cd /workspace
mkdir -p /workspace/.data
if [ ! -s /workspace/.data/auth-secret ]; then
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > /workspace/.data/auth-secret
fi
export BETTER_AUTH_SECRET="$(cat /workspace/.data/auth-secret)"
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
