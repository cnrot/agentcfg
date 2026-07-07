# Task 9: Cursor hook 适配器

**Status**: DONE

**提交**: 5abaa1e - feat: implement Cursor hook adapter

## 创建文件

- `src/hooks/cursor.js` — 逐字符复制任务说明中的完整代码
- `src/hooks/cursor.test.js` — 4 个测试用例覆盖核心场景

## 测试结果

全部 16 个断言通过，0 失败：

| Test | 断言 | 结果 |
|------|------|------|
| install succeeds and creates hooks.json | 7 | PASS |
| re-install is idempotent (skips) | 2 | PASS |
| uninstall removes hooks entries | 5 | PASS |
| uninstall handles missing hooks.json gracefully | 2 | PASS |

## 测试覆盖场景

1. **安装成功** — 空目录安装，验证 hooks.json 创建和内容正确
2. **重复安装幂等** — 第二次安装返回 `installed: false` 并提示已注册跳过
3. **卸载成功** — 安装后卸载，验证备份文件存在且 hooks.json 中的 commit.js 条目被完全移除
4. **hooks.json 不存在** — 卸载时文件不存在，返回 `uninstalled: false` 并提示优雅消息
