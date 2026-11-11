import { cp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Isolated synthetic configuration. Never changes the actual demo configuration.
const target = resolve('.qa-live');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const path of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
  await cp(resolve(path), resolve(target, path), { recursive: true });
}
await symlink(resolve('node_modules'), resolve(target, 'node_modules'), 'dir');
const file = resolve(target, 'src/data/factory.ts');
const source = (await readFile(file, 'utf8'))
  .replace('demo: true,', 'demo: false,')
  .replace("phone: '+7 (000) 000-00-00'", "phone: '+7 (863) 200-12-34'")
  .replace("email: 'sales@plitform.example'", "email: 'sales@plitform-qa.ru'")
  .replace("domain: 'https://plitform.example'", "domain: 'https://plitform-qa.ru'");
await writeFile(file, source);
const result = spawnSync(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build'], { cwd: target, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
