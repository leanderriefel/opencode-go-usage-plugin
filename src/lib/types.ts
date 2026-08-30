export type RawWindow = { percent?: number; resetsAt?: number | string | null }
export type RawUsage = { usage?: { rolling?: RawWindow; weekly?: RawWindow; monthly?: RawWindow } }
export type Window = { label: string; percent: number; resetsAt: Date | null }
export type ParsedUsage = { windows: Window[] }
