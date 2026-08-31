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

// Module shape for opencode2 beta-18684 TUI loader: { id, setup }. No imports from
// @opencode-ai/plugin (the config dir can carry a v1 copy whose tui entry is empty).
// setup() runs OUTSIDE the Solid tree, so keymap.layer MUST be registered from a
// slot render (built-in plugins do exactly this).
export default {
  id: "opencode-go-usage.tui",
  setup(context: any) {
    const unregister = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "go-usage.show",
              title: "Show Go usage",
              group: "Go",
              palette: true,
              slash: { name: "go-usage" },
              run: async () => {
                context.ui.toast.show({ message: "Fetching...", variant: "info", duration: 1000 })
                const m = await get()
                try {
                  await context.ui.dialog.alert({ title: "Go - Usage", message: m })
                } catch {
                  context.ui.toast.show({
                    title: "Go - Usage",
                    message: m.slice(0, 2000),
                    variant: "info",
                    duration: 8000,
                  })
                }
              },
            },
          ],
        }))
        return null
      },
    })
    return () => unregister()
  },
}
