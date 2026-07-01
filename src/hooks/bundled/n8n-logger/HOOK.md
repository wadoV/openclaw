---
name: n8n-logger
description: "Send agent resolution logs to n8n webhook"
homepage: https://docs.openclaw.ai/automation/hooks#n8n-logger
metadata:
  {
    "openclaw":
      {
        "emoji": "🔗",
        "events": ["message"],
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" }],
      },
  }
---

# n8n Logger Hook

Pushes structured agent log events to your self-hosted n8n instance for daily Obsidian fixes persistence.
