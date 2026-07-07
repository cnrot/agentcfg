# Task 12: 统一安装入口 install.js

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `src/install.js`

## 接口
- 入口函数: `install()`（default export）
- 内部: `detectAgents()` → 扫描环境中的 agent 目录
- 依赖: `src/core/init.js`, `src/hooks/claude.js`, `src/hooks/cursor.js`, `src/hooks/codex.js`, `src/hooks/opencode.js`

## 完整代码
见计划文件第 1155-1270 行。直接从: C:\Users\admin\config-mgr\docs\superpowers\plans\2026-07-07-config-mgr-implementation.md 复制该段内容

⚠️ 注意：代码中需要在顶部添加 `import { readFileSync, writeFileSync } from 'fs';`

## 步骤
1. 创建 src/install.js
2. 创建 src/install.test.js（覆盖：无 agent 时正常提示、检测到 agent 时执行安装）
3. 运行测试全部通过
4. 提交 + 报告
