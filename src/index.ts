import { Plugin } from "@opencode-ai/plugin"
import { discoverGoKey, helpNotConnected } from "./lib/auth.js"
import { fetchGoUsage, parseGoUsageResponse } from "./lib/go-usage.js"
import { formatGoErrorMarkdown, formatGoUsageMarkdown } from "./lib/format.js"

async function buildReport(
  ctx: {
    integration: {
      connection: {
        active: (id: string) => Promise<unknown>
        resolve: (conn: unknown) => Promise<unknown>
      }
    }
  },
  opts?: { nowMs?: number }
): Promise<{ markdown: string; source: string }> {
  const found = await discoverGoKey(ctx)
  if (!found) {
    return {
      markdown: formatGoErrorMarkdown("OpenCode Go is not connected.", helpNotConnected()),
      source: "no-key",
    }
  }

  try {
    const json = await fetchGoUsage(found.key)
    const parsed = parseGoUsageResponse(json, opts?.nowMs)
    if (!parsed) {
      return {
        markdown: formatGoErrorMarkdown(
          `Unexpected response shape from \`${"https://opencode.ai/zen/go/v1/usage"}\`.`,
          `\`\`\`json\n${JSON.stringify(json, null, 2).slice(0, 2000)}\n\`\`\``
        ),
        source: `integration:${found.source}`,
      }
    }
    return {
      markdown:
        formatGoUsageMarkdown(parsed, { nowMs: opts?.nowMs }) +
        `\n\n<sub>Source: ${found.source} · Endpoint: \`GET https://opencode.ai/zen/go/v1/usage\`</sub>`,
      source: found.source,
    }
  } catch (err) {
    const status = (err as { status?: number })?.status
    const msg = err instanceof Error ? err.message : String(err)
    if (status === 401) {
      return {
        markdown: formatGoErrorMarkdown(
          `Unauthorized (401): API key rejected by \`${"https://opencode.ai/zen/go/v1/usage"}\`.`,
          `Check your key from https://opencode.ai/go or run \`/connect\` → OpenCode Go. Source tried: ${found.source}\n\n\`\`\`\n${msg.slice(0, 600)}\n\`\`\``
        ),
        source: found.source,
      }
    }
    if (status === 403) {
      return {
        markdown: formatGoErrorMarkdown(
          `Forbidden (403): Key is valid but has no Go subscription.`,
          `Open https://opencode.ai/go to subscribe. Key source: ${found.source}\n\n\`\`\`\n${msg.slice(0, 600)}\n\`\`\``
        ),
        source: found.source,
      }
    }
    return {
      markdown: formatGoErrorMarkdown(
        `Failed to fetch Go usage: ${msg.slice(0, 900)}`,
        `Source: ${found.source} · Endpoint: \`GET https://opencode.ai/zen/go/v1/usage\` — try again in a moment.`
      ),
      source: found.source,
    }
  }
}

export default Plugin.define({
  id: "opencode-go-usage",
  tui: true,
  async setup(ctx) {
    const execute = async (input: { sessionID: string }) => {
      const { markdown } = await buildReport(ctx as never)

      // Inject as synthetic so we don't trigger the LLM.
      // Synthetic messages show in the transcript on TUI / web / desktop, but don't become model context.
      try {
        await ctx.session.synthetic({
          sessionID: input.sessionID,
          text: markdown,
        })
      } catch {
        // Fallback to prompt if synthetic is unavailable on older server
        await ctx.session.prompt({
          sessionID: input.sessionID,
          text: markdown,
          // spread minimal prompt shape
        } as never)
      }
    }

    // Register primary + aliases so user can type /go, /go-usage, /gousage, /usage-go — all do the same.
    await ctx.command.transform((draft) => {
      draft.add({
        name: "go-usage",
        description:
          "Show OpenCode Go (Zen Go) usage — 5h / 7d / 30d windows via GET https://opencode.ai/zen/go/v1/usage (no LLM)",
        execute: async ({ sessionID }) => execute({ sessionID }),
      })
      draft.add({
        name: "go",
        description: "Alias for /go-usage — show OpenCode Go usage (no LLM)",
        execute: async ({ sessionID }) => execute({ sessionID }),
      })
      draft.add({
        name: "gousage",
        description: "Alias for /go-usage — show OpenCode Go usage (no LLM)",
        execute: async ({ sessionID }) => execute({ sessionID }),
      })
      draft.add({
        name: "usage-go",
        description: "Alias for /go-usage — show OpenCode Go usage (no LLM)",
        execute: async ({ sessionID }) => execute({ sessionID }),
      })
    })

    // Optional: also expose a tool so the agent can answer "what's my Go usage?" without a slash command.
    await ctx.tool.transform((draft) => {
      draft.add({
        name: "go_usage",
        description:
          "Fetch current OpenCode Go (Zen Go) usage/billing windows (5h/7d/30d). Uses the hosted Go usage API at https://opencode.ai/zen/go/v1/usage with the connected Go credential. Returns markdown. Fails gracefully if Go is not connected.",
        input: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
        execute: async (_input, toolCtx) => {
          const { markdown } = await buildReport(ctx as never)
          // For tool calls, also annotate with toolCtx.metadata if available
          try {
            ;(toolCtx as { metadata?: (m: unknown) => void }).metadata?.({ title: "Go Usage" })
          } catch {}
          return { content: markdown }
        },
      })
    })
  },
})
