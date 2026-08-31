// Server entry exists only to advertise the TUI plugin (see ./tui).
// Plain { id, setup, tui } shape - no @opencode-ai/plugin import needed.
export default {
  id: "opencode-go-usage",
  tui: true,
  setup() {},
}
