# opencode-go-usage-plugin

`/go-usage` for OpenCode 2 (`opencode2`) — shows current [OpenCode Go](https://opencode.ai/go) usage via `GET https://opencode.ai/zen/go/v1/usage`. No LLM calls.

- TUI: `/go-usage` opens a dialog with usage bars (5h / 7d / 30d)
- Sidebar: live usage panel while an OpenCode Go model is active (toggle via `ctrl+p`)

## Install

Paste this into an agent session:

```
Install the npm package "opencode-go-usage-plugin" and add it to the "plugin"
array in my global opencode config (~/.config/opencode/opencode.json), then
restart the opencode2 service.
```

Or manually:

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

Not connected? `/connect` -> **OpenCode Go** -> paste key from https://opencode.ai/go, or set `OPENCODE_API_KEY`.

## How it works

- Endpoint: `GET https://opencode.ai/zen/go/v1/usage` with `Bearer <key>` -> `{ usage: { rolling: { percent, resetsAt }, weekly, monthly } }`
- Auth: `integration:opencode-go` / `opencode` -> `env:OPENCODE_API_KEY` -> `auth.json`
- TUI plugin shape: `{ id, setup }` with `keymap.layer` registered from a `ui.slot` render (opencode2 beta Solid context requirement)

## Dev

```bash
npm i
npm run check # typecheck + lint + format
npm run build # -> dist/
```

Requires Node `>=24`, TypeScript `7`.

## License

MIT
