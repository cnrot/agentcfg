import type { Plugin } from "@opencode-ai/plugin";

export const ConfigMgrPlugin: Plugin = async (ctx) => {
  const targetDir = ctx.project.worktree || ctx.directory;
  return {
    "tool.execute.before": async ({ tool }) => {
      await ctx.$`cd ${targetDir} && git add . && git diff --cached --quiet || git commit -m "auto: snapshot before ${tool}"`;
    },
    "file.edited": async ({ filePath }) => {
      if (filePath.includes(".opencode")) {
        await ctx.$`cd ${targetDir} && git add . && git diff --cached --quiet || git commit -m "auto: snapshot after edit ${filePath}"`;
      }
    },
  };
};
