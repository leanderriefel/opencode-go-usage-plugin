import type { ParsedUsage } from "./types.js"
import { bar, resetsIn } from "./go-usage.js"

function utc(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC")
}

export function md(u: ParsedUsage, now = Date.now()): string {
  const lines = ["OpenCode Go - Usage", `Fetched: ${utc(now)}`, ""]
  for (const w of u.windows) {
    lines.push(
      `${w.label.padEnd(4)} ${bar(w.percent)} ${w.percent.toFixed(1).padStart(5)}%  reset ${resetsIn(w.resetsAt, now)}`
    )
  }
  lines.push("", "Limits: 5h $12 | 7d $30 | 30d $60")
  return lines.join("\n")
}

export function err(msg: string, help?: string): string {
  return ["Go - Error", "", msg, ...(help ? ["", help] : [])].join("\n")
}
