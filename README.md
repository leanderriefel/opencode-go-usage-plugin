# opencode-go-usage-plugin

`/go-usage` for OpenCode 2 (`opencode2`) — shows current [OpenCode Go](https://opencode.ai/go) usage via `GET https://opencode.ai/zen/go/v1/usage`. No LLM.

- Server: `/go-usage` (synthetic, no model) + tool `go_usage`
- TUI: `/go-usage` dialog/toast

## Install

```bash
npm i opencode-go-usage-plugin
```

`opencode.jsonc`:

```jsonc
{ "$schema": "https://opencode.ai/config.json", "plugins": ["opencode-go-usage-plugin"] }
```

Restart:

```bash
opencode2 service restart
```

## Usage

```
/go-usage
```

Shows `5h` / `7d` / `30d` windows (`$12`/`$30`/`$60`). Needs Go connected.

Not connected? `/connect` → **OpenCode Go** → paste key from https://opencode.ai/go, or set `OPENCODE_API_KEY`.

## How it works

- Endpoint: `GET https://opencode.ai/zen/go/v1/usage` with `Bearer <key>` → `{ usage: { rolling: { percent, resetsAt }, weekly, monthly } }`
- Auth: `integration:opencode-go` / `opencode` → `env:OPENCODE_API_KEY` → `auth.json`
- Plugin: `Plugin.define` → `ctx.command.transform` → `ctx.session.synthetic`; TUI `keymap.layer` → `ui.dialog` ( https://opencode.ai/v2/docs/build/plugins )

## Dev

```bash
npm i
npm run check # typecheck + lint + format
npm run build # → dist/
```

Requires Node `>=24`, TypeScript `7`.

## License

MIT
