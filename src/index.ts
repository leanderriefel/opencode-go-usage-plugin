import { Plugin } from "@opencode-ai/plugin"
import { report } from "./lib/report.js"

export default Plugin.define({
  id: "opencode-go-usage",
  tui: true,
  async setup(ctx) {
    await ctx.tool.transform((d) => {
      d.add({
        name: "go_usage",
        description: "Get Go usage",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        execute: async () => ({ content: await report(ctx as never) }),
      })
    })
  },
})
