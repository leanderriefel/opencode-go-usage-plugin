import { createElement, insert } from "@opentui/solid"
import { report, sidebarReport } from "./lib/report.js"

const POLL_ACTIVE_MS = 30_000 // generating with a Go model
const POLL_IDLE_MS = 120_000 // Go model selected, idle
const POLL_MODEL_CHECK_MS = 60_000 // no Go model - only watch for switches
const AFTER_MESSAGE_MS = 5_000 // shortly after a message finishes

const GO_PROVIDERS = new Set(["opencode-go"])

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
    on: (type: string, handler: (event: any) => void) => () => void
    session: {
      list: () => Array<{
        id: string
        model?: { providerID?: string }
        time?: { updated?: number }
      }>
      status: (id: string) => "idle" | "running"
    }
  }
}

function providerOf(
  session: { id: string; model?: { providerID?: string } } | undefined,
  fallback: Map<string, string>
): string | undefined {
  return session?.model?.providerID ?? fallback.get(session?.id ?? "")
}

export default {
  id: "opencode-go-usage.tui",
  setup(context: SlotContext) {
    let visible = true
    let goInUse = false
    let generating = false
    let sidebarText = ""
    let timer: ReturnType<typeof setTimeout> | undefined
    let unregSidebar: (() => void) | undefined
    const modelBySession = new Map<string, string>()

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
                void tick()
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
      if (!visible || !goInUse) return
      unregSidebar = context.ui.slot({
        append: "sidebar.content",
        render: () => {
          const el = createElement("text")
          insert(el, sidebarText)
          return el
        },
      })
    }

    function isGoInUse(): boolean {
      try {
        const sessions = [...(context.data?.session.list() ?? [])]
        const running = sessions.filter((s) => context.data!.session.status(s.id) === "running")
        const pool = running.length
          ? running.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))
          : sessions.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0)).slice(0, 1)
        return pool.some((s) => {
          const p = providerOf(s, modelBySession)
          return p != null && GO_PROVIDERS.has(p)
        })
      } catch {
        return goInUse
      }
    }

    function unmountIfHidden() {
      if ((!visible || !goInUse) && unregSidebar) {
        unregSidebar()
        unregSidebar = undefined
      }
    }

    async function tick() {
      goInUse = isGoInUse()
      if (visible && goInUse) {
        try {
          const t = await sidebarReport()
          if (t !== sidebarText) {
            sidebarText = t
            mountSidebar()
            return
          }
        } catch {}
      }
      unmountIfHidden()
    }

    function schedule() {
      clearTimeout(timer)
      const delay = !goInUse ? POLL_MODEL_CHECK_MS : generating ? POLL_ACTIVE_MS : POLL_IDLE_MS
      timer = setTimeout(() => {
        void tick().then(schedule)
      }, delay)
    }

    // Poll shortly after a message finishes so counters feel live.
    function onSettled() {
      generating = anySessionRunning()
      setTimeout(() => void tick(), AFTER_MESSAGE_MS)
      schedule()
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
        // model switches can add/remove the panel instantly
        offs.push(
          data.on("session.model.selected", (e: any) => {
            const d = e?.data ?? e?.properties
            const sessionID = d?.sessionID
            const provider = d?.model?.providerID
            if (sessionID && provider) {
              modelBySession.set(sessionID, provider)
              void tick()
            }
          })
        )
      } catch {}
    }

    void tick().then(schedule)

    return () => {
      clearTimeout(timer)
      offs.forEach((off) => off())
      unregSidebar?.()
      unregisterCommands()
    }
  },
}
