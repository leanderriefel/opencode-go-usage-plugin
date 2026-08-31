import { createElement, insert } from "@opentui/solid"
import { report, sidebarReport } from "./lib/report.js"

const POLL_ACTIVE_MS = 30_000 // something is generating in a session
const POLL_IDLE_MS = 120_000 // background
const AFTER_MESSAGE_MS = 5_000 // shortly after a message finishes

type SlotContext = {
  ui: {
    slot: (claim: { append: string; render: () => unknown }) => () => void
    toast: {
      show: (o: { message: string; variant?: string; duration?: number; title?: string }) => void
    }
    dialog: { alert: (o: { title: string; message: string }) => Promise<void> }
  }
  keymap: { layer: (fn: () => unknown) => void }
  data?: {
    on: (
      type: string,
      handler: (event: { properties?: { sessionID?: string } }) => void
    ) => () => void
    session: {
      list: () => Array<{ id: string }>
      status: (id: string) => "idle" | "running"
    }
  }
}

export default {
  id: "opencode-go-usage.tui",
  setup(context: SlotContext) {
    let visible = true
    let generating = false
    let sidebarText = ""
    let timer: ReturnType<typeof setTimeout> | undefined
    let unregSidebar: (() => void) | undefined

    // --- keymap: dialog command + sidebar toggle.
    // setup() runs OUTSIDE the Solid tree in this beta, so keymap.layer must be
    // registered from a slot render (built-in plugins do exactly this).
    const unregisterCommands = context.ui.slot({
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
            {
              id: "go-usage.sidebar",
              title: "Toggle Go usage in sidebar",
              group: "Go",
              palette: true,
              run: () => {
                visible = !visible
                if (visible) void poll()
                mountSidebar()
              },
            },
          ],
        }))
        return null
      },
    })

    // --- sidebar. opentui requires text nodes to live inside a <text> element,
    // so build one via the shared renderer helpers (module specifier is aliased
    // to the host singleton by ensureRuntimePluginSupport).
    function mountSidebar() {
      unregSidebar?.()
      unregSidebar = undefined
      if (!visible) return
      unregSidebar = context.ui.slot({
        append: "sidebar.content",
        render: () => {
          const el = createElement("text")
          insert(el, sidebarText)
          return el
        },
      })
    }

    function anySessionRunning(): boolean {
      try {
        return (
          context.data?.session
            .list()
            .some((s) => context.data!.session.status(s.id) === "running") ?? false
        )
      } catch {
        return generating
      }
    }

    async function poll() {
      try {
        const t = await sidebarReport()
        if (t !== sidebarText) {
          sidebarText = t
          if (visible) mountSidebar()
        }
      } catch {}
    }

    function schedule() {
      clearTimeout(timer)
      timer = setTimeout(
        () => {
          void poll().then(schedule)
        },
        generating ? POLL_ACTIVE_MS : POLL_IDLE_MS
      )
    }

    // Poll shortly after a message finishes so counters feel live.
    function onSettled() {
      generating = anySessionRunning()
      setTimeout(() => void poll(), AFTER_MESSAGE_MS)
      schedule()
    }

    // --- events (defensive: older betas may not expose data)
    const offs: Array<() => void> = []
    const data = context.data
    if (data) {
      try {
        offs.push(data.on("session.execution.started", () => (generating = true)))
        offs.push(data.on("session.execution.succeeded", () => onSettled()))
        offs.push(data.on("session.execution.failed", () => onSettled()))
        offs.push(data.on("session.execution.interrupted", () => onSettled()))
        offs.push(data.on("session.idle", () => onSettled()))
      } catch {}
    }

    void poll().then(() => {
      mountSidebar()
      schedule()
    })

    return () => {
      clearTimeout(timer)
      offs.forEach((off) => off())
      unregSidebar?.()
      unregisterCommands()
    }
  },
}
