# opencode-go-usage-plugin

OpenCode **2 (beta, `opencode2`)** plugin that adds slash commands to view your current **OpenCode Go (Zen Go)** usage & quota — directly from the hosted Go API, no LLM calls.

- Server commands (work in TUI, web, desktop): `/go-usage` + aliases `/go` `/gousage` `/usage-go`
- TUI slash + command palette + local dialog/toast (zero transcript pollution)
- Tool `go_usage` so the agent can answer “what’s my Go usage?”
- Graceful “not connected” help, and proper `401`/`403` handling
- Modern TS + `oxlint` + `oxfmt`, ESM, typed for `@opencode-ai/plugin@beta`

> **Heavily researched** against the live Go stack — see [How it works](#how-it-works) for endpoint, auth, and “connected” semantics.

---

## Install

```bash
# npm / bun / pnpm — use whichever you use for opencode2 global install
npm i -g @opencode-ai/cli@beta
# or: bun add -g @opencode-ai/cli@beta --trust
# or: pnpm add -g @opencode-ai/cli@beta --allow-build=@opencode-ai/cli

# Project-local (recommended) — adds plugin for this repo only
npm i -D opencode-go-usage-plugin
# or as a global plugin
npm i -g opencode-go-usage-plugin
```

Add to OpenCode config (any `opencode.json(c)` or `.opencode/opencode.json(c)`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-go-usage-plugin"],
}
```

Local dev (no publish):

```jsonc
{
  "plugins": ["./src/index.ts"],
  // tui auto-loads via tui:true; no extra cli.json needed. CLI-only override: cli.json -> plugins: ["opencode-go-usage-plugin"]
}
```

Restart / reload the OpenCode service:

```bash
opencode2 service restart
opencode2 service status
```

---

## Usage

In the TUI (or any OpenCode surface for the server commands):

```
/go-usage
/go
/gousage
/usage-go
```

All four do the same: fetch `GET https://opencode.ai/zen/go/v1/usage` with your connected Go key and inject a **synthetic** markdown report into the transcript (no model call). Limits are `$12 / 5h`, `$30 / 7d`, `$60 / 30d` (rolling).

**TUI:** the same names show a local dialog (`ui.dialog.alert`) with toast fallback — no transcript injection, so your context stays clean.

**Agent tool:** ask naturally — “what’s my Go usage?” — the model can call `go_usage` (no args) and render the same markdown.

### Palette

Open palette → “Show OpenCode Go usage” (group **Go**) works even without a slash.

---

## How it works

### Endpoint

| Field   | Value                                                      |
| ------- | ---------------------------------------------------------- |
| URL     | `GET https://opencode.ai/zen/go/v1/usage`                  |
| Auth    | `Authorization: Bearer <OPENCODE_API_KEY>`                 |
| Rate    | gateway-enforced, `429` bubbled as error                   |
| Success | `200` with JSON                                            |
| Errors  | `401` invalid key, `403` valid key without Go subscription |

`https://opencode.ai/zen/go/v1/models` is public and used only for docs; usage is **hosted** — there is no local `opencode` server endpoint for Go billing (verified against `https://opencode.ai/v2/openapi.json` / `packages/sdk/openapi.json`).

### Response shape (canonical, two independent parsers agree)

```json
{
  "usage": {
    "rolling": { "percent": 42.5, "resetsAt": 1735680000000 },
    "weekly": { "percent": 17.0, "resetsAt": "2026-01-01T00:00:00.000Z" },
    "monthly": { "percent": 5.1, "resetsAt": 1735680000 }
  }
}
```

- `percent` → `usedPercent` clamped `0‥100`
- `resetsAt` → `Date` parsed from epoch **ms**, epoch **s**, numeric string, or ISO 8601 (mirrors `canvassy`/`synara` parsers)
- Windows: `rolling = 5h (300m)`, `weekly = 7d (10080m)`, `monthly = 30d-ish (43200m)`; labels & limits from https://opencode.ai/docs/go/#usage-limits

### Auth

Go and Zen share one key. Provider ID is **`opencode-go`** (Zen is `opencode`):

- `models.dev` catalog: `opencode-go = { env: ["OPENCODE_API_KEY"], api: "https://opencode.ai/zen/go/v1", npm: "@ai-sdk/openai-compatible" }` — https://opencode.ai/docs/zen
- Docs: `opencode-go/<model>` e.g. `opencode-go/kimi-k3` — https://opencode.ai/docs/go/#endpoints
- Per-model routes under the same base: `/chat/completions` (glm/kimi/deepseek), `/messages` (minimax/qwen), `/responses` (grok/gpt-5.6-luna/Muse), `/models` (list).

Key resolution order (first hit wins), mirroring `howdeploy/CanvasTTY` + `Emanuele-web04/synara`:

1. **Integration (preferred)** — `ctx.integration.connection.active("opencode-go")` then `"opencode"` → `connection.resolve` → `{type:"api", key}` — this is `auth.json`'s live credential.  
   `auth.json` shape: `{ "opencode-go": { "type":"api","key":"..." }, "opencode": { "type":"api","key":"..." } }`
2. **Env** — `OPENCODE_API_KEY` → `OPENCODE_GO_API_KEY` → `OPENCODE_ZEN_API_KEY`
3. **File** — `XDG_DATA_HOME/opencode/auth.json` → `%LOCALAPPDATA%/opencode/auth.json` (win) → `~/Library/Application Support/opencode/auth.json` (mac) → `~/.local/share/opencode/auth.json` (fallback)

“Connected” means **integration** has an active connection, not just catalog listing (`ctx.catalog.provider.list()` may still list the provider as disabled when `autoload:false`). The plugin checks `ctx.integration.connection.active` first.

### Plugin wiring (beta v2)

- **Server** — `import { Plugin } from "@opencode-ai/plugin"` → `Plugin.define({ id, tui:true, setup(ctx) })` → `ctx.command.transform` registers `/go*` → `ctx.session.synthetic` injects markdown → `ctx.tool.transform` adds `go_usage` (see https://opencode.ai/v2/docs/build/plugins)
- **TUI** — `import { Plugin } from "@opencode-ai/plugin/tui"` → `Plugin.define({ id, setup(context) })` → `context.keymap.layer` registers `slash: { name: "go-usage", aliases: ["go","gousage","usage-go"] }` → `context.ui.dialog.alert` / `toast` (see https://opencode.ai/v2/docs/build/plugins/cli), auto-loaded via `tui:true` and `exports["./tui"]` (`@opentui/core`/`@opentui/solid` + `solid-js` peers, `jsxImportSource: @opentui/solid`).

---

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint --type-aware
npm run format      # oxfmt --check .  (use format:fix to write)
npm run build       # tsc -p tsconfig.json -> dist/
```

### Project layout

```
src/
  index.ts          # server plugin — commands + tool
  tui.tsx           # TUI plugin — keymap layer, dialog/toast
  lib/
    auth.ts         # key discovery (integration/env/file + help text)
    go-usage.ts     # fetch + parse + bar helpers
    format.ts       # markdown + compact formatters
    types.ts        # usage shapes
```

### Plugin spec / package shape

`package.json` exposes both beta and v1-compatible entries so `opencode2` resolves it in all modes:

```json
{
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/index.js",
    "./tui": "./dist/tui.js"
  }
}
```

Local `.opencode/plugins/` single-file plugins still import `from "@opencode-ai/plugin"` and use `Plugin.define`.

---

## Troubleshooting

**`/go-usage` says “Not connected”**

- TUI: `/connect` → **OpenCode Go** → paste key from https://opencode.ai/go
- Env: `OPENCODE_API_KEY=...` then `opencode2 service restart`
- Verify: `cat ~/.local/share/opencode/auth.json` (or `%LOCALAPPDATA%/opencode/auth.json` on Windows) contains `opencode-go`

**`401 Unauthorized`**

- Key invalid or rotated — re-connect, then restart service.

**`403 Forbidden`**

- Key has no Go subscription — https://opencode.ai/go ($10/mo). The hosted gateway returns `403` for non-subscribers even with a valid Zen key.

**Dialog not showing (TUI)**

- Palette still works (`Show OpenCode Go usage`). Toast fallback is used if `ui.dialog.alert` is unavailable on your `opencode2` channel — update `opencode2` (`npm i -g @opencode-ai/cli@beta`) and restart.

**Want raw JSON?**

- Tool `go_usage` returns markdown; the underlying fetch is `GET https://opencode.ai/zen/go/v1/usage` with Bearer. Inspect with:  
  `curl -H "Authorization: Bearer $OPENCODE_API_KEY" https://opencode.ai/zen/go/v1/usage | jq`

---

## Publishing

```bash
npm run check   # typecheck + lint + format
npm run build
npm publish --access public
# tag: npm dist-tag add opencode-go-usage-plugin@0.1.0 beta (if you ship a beta channel)
```

Recommended: add `engines: { opencode: ">=2.0.0-beta" }` once `2.0` stabilizes.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Credits

Go gateway, provider catalog, and auth flow are from the OpenCode team and `models.dev`. This plugin is an independent community integration — not affiliated with or endorsed by OpenCode/SST. Parsers cross-checked against `synara` and `CanvasTTY` implementations.
