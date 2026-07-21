import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function installOpencodeHooks(opencodeDir) {
  const pluginsDir = join(opencodeDir, 'plugins');
  const targetPath = join(pluginsDir, 'agents-cfgit.ts');
  const template = readFileSync(join(TEMPLATE_DIR, 'plugin-opencode.ts'), 'utf-8');

  if (existsSync(targetPath)) {
    const existing = readFileSync(targetPath, 'utf-8');
    if (existing === template) {
      return { installed: false, message: 'agents-cfgit 插件已存在，跳过' };
    }
    // 模板内容已更新，备份旧文件并覆盖
    writeFileSync(targetPath + '.bak.agents-cfgit', existing, 'utf-8');
    writeFileSync(targetPath, template, 'utf-8');
    return { installed: true, message: 'agents-cfgit 插件已更新' };
  }

  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(targetPath, template, 'utf-8');
  return { installed: true, message: 'agents-cfgit 插件安装成功' };
}

export function uninstallOpencodeHooks(opencodeDir) {
  const targetPath = join(opencodeDir, 'plugins/agents-cfgit.ts');
  if (!existsSync(targetPath)) {
    return { uninstalled: false, message: 'agents-cfgit 插件不存在' };
  }
  writeFileSync(targetPath + '.bak.agents-cfgit', readFileSync(targetPath, 'utf-8'), 'utf-8');
  rmSync(targetPath);
  return { uninstalled: true, message: 'agents-cfgit 插件已移除' };
}
