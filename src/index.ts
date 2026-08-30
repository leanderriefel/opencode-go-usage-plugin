import { Plugin } from "@opencode-ai/plugin"
import { discoverKey, help } from "./lib/auth.js"
import { fetchUsage, parse } from "./lib/go-usage.js"
import { err, md } from "./lib/format.js"

async function get(ctx?: {
  integration: {
    connection: {
      active: (id: string) => Promise<{ id: string; label: string } | undefined>
      resolve: (c: {
        id: string
        label: string
      }) => Promise<string | { key?: string; token?: string; apiKey?: string } | null | undefined>
    }
  }
}) {
  const f = await discoverKey(ctx as never)
  if (!f) return err("Not connected.", help())
  try {
    const j = await fetchUsage(f.key)
    const p = parse(j)
    if (!p) return err("Bad response from Go API.")
    return md(p) + `\n\n<sub>Source: ${f.source}</sub>`
  } catch (e) {
    const s = (e as { status?: number }).status
    const m = e instanceof Error ? e.message : String(e)
    if (s === 401) return err("401 - key rejected.", help())
    if (s === 403) return err("403 - no Go subscription.", "https://opencode.ai/go")
    return err(m.slice(0, 600))
  }
}

export default Plugin.define({
  id: "opencode-go-usage",
  tui: true,
  async setup(ctx) {
    await ctx.tool.transform((d) => {
      d.add({
        name: "go_usage",
        description: "Get Go usage",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        execute: async () => ({ content: await get(ctx as never) }),
      })
    })
  },
})
