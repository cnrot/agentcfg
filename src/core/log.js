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
