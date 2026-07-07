import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function installOpencodeHooks(opencodeDir) {
  const pluginsDir = join(opencodeDir, 'plugins');
  const targetPath = join(pluginsDir, 'config-mgr.ts');
  if (existsSync(targetPath)) {
    return { installed: false, message: 'OpenCode 插件已存在，跳过' };
  }
  mkdirSync(pluginsDir, { recursive: true });
  const template = readFileSync(join(TEMPLATE_DIR, 'plugin-opencode.ts'), 'utf-8');
  writeFileSync(targetPath, template, 'utf-8');
  return { installed: true, message: 'OpenCode 插件安装成功' };
}

export function uninstallOpencodeHooks(opencodeDir) {
  const targetPath = join(opencodeDir, 'plugins/config-mgr.ts');
  if (!existsSync(targetPath)) {
    return { uninstalled: false, message: 'OpenCode 插件不存在' };
  }
  writeFileSync(targetPath + '.bak', readFileSync(targetPath, 'utf-8'), 'utf-8');
  rmSync(targetPath);
  return { uninstalled: true, message: 'OpenCode 插件已移除' };
}
