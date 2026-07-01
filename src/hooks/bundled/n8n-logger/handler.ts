import { createSubsystemLogger } from "../../../logging/subsystem.js";
import type { HookHandler } from "../../hooks.js";

const log = createSubsystemLogger("n8n-logger");

// In-memory cache for session start times and last user messages
const sessionStartTimes = new Map<string, number>();
const lastUserMessages = new Map<string, string>();

const handleEvent: HookHandler = async (event) => {
  if (event.type !== "message") {
    return;
  }

  const sessionKey = event.sessionKey;
  if (!sessionKey) {
    return;
  }

  if (event.action === "received") {
    // User message received: record start time and message content
    sessionStartTimes.set(sessionKey, Date.now());
    const content = (event.context as { content?: string }).content ?? "";
    lastUserMessages.set(sessionKey, content);
    return;
  }

  if (event.action === "sent") {
    // Agent response sent: calculate execution time and push to n8n
    const endTime = Date.now();
    const startTime = sessionStartTimes.get(sessionKey);
    const executionTimeSec = startTime ? (endTime - startTime) / 1000 : 0;
    
    // Clean up cache
    sessionStartTimes.delete(sessionKey);
    const userMessage = lastUserMessages.get(sessionKey) ?? "";
    lastUserMessages.delete(sessionKey);

    const success = (event.context as { success?: boolean }).success;
    if (!success) {
      return; // Skip failed deliveries
    }

    const agentResponse = (event.context as { content?: string }).content ?? "";
    if (!agentResponse.trim()) {
      return;
    }

    // Extract agentId from sessionKey (format: agent:agentId:channel:...)
    const sessionParts = sessionKey.split(":");
    const agentId = sessionParts[1] || "unknown";

    // Map to Department Name
    let agentName = "General Handlers";
    if (agentId === "dev") {
      agentName = "Department DEV";
    } else if (agentId === "td") {
      agentName = "Department 3D";
    } else if (agentId === "biz") {
      agentName = "Department BIZ";
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      log.warn("N8N_WEBHOOK_URL is not configured in the environment. Skipping log dispatch.");
      return;
    }

    let issueSolved = "General assistant interaction";
    let systemImpact = "None";

    // Extract Issue_Solved and System_Impact using Gemini 2.5 Flash if API Key is available
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are an expert software project log analyzer. Analyze the user request and agent's response below, and extract:
1. Issue_Solved: A short, concise summary of the issue solved or task completed.
2. System_Impact: A brief explanation of what part of the system was modified or impacted.

Return ONLY a valid JSON object matching this schema, without markdown formatting:
{
  "Issue_Solved": "Concise summary",
  "System_Impact": "Brief impact description"
}

User request:
${userMessage}

Agent response:
${agentResponse}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            const parsed = JSON.parse(jsonText.trim());
            issueSolved = parsed.Issue_Solved || issueSolved;
            systemImpact = parsed.System_Impact || systemImpact;
          }
        }
      } catch (err) {
        log.error(`Failed to extract log metadata via Gemini: ${String(err)}`);
      }
    }

    // Fire webhook to n8n
    try {
      const payload = {
        Agent_Name: agentName,
        Issue_Solved: issueSolved,
        System_Impact: systemImpact,
        Execution_Time: executionTimeSec,
      };

      const n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!n8nResponse.ok) {
        log.error(`n8n webhook returned status ${n8nResponse.status}`);
      } else {
        log.info(`Log successfully dispatched to n8n for agent ${agentName}`);
      }
    } catch (err) {
      log.error(`Failed to fire n8n webhook: ${String(err)}`);
    }
  }
};

export default handleEvent;
