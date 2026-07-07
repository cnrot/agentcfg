# Task 6: Core diff.js - 三段式比对报告

## 状态: DONE

## 创建的文件
- `src/core/diff.js` - 实现 `generateDiffReport` 函数，生成格式化的三段式比对报告
- `src/core/diff.test.js` - 覆盖 4 个测试场景的测试文件

## 测试结果
- **18 通过, 0 失败**
  - 有差异时报告包含新增和移除行: 4/4 通过
  - 文件当前不存在时正常生成报告: 4/4 通过
  - 历史版本不存在时正常生成报告: 3/3 通过
  - 报告格式包含 commit 信息和文件路径: 7/7 通过

## Commit
`c574b38` - feat: implement three-section diff report generator
