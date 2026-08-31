import type { IntegrationLike } from "./auth.js"
import { discoverKey, help } from "./auth.js"
import { fetchUsage, parse } from "./go-usage.js"
import { err, md, sidebar } from "./format.js"

export async function report(ctx?: IntegrationLike): Promise<string> {
  const f = await discoverKey(ctx)
  if (!f) return err("Not connected.", help())
  try {
    const j = await fetchUsage(f.key)
    const p = parse(j)
    if (!p) return err("Bad response from Go API.")
    return md(p) + `\n\nSource: ${f.source}`
  } catch (e) {
    const s = (e as { status?: number }).status
    const m = e instanceof Error ? e.message : String(e)
    if (s === 401) return err("401 - key rejected.", help())
    if (s === 403) return err("403 - no Go subscription.", "https://opencode.ai/go")
    return err(m.slice(0, 600))
  }
}

export async function sidebarReport(): Promise<string> {
  const f = await discoverKey()
  if (!f) return "OpenCode Go - Usage\n\nNot connected"
  try {
    const j = await fetchUsage(f.key)
    const p = parse(j)
    if (!p) return "OpenCode Go - Usage\n\nBad response from Go API."
    return sidebar(p)
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    return `OpenCode Go - Usage\n\n${m.slice(0, 100)}`
  }
}
