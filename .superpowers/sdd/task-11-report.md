# Task 11: OpenCode hook 适配器

**状态**: DONE

## 变更内容

### 新建文件
- `src/hooks/opencode.js` — OpenCode 插件适配器，提供安装/卸载功能
- `src/hooks/opencode.test.js` — 完整测试（12 个断言全部通过）

### 功能说明

| 函数 | 说明 |
|---|---|
| `installOpencodeHooks(opencodeDir)` | 创建 plugins 目录，从模板复制 `plugin-opencode.ts` |
| `uninstallOpencodeHooks(opencodeDir)` | 备份原文件 + 删除插件文件 |

### 测试覆盖

1. **安装成功** — 创建 `.opencode/plugins/config-mgr.ts`，内容匹配模板
2. **重复安装幂等** — 文件已存在时返回 `installed: false`
3. **卸载成功** — 删除插件文件并创建 `.bak` 备份
4. **插件不存在时卸载** — 优雅返回 `uninstalled: false`

### 提交

```
4a27135 feat: implement OpenCode plugin adapter
```
