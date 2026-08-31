import { createElement, insert } from "@opentui/solid"
import { report, sidebarReport } from "./lib/report.js"

const POLL_ACTIVE_MS = 30_000 // generating with a Go model
const POLL_IDLE_MS = 120_000 // Go model selected, idle
const POLL_MODEL_CHECK_MS = 60_000 // no Go model - only watch for switches
const AFTER_MESSAGE_MS = 5_000 // shortly after a message finishes

const GO_PROVIDERS = new Set(["opencode-go"])

type SessionLike = { id: string; model?: { providerID?: string }; time?: { updated?: number } }
type SlotContext = {
  ui: {
    slot: (claim: { append: string; render: (t: { sessionID?: string }) => unknown }) => () => void
    toast: {
      show: (o: { message: string; variant?: string; duration?: number; title?: string }) => void
    }
    dialog: { alert: (o: { title: string; message: string }) => Promise<void> }
  }
  keymap: { layer: (fn: () => unknown) => void }
  data?: {
    on: (type: string, handler: (event: any) => void) => () => void
    session: {
      list: () => SessionLike[]
      get: (id: string) => SessionLike | undefined
      status: (id: string) => "idle" | "running"
    }
  }
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
    // Fallback for betas where session info lacks the model field:
    // sessionID -> providerID, kept fresh via session.model.selected events.
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
    //
    // The text content is an accessor so it re-evaluates reactively when the
    // viewed session (or its model) changes - each chat can have a different
    // model, so the panel tracks the session the sidebar is showing.
    function mountSidebar() {
      unregSidebar?.()
      unregSidebar = undefined
      if (!visible) return
      unregSidebar = context.ui.slot({
        append: "sidebar.content",
        render: (t) => {
          const el = createElement("text")
          insert(el, () => {
            if (!visible) return ""
            const provider = providerForSession(t?.sessionID)
            return provider && GO_PROVIDERS.has(provider) ? sidebarText : ""
          })
          return el
        },
      })
    }

    function providerForSession(sessionID?: string): string | undefined {
      if (!sessionID) return undefined
      const s = context.data?.session.get(sessionID)
      return s?.model?.providerID ?? modelBySession.get(sessionID)
    }

    function anyGoSession(): boolean {
      try {
        return context.data!.session.list().some((s) => {
          const p = s.model?.providerID ?? modelBySession.get(s.id)
          return p != null && GO_PROVIDERS.has(p)
        })
      } catch {
        return goInUse
      }
    }

    async function tick() {
      goInUse = anyGoSession()
      if (visible && goInUse) {
        try {
          const t = await sidebarReport()
          if (t !== sidebarText) sidebarText = t
        } catch {}
      }
      mountSidebar()
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
      generating =
        context.data?.session
          .list()
          .some((s) => context.data!.session.status(s.id) === "running") ?? false
      setTimeout(() => void tick(), AFTER_MESSAGE_MS)
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
        // Model switches: update the map and refresh the panel instantly.
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
