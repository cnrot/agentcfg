# Task 5: Core log.js —— git log 输出格式化

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `C:\Users\admin\config-mgr\src\core\log.js`
- Create: `C:\Users\admin\config-mgr\src\core\log.test.js`

## 接口
- `getLog({ cwd, filePath, since, count })` → `Array<{ hash: string, date: string, message: string }>`

## 完整代码

```javascript
import { execFileSync } from 'child_process';

export function getLog({ cwd, filePath, since, count = 10 }) {
  const args = ['log', `--max-count=${count}`, '--format=%H|%ci|%s'];
  if (since) args.push(`--since="${since}"`);
  if (filePath) args.push('--', filePath);

  try {
    const output = execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').map(line => {
      const [hash, date, ...msgParts] = line.split('|');
      return { hash: hash.slice(0, 8), date: date.replace(/ [+-]\d{4}$/, ''), message: msgParts.join('|') };
    });
  } catch (err) {
    return [];
  }
}
```

## 步骤
1. 创建 src/core/log.js
2. 创建测试（初始化仓库 → 创建多次 commit → 验证 log 返回格式、count、filePath 过滤）
3. 运行测试
4. 提交

## 报告
C:\Users\admin\config-mgr\.superpowers\sdd\task-5-report.md
