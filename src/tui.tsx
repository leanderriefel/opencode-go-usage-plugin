/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode-ai/plugin/tui"
import { discoverGoKey, helpNotConnected } from "./lib/auth.js"
import { fetchGoUsage, parseGoUsageResponse } from "./lib/go-usage.js"
import { formatGoErrorMarkdown, formatGoUsageMarkdown } from "./lib/format.js"

async function fetchReportForTui(nowMs = Date.now()): Promise<string> {
  // TUI runs in the terminal process — reuse the same file/env discovery as the server.
  // We also try integration via auth file; direct server integration is not available here,
  // but the auth file covers the same credential.
  const found = await discoverGoKey()
  if (!found) {
    return formatGoErrorMarkdown("OpenCode Go is not connected.", helpNotConnected())
  }

  try {
    const json = await fetchGoUsage(found.key)
    const parsed = parseGoUsageResponse(json, nowMs)
    if (!parsed) {
      return formatGoErrorMarkdown(
        `Unexpected response shape from \`https://opencode.ai/zen/go/v1/usage\`.`,
        `\`\`\`json\n${JSON.stringify(json, null, 2).slice(0, 2000)}\n\`\`\`\n\nSource: ${found.source}`
      )
    }
    return (
      formatGoUsageMarkdown(parsed, { nowMs }) +
      `\n\n<sub>Source: ${found.source} · Fetched in TUI · Endpoint: \`GET https://opencode.ai/zen/go/v1/usage\`</sub>`
    )
  } catch (err) {
    const status = (err as { status?: number })?.status
    const msg = err instanceof Error ? err.message : String(err)
    if (status === 401) {
      return formatGoErrorMarkdown(
        `Unauthorized (401): API key rejected.`,
        `Check your key at https://opencode.ai/go or run \`/connect\` → OpenCode Go. Source: ${found.source}\n\n\`\`\`\n${msg.slice(0, 600)}\n\`\`\``
      )
    }
    if (status === 403) {
      return formatGoErrorMarkdown(
        `Forbidden (403): Key valid but no Go subscription.`,
        `Subscribe at https://opencode.ai/go — Source: ${found.source}`
      )
    }
    return formatGoErrorMarkdown(
      `Failed to fetch Go usage: ${msg.slice(0, 900)}`,
      `Source: ${found.source} · Endpoint: \`GET https://opencode.ai/zen/go/v1/usage\``
    )
  }
}

export default Plugin.define({
  id: "opencode-go-usage.tui",
  setup(ctx) {
    const run = async () => {
      // Show transient toast while fetching so user sees progress
      ctx.ui.toast.show({
        title: "OpenCode Go",
        message: "Fetching usage…",
        variant: "info",
        duration: 1500,
      })
      try {
        const markdown = await fetchReportForTui()
        // Prefer dialog (rich, focus-safe) — falls back to toast if dialog unavailable
        try {
          await ctx.ui.dialog.alert({ title: "OpenCode Go — Usage", message: markdown })
        } catch {
          ctx.ui.toast.show({
            title: "OpenCode Go — Usage",
            message: markdown.slice(0, 2000),
            variant: "info",
            duration: 8000,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        ctx.ui.toast.show({
          title: "OpenCode Go — Error",
          message: msg.slice(0, 600),
          variant: "error",
          duration: 6000,
        })
      }
    }

    ctx.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "opencode-go-usage.show",
          title: "Show OpenCode Go usage",
          group: "Go",
          palette: true,
          slash: { name: "go-usage", aliases: ["go", "gousage", "usage-go", "usage"] },
          run: () => run(),
        },
        {
          id: "opencode-go-usage.show.alias-go",
          title: "Show Go usage (alias /go)",
          group: "Go",
          // Register alias as its own slash so /go is discoverable in completion even before /go-usage is typed
          slash: { name: "go" },
          run: () => run(),
        },
        {
          id: "opencode-go-usage.show.alias-gousage",
          title: "Show Go usage (alias /gousage)",
          group: "Go",
          slash: { name: "gousage" },
          run: () => run(),
        },
      ],
      bindings: [
        "opencode-go-usage.show",
        "opencode-go-usage.show.alias-go",
        "opencode-go-usage.show.alias-gousage",
      ],
    }))
  },
})
