import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

const GO_INTEGRATION_IDS = ["opencode-go", "opencode"] as const
const GO_ENV_VARS = ["OPENCODE_API_KEY", "OPENCODE_GO_API_KEY", "OPENCODE_ZEN_API_KEY"] as const

export type FoundKey = {
  key: string
  source: string
}

export function cleanKey(raw: string): string {
  const t = raw.trim()
  // Strip surrounding quotes if present
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim()
  }
  // Strip Bearer prefix
  if (/^bearer\s+/i.test(t)) return t.replace(/^bearer\s+/i, "").trim()
  return t
}

export function keyFromEnv(): FoundKey | null {
  for (const name of GO_ENV_VARS) {
    const v = process.env[name]
    if (v && v.trim()) {
      const k = cleanKey(v)
      if (k) return { key: k, source: `env:${name}` }
    }
  }
  return null
}

export function normalizeCredentialValue(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") {
    const c = cleanKey(value)
    return c || null
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    // Common shapes: {type:"api", key:"..."} , {key:"..."} , {token:"..."} , {value:"..."} , {apiKey:"..."}
    for (const k of ["key", "token", "value", "apiKey", "secret"]) {
      const v = obj[k]
      if (typeof v === "string" && v.trim()) {
        const c = cleanKey(v)
        if (c) return c
      }
    }
    // Nested credential?
    if (obj.credentials && typeof obj.credentials === "object") {
      const nested = normalizeCredentialValue(obj.credentials)
      if (nested) return nested
    }
    // Sometimes credential is { data: { key: "..." } }
    if (obj.data && typeof obj.data === "object") {
      const nested = normalizeCredentialValue(obj.data)
      if (nested) return nested
    }
  }
  return null
}

export function candidateAuthPaths(): string[] {
  const paths: string[] = []
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) paths.push(path.join(xdg, "opencode", "auth.json"))
  // Windows
  if (process.env.LOCALAPPDATA)
    paths.push(path.join(process.env.LOCALAPPDATA, "opencode", "auth.json"))
  // macOS
  paths.push(path.join(os.homedir(), "Library", "Application Support", "opencode", "auth.json"))
  // Linux fallback / generic
  paths.push(path.join(os.homedir(), ".local", "share", "opencode", "auth.json"))
  // Legacy data dir
  const appData = process.env.APPDATA
  if (appData) paths.push(path.join(appData, "opencode", "auth.json"))
  return [...new Set(paths)]
}

export function keyFromAuthFile(): FoundKey | null {
  for (const p of candidateAuthPaths()) {
    try {
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, "utf8")
      const json = JSON.parse(raw) as Record<string, unknown>
      for (const providerId of GO_INTEGRATION_IDS) {
        const entry = json[providerId]
        const k = normalizeCredentialValue(entry)
        if (k) return { key: k, source: `auth.json:${providerId} @ ${p}` }
      }
    } catch {
      // Ignore parse errors, missing files
    }
  }
  return null
}

export async function resolveGoKeyViaIntegration(ctx: {
  integration: {
    connection: {
      active: (id: string) => Promise<unknown>
      resolve: (conn: unknown) => Promise<unknown>
    }
  }
}): Promise<FoundKey | null> {
  for (const id of GO_INTEGRATION_IDS) {
    try {
      const conn = await ctx.integration.connection.active(id)
      if (!conn) continue
      const cred = await ctx.integration.connection.resolve(conn as never)
      const k = normalizeCredentialValue(cred)
      if (k) return { key: k, source: `integration:${id}` }
      // If resolve returned undefined but connection exists, fall through to file/env
    } catch {
      // ignore
    }
  }
  return null
}

export async function discoverGoKey(ctx?: {
  integration?: {
    connection: {
      active: (id: string) => Promise<unknown>
      resolve: (conn: unknown) => Promise<unknown>
    }
  }
}): Promise<FoundKey | null> {
  if (ctx?.integration) {
    const viaIntegration = await resolveGoKeyViaIntegration(ctx as never)
    if (viaIntegration) return viaIntegration
  }
  const viaEnv = keyFromEnv()
  if (viaEnv) return viaEnv
  const viaFile = keyFromAuthFile()
  if (viaFile) return viaFile
  return null
}

export function helpNotConnected(): string {
  return [
    "OpenCode Go is not connected.",
    "",
    "Fix with one of:",
    "  • In the TUI run `/connect` → select **OpenCode Go** → paste your API key",
    "  • Set env `OPENCODE_API_KEY` (or `OPENCODE_GO_API_KEY`) and restart the server",
    '  • Ensure `auth.json` contains `"opencode-go": {"type":"api","key":"..."}`',
    "",
    "Get a key at https://opencode.ai/go (docs: https://opencode.ai/docs/go/) — subscription is $10/mo.",
    "The usage endpoint is `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>`.",
  ].join("\n")
}
