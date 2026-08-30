import fs from "node:fs"
import path from "node:path"
import os from "node:os"

export type FoundKey = { key: string; source: string }
type Cred = { key?: string; token?: string; apiKey?: string }
type Conn = { id: string; label: string }

function clean(s: string): string {
  return s
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^bearer\s+/i, "")
}

function fromEnv(): FoundKey | null {
  for (const k of ["OPENCODE_API_KEY", "OPENCODE_GO_API_KEY", "OPENCODE_ZEN_API_KEY"] as const) {
    const v = process.env[k]
    if (v?.trim()) return { key: clean(v), source: `env:${k}` }
  }
  return null
}

function toKey(v: string | Cred | null | undefined): string | null {
  if (!v) return null
  if (typeof v === "string") return clean(v) || null
  for (const f of ["key", "token", "apiKey"] as const) {
    const s = v[f]
    if (typeof s === "string" && s.trim()) return clean(s)
  }
  return null
}

function paths(): string[] {
  const a: string[] = []
  if (process.env.XDG_DATA_HOME) a.push(path.join(process.env.XDG_DATA_HOME, "opencode/auth.json"))
  if (process.env.LOCALAPPDATA) a.push(path.join(process.env.LOCALAPPDATA, "opencode/auth.json"))
  a.push(path.join(os.homedir(), "Library/Application Support/opencode/auth.json"))
  a.push(path.join(os.homedir(), ".local/share/opencode/auth.json"))
  return [...new Set(a)]
}

function fromFile(): FoundKey | null {
  for (const p of paths()) {
    try {
      if (!fs.existsSync(p)) continue
      const j = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string | Cred>
      for (const id of ["opencode-go", "opencode"] as const) {
        const k = toKey(j[id])
        if (k) return { key: k, source: `auth.json:${id}` }
      }
    } catch {}
  }
  return null
}

export async function discoverKey(ctx?: {
  integration: {
    connection: {
      active: (id: string) => Promise<Conn | undefined>
      resolve: (c: Conn) => Promise<string | Cred | null | undefined>
    }
  }
}): Promise<FoundKey | null> {
  if (ctx) {
    for (const id of ["opencode-go", "opencode"] as const) {
      try {
        const c = await ctx.integration.connection.active(id)
        if (!c) continue
        const k = toKey(await ctx.integration.connection.resolve(c))
        if (k) return { key: k, source: `integration:${id}` }
      } catch {}
    }
  }
  return fromEnv() ?? fromFile()
}

export function help(): string {
  return [
    "/connect → OpenCode Go → paste key from https://opencode.ai/go",
    "or set OPENCODE_API_KEY and restart.",
  ].join("\n")
}
