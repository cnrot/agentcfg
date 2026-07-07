# Task 2: 模板文件（gitignore + hook 配置模板）

## 文件
- Create: `C:\Users\admin\config-mgr\templates\gitignore`（分发给用户的 .gitignore 模板）
- Create: `C:\Users\admin\config-mgr\templates\hooks-claude.json`
- Create: `C:\Users\admin\config-mgr\templates\hooks-cursor.json`
- Create: `C:\Users\admin\config-mgr\templates\hooks-codex.json`
- Create: `C:\Users\admin\config-mgr\templates\plugin-opencode.ts`

## 约束
- 所有模板使用 `__COMMIT_SCRIPT__` 占位符，安装时替换为真实路径
- 零外部 npm 依赖

## 步骤
1. 创建 templates/gitignore（内容见下方）
2. 创建 templates/hooks-claude.json
3. 创建 templates/hooks-cursor.json
4. 创建 templates/hooks-codex.json
5. 创建 templates/plugin-opencode.ts
6. 验证所有模板文件存在且非空
7. 提交

## 模板内容

### templates/gitignore
```
# config-mgr: 临时文件和缓存排除
# 已追踪文件不受 gitignore 影响

# 旧备份体系（废弃）
backups/

# 运行时缓存
.runtime/
file-history/
shell-snapshots/

# 会话缓存
sessions/
session-env/

# 插件缓存
plugins/cache/

# 临时文件
stats-cache.json
desktop-server-state.json
*.bak.*
```

### templates/hooks-claude.json
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "all",
        "hooks": [
          {
            "type": "command",
            "command": "__COMMIT_SCRIPT__ --source pre_tool",
            "statusMessage": "config-mgr: 检测配置文件变更"
          }
        ]
      }
    ]
  }
}
```

### templates/hooks-cursor.json
```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "__COMMIT_SCRIPT__ --source pre_shell"
      }
    ],
    "afterFileEdit": [
      {
        "command": "__COMMIT_SCRIPT__ --source post_edit"
      }
    ]
  }
}
```

### templates/hooks-codex.json
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "__COMMIT_SCRIPT__ --source pre_tool",
            "statusMessage": "config-mgr: snapshotting"
          }
        ]
      }
    ]
  }
}
```

### templates/plugin-opencode.ts
```typescript
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
```

## 报告文件
完成后写入 C:\Users\admin\config-mgr\.superpowers\sdd\task-2-report.md
