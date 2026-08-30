import type { ParsedUsage } from "./types.js"
import { bar, formatResetsAt } from "./go-usage.js"

export interface FormatOptions {
  nowMs?: number
  showBar?: boolean
  showLimits?: boolean
}

export function formatGoUsageMarkdown(usage: ParsedUsage, opts: FormatOptions = {}): string {
  const nowMs = opts.nowMs ?? Date.now()
  const showBar = opts.showBar ?? true

  const lines: string[] = []
  lines.push("### OpenCode Go — Usage")
  lines.push("")
  lines.push(
    `> Fetched: ${new Date(nowMs)
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, " UTC")} | Endpoint: \`GET https://opencode.ai/zen/go/v1/usage\` `
  )
  lines.push("")
  lines.push("| Window | Used | Remaining | Resets |")
  lines.push("|--------|------|-----------|--------|")

  for (const w of usage.windows) {
    const used = `${w.percent.toFixed(1)}%`
    const remaining = `${(100 - w.percent).toFixed(1)}%`
    const resets = formatResetsAt(w.resetsAt, nowMs)
    lines.push(`| ${w.label} | ${used} | ${remaining} | ${resets} |`)
  }

  if (showBar) {
    lines.push("")
    for (const w of usage.windows) {
      lines.push(`\`${w.label.padEnd(7)}\` ${bar(w.percent)} ${w.percent.toFixed(1)}%`)
    }
  }

  if (opts.showLimits ?? true) {
    lines.push("")
    lines.push("> **Limits:** `5h` — $12 · `7 days` — $30 · `30 days` — $60")
    lines.push("> Reset windows are rolling. See https://opencode.ai/docs/go/#usage-limits")
  }

  return lines.join("\n")
}

export function formatGoUsageCompact(usage: ParsedUsage, nowMs = Date.now()): string {
  const parts = usage.windows.map((w) => {
    const resets = w.resetsAt ? formatResetsAt(w.resetsAt, nowMs) : "unknown"
    return `${w.label}: ${w.percent.toFixed(0)}% (resets ${resets})`
  })
  return parts.join(" · ")
}

export function formatGoErrorMarkdown(message: string, help?: string): string {
  const lines = ["### OpenCode Go — Usage (error)", "", message]
  if (help) {
    lines.push("", help)
  }
  return lines.join("\n")
}
