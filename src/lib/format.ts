import type { ParsedUsage } from "./types.js"
import { bar, when } from "./go-usage.js"

export function md(u: ParsedUsage, now = Date.now()): string {
  const l = [
    "### OpenCode Go — Usage",
    `> Fetched: ${new Date(now)
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, " UTC")}`,
    "",
    "| Window | Used | Remaining | Resets |",
    "|--------|------|-----------|--------|",
  ]
  for (const w of u.windows)
    l.push(
      `| ${w.label} | ${w.percent.toFixed(1)}% | ${(100 - w.percent).toFixed(1)}% | ${when(w.resetsAt, now)} |`
    )
  l.push(
    "",
    ...u.windows.map((w) => `\`${w.label.padEnd(7)}\` ${bar(w.percent)} ${w.percent.toFixed(1)}%`),
    "",
    "> Limits: `5h` $12 · `7d` $30 · `30d` $60"
  )
  return l.join("\n")
}

export function err(msg: string, help?: string): string {
  return ["### Go — Error", "", msg, ...(help ? ["", help] : [])].join("\n")
}
