import type { GoUsageResponseRaw, ParsedUsage, ParsedWindow } from "./types.js"

export const GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage"

const WINDOW_META: Record<ParsedWindow["key"], { label: string; minutes: number | null }> = {
  rolling: { label: "5h", minutes: 300 },
  weekly: { label: "7 days", minutes: 10080 },
  monthly: { label: "30 days", minutes: 43200 },
}

export function clampPercent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

export function parseResetsAt(value: unknown): Date | null {
  if (value == null) return null
  if (typeof value === "number") {
    // Heuristic: < 1e12 => seconds, else ms (covers both s and ms epochs)
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    // Numeric string?
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed)
      if (Number.isFinite(n)) return parseResetsAt(n)
    }
    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function parseGoUsageResponse(json: unknown, nowMs = Date.now()): ParsedUsage | null {
  if (!json || typeof json !== "object") return null
  const obj = json as GoUsageResponseRaw
  if (!obj.usage || typeof obj.usage !== "object") return null

  const windows: ParsedWindow[] = []
  for (const key of ["rolling", "weekly", "monthly"] as const) {
    const raw = obj.usage[key]
    if (!raw) continue
    const percent = clampPercent((raw as { percent?: unknown }).percent)
    const resetsAt = parseResetsAt((raw as { resetsAt?: unknown }).resetsAt)
    // If resetsAt is in the past due to clock skew, still keep it - formatter will show "now"
    void nowMs
    windows.push({
      key,
      label: WINDOW_META[key].label,
      windowMinutes: WINDOW_META[key].minutes,
      percent,
      resetsAt,
    })
  }

  if (windows.length === 0) return null
  return { raw: obj, windows }
}

export async function fetchGoUsage(
  apiKey: string,
  signal?: AbortSignal
): Promise<GoUsageResponseRaw> {
  const res = await fetch(GO_USAGE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    const err: Error & { status?: number; body?: string } = new Error(
      `Go usage request failed (${res.status} ${res.statusText})${body ? `: ${body.slice(0, 500)}` : ""}`
    )
    err.status = res.status
    err.body = body
    throw err
  }

  const json = (await res.json()) as GoUsageResponseRaw
  return json
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "now"
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m`
  return `${totalSec}s`
}

export function formatResetsAt(d: Date | null, nowMs = Date.now()): string {
  if (!d) return "unknown"
  const diff = d.getTime() - nowMs
  const relative = diff <= 0 ? "now" : `in ${formatDurationMs(diff)}`
  // Use UTC to avoid local TZ confusion in reports; include ISO short
  const iso = d
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC")
  return `${relative} (${iso})`
}

export function bar(percent: number, width = 20): string {
  const p = clampPercent(percent)
  const filled = Math.round((p / 100) * width)
  const empty = width - filled
  // Use block chars that render well in markdown/code
  return "█".repeat(filled) + "░".repeat(empty)
}
