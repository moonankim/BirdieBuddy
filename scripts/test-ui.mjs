import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// 실행기를 시작하기 전에 설정해야 변환 캐시도 프로젝트 안에 생성된다.
const taskTmp = fileURLToPath(new URL('../.tmp/', import.meta.url));
mkdirSync(taskTmp, {recursive: true});
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', ...process.argv.slice(2),
], {
  stdio: 'inherit',
  env: {...process.env, TMPDIR: taskTmp, TMP: taskTmp, TEMP: taskTmp},
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
