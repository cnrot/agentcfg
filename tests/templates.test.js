/**
 * templates/ 静态资源测试
 * 验证模板内容符合预期
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', 'templates');

// Test 1: OpenCode 插件模板 - 不应再按 .opencode 路径过滤
console.log('\nTest: plugin-opencode.ts should not filter by .opencode path');
const pluginSrc = readFileSync(join(TEMPLATE_DIR, 'plugin-opencode.ts'), 'utf-8');
assert(!pluginSrc.includes('filePath.includes'),
  '模板不应包含 filePath.includes 路径过滤');
assert(pluginSrc.includes('shellQuote'),
  '模板应仍保留 shellQuote 防注入');
assert(pluginSrc.includes('ctx.$'),
  '模板应仍使用 ctx.$ 调用 commit');

// Test 2: 验证 file.edited 事件 handler 仍存在
console.log('\nTest: plugin-opencode.ts should still handle file.edited event');
assert(pluginSrc.includes('"file.edited"'),
  '模板应包含 "file.edited" handler');
assert(pluginSrc.includes('"tool.execute.before"'),
  '模板应包含 "tool.execute.before" handler');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
