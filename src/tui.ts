import { report } from "./lib/report.js"

// opencode2 beta-18684 TUI loader expects { id, setup }. No imports from
// @opencode-ai/plugin (the config dir can carry a v1 copy with an empty tui
// entry). setup() runs OUTSIDE the Solid tree, so keymap.layer must be
// registered from a slot render - built-in plugins do exactly this.
export default {
  id: "opencode-go-usage.tui",
  setup(context: {
    ui: {
      slot: (claim: { append: "app"; render: () => unknown }) => () => void
      toast: {
        show: (o: { message: string; variant?: string; duration?: number; title?: string }) => void
      }
      dialog: { alert: (o: { title: string; message: string }) => Promise<void> }
    }
    keymap: { layer: (fn: () => unknown) => void }
  }) {
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
                const m = await report()
                try {
                  await context.ui.dialog.alert({ title: "Go - Usage", message: m })
                } catch {
                  context.ui.toast.show({
                    title: "Go - Usage",
                    message: m,
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
