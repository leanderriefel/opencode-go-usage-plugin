import { discoverKey, help } from "./lib/auth.js"
import { fetchUsage, parse } from "./lib/go-usage.js"
import { err, md } from "./lib/format.js"

async function get(): Promise<string> {
  const f = await discoverKey()
  if (!f) return err("Not connected.", help())
  try {
    const j = await fetchUsage(f.key)
    const p = parse(j)
    if (!p) return err("Bad response from Go API.")
    return md(p) + `\n\n<sub>Source: ${f.source}</sub>`
  } catch (e) {
    const s = (e as { status?: number }).status
    if (s === 401) return err("401 - key rejected.", help())
    if (s === 403) return err("403 - no Go subscription.", "https://opencode.ai/go")
    return err(e instanceof Error ? e.message.slice(0, 600) : String(e))
  }
}

async function show(api: any): Promise<void> {
  const m = await get()
  try {
    await api.ui.dialog.alert({ title: "Go - Usage", message: m })
  } catch {
    api.ui.toast({
      title: "Go - Usage",
      message: m.slice(0, 2000),
      variant: "info",
      duration: 8000,
    })
  }
}

const tui = async (api: any) => {
  try {
    const d = api.command.register(() => [
      {
        title: "Show Go usage",
        value: "go-usage",
        description: "Show Go usage",
        category: "Go",
        slash: { name: "go-usage" },
        onSelect: () => {
          void show(api)
        },
      },
    ])
    api.lifecycle.onDispose(d)
  } catch (e) {
    try {
      api.ui.toast({
        message: `Go command register failed: ${String(e).slice(0, 200)}`,
        variant: "error",
      })
    } catch {}
  }
  api.ui.toast({ message: "Go plugin ready: /go-usage", variant: "info", duration: 2000 })
}

export default { id: "opencode-go-usage.tui", tui }
