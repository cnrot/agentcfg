import type { Plugin } from "@opencode-ai/plugin";

/**
 * 显式单引号包裹 + 内部单引号转义，避免 shell 注入
 * targetDir 来自 ctx.project.worktree || ctx.directory，理论上可控
 * tool 来自 hook 事件 payload，外部可能传入恶意字符串
 */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export const ConfigMgrPlugin: Plugin = async (ctx) => {
  const targetDir = ctx.project.worktree || ctx.directory;
  const safeDir = shellQuote(targetDir);
  return {
    "tool.execute.before": async ({ tool }) => {
      const safeTool = shellQuote(tool);
      await ctx.$`cd ${safeDir} && git add . && git diff --cached --quiet || git -c user.name=agentcfg -c user.email=agentcfg@local commit --no-verify --no-gpg-sign -m "auto: snapshot before ${safeTool}"`;
    },
    "file.edited": async ({ filePath }) => {
      const safeFile = shellQuote(filePath);
      await ctx.$`cd ${safeDir} && git add . && git diff --cached --quiet || git -c user.name=agentcfg -c user.email=agentcfg@local commit --no-verify --no-gpg-sign -m "auto: snapshot after edit ${safeFile}"`;
    },
  };
};
