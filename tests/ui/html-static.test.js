/**
 * src/ui/index.html — 静态分析
 * 检测 <script> 体内重复的 let/const 声明
 * (重复声明会 SyntaxError,UI 整个脚本拒绝执行)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, '..', '..', 'src', 'ui', 'index.html');

let passed = 0;
let failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

const html = readFileSync(htmlPath, 'utf-8');

// 提取 <script> 块内容(简单 regex,够用)
const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
const scriptBody = scriptMatches.map(m => m[1]).join('\n;\n');

// 抓所有顶层 let/const 声明
const decls = new Map();   // name → count
const declRegex = /^(?:let|const)\s+([A-Za-z_$][\w$]*)/gm;
let m;
while ((m = declRegex.exec(scriptBody)) !== null) {
  const name = m[1];
  decls.set(name, (decls.get(name) || 0) + 1);
}

console.log('测试: index.html 顶层 let/const 声明去重');

const dupes = [...decls.entries()].filter(([, c]) => c > 1);
if (dupes.length === 0) {
  check('无重复声明', true);
} else {
  check('无重复声明', false);
  for (const [name, count] of dupes) {
    console.log(`    重复 ${count} 次: ${name}`);
  }
}

// 抽几个已知会引用的关键名字,确保没被误删
const expect = ['dailyActivity', 'fileRanking', 'allCommits', 'diffsCache'];
for (const name of expect) {
  check(`保留声明 ${name}`, decls.has(name));
}

// 死代码检查:这些 mock 名字在集成后不应再存在
const dead = ['messages', 'diffTemplates', 'rhash', 'getDiffForFile', 'genFallbackDiff', 'filesByCommit'];
for (const name of dead) {
  // 不能作为顶层 let/const 声明存在(可能以 identifier 出现但不应声明)
  const re = new RegExp(`^(?:let|const)\\s+${name}\\b`, 'gm');
  check(`删除死代码声明 ${name}`, !re.test(scriptBody));
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
