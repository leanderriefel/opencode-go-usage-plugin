export interface GoUsageWindowRaw {
  percent: number
  resetsAt: number | string | null | undefined
}

export interface GoUsageResponseRaw {
  usage?: {
    rolling?: GoUsageWindowRaw
    weekly?: GoUsageWindowRaw
    monthly?: GoUsageWindowRaw
  }
}

export interface ParsedWindow {
  key: "rolling" | "weekly" | "monthly"
  label: string
  windowMinutes: number | null
  percent: number
  resetsAt: Date | null
}

export interface ParsedUsage {
  raw: GoUsageResponseRaw
  windows: ParsedWindow[]
}

export interface FetchResult {
  ok: boolean
  status: number
  parsed?: ParsedUsage
  error?: string
  retryAfter?: string
}
