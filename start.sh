#!/bin/bash
set -e

# Ensure the persistent directory exists
mkdir -p /data/.openclaw

# Copy the default config if it doesn't exist on the persistent disk
if [ ! -f /data/.openclaw/openclaw.json ]; then
  echo "Copying default openclaw.json to /data/.openclaw/openclaw.json..."
  cp /app/openclaw.json /data/.openclaw/openclaw.json
else
  echo "openclaw.json already exists on persistent disk."
fi

# Execute the original entrypoint command
exec node openclaw.mjs gateway
