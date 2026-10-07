import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const files = readdirSync('tests').filter(name => name.endsWith('.test.js')).map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit', env: { ...process.env, TEST_ALL_LEVELS: '1' },
});
process.exit(result.status ?? 1);
