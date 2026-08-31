import type { ParsedUsage, RawUsage } from "./types.js"

export const URL = "https://opencode.ai/zen/go/v1/usage"

const LABEL: Record<string, string> = { rolling: "5h", weekly: "7d", monthly: "30d" }

function clamp(v: number | string | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
}

function date(v: number | string | null | undefined): Date | null {
  if (v == null) return null
  if (typeof v === "number") {
    const d = new Date(v < 1e12 ? v * 1000 : v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  if (!s) return null
  if (/^-?\d+(\.\d+)?$/.test(s)) return date(Number(s))
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function parse(json: RawUsage): ParsedUsage | null {
  if (!json.usage) return null
  const w: ParsedUsage["windows"] = []
  for (const k of ["rolling", "weekly", "monthly"] as const) {
    const r = json.usage[k]
    if (!r) continue
    w.push({ label: LABEL[k], percent: clamp(r.percent), resetsAt: date(r.resetsAt) })
  }
  return w.length ? { windows: w } : null
}

export async function fetchUsage(key: string): Promise<RawUsage> {
  const r = await fetch(URL, { headers: { Authorization: `Bearer ${key}` } })
  if (!r.ok) {
    const b = (await r.text().catch(() => "")).slice(0, 400)
    const e = new Error(`Go ${r.status} ${r.statusText}${b ? `: ${b}` : ""}`) as Error & {
      status?: number
    }
    e.status = r.status
    throw e
  }
  return (await r.json()) as RawUsage
}

export function dur(ms: number): string {
  if (ms <= 0) return "now"
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`
}

export function resetsIn(d: Date | null, now = Date.now()): string {
  if (!d) return "unknown"
  const diff = d.getTime() - now
  return diff <= 0 ? "now" : `in ${dur(diff)}`
}

export function bar(p: number, w = 20): string {
  const f = Math.round((clamp(p) / 100) * w)
  return "|".repeat(f) + ".".repeat(w - f)
}
