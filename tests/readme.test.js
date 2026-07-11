/**
 * README.md — 文档完整性静态检查
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(join(__dirname, '..', 'README.md'), 'utf-8');

let passed = 0;
let failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

console.log('测试: README 文档完整性');

// 仪表板章节(line 216 附近)应包含组件描述
const dashboardSection = readme.match(/打开 `http:\/\/127\.0\.0\.1:3000`[\s\S]{0,200}/);
check('包含 "打开 http://127.0.0.1:3000"', !!dashboardSection);
if (dashboardSection) {
  const block = dashboardSection[0];
  check('描述 4 张统计卡片', block.includes('4 张统计卡片') || block.includes('总备份') || block.includes('stat-card'));
  check('描述走势图', block.includes('走势') || block.includes('Canvas') || block.includes('chart'));
  check('描述排行', block.includes('排行') || block.includes('TOP 10') || block.includes('ranking'));
  check('描述时间线', block.includes('时间线') || block.includes('Timeline'));
}

// badge 数字
const badgeMatch = readme.match(/tests-(\d+)/);
if (badgeMatch) {
  const n = parseInt(badgeMatch[1], 10);
  // 本项目测试 14 个 .test.js 文件,每个文件 ≥ 1 case,合理估计 250-400
  check(`badge 数字合理 (${n} >= 100)`, n >= 100);
} else {
  check('badge 含 tests-N passing', false);
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
