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

function register(api: any): void {
  const run = () => {
    void show(api)
  }
  try {
    if (api.keymap?.registerLayer) {
      const d = api.keymap.registerLayer({
        commands: [
          {
            namespace: "palette",
            name: "go-usage",
            title: "Show Go usage",
            desc: "Show Go usage",
            category: "Go",
            slashName: "go-usage",
            run,
          },
        ],
        bindings: [],
      })
      api.lifecycle?.onDispose?.(d)
      return
    }
  } catch {}
  try {
    if (api.keymap?.layer) {
      api.keymap.layer(() => ({
        mode: "global",
        commands: [
          {
            id: "go-usage",
            title: "Show Go usage",
            group: "Go",
            palette: true,
            slash: { name: "go-usage" },
            run,
          },
        ],
      }))
      return
    }
  } catch {}
  try {
    if (api.command?.register) {
      const d = api.command.register(() => [
        { title: "Show Go usage", value: "go-usage", slash: { name: "go-usage" }, onSelect: run },
      ])
      api.lifecycle?.onDispose?.(d)
    }
  } catch {}
}

const tui = async (api: any) => {
  await new Promise<void>((r) => setTimeout(r, 0))
  register(api)
  api.ui.toast({ message: "Go plugin ready: /go-usage", variant: "info", duration: 2000 })
}

export default { id: "opencode-go-usage.tui", tui }
