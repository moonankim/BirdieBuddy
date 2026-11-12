import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');

function localUrl(value, protocol, port) {
  try {
    const url = new URL(value);
    return protocol.includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && url.port === port;
  } catch {
    return false;
  }
}

function statusEntries(value, entries = []) {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      entries.push([key.toLowerCase().replace(/[^a-z0-9]/g, ''), child]);
      statusEntries(child, entries);
    }
  }
  return entries;
}

function assertLocalStatus(output) {
  let status;
  try {
    status = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));
  } catch {
    throw new Error('로컬 Supabase 상태를 확인하지 못했습니다. npm run local:start부터 실행하세요.');
  }
  const entries = statusEntries(status);
  const api = entries.find(([key]) => ['apiurl', 'supabaseurl'].includes(key))?.[1];
  const db = entries.find(([key]) => ['dburl', 'databaseurl'].includes(key))?.[1];
  if (!localUrl(api, ['http:', 'https:'], '54321') || !localUrl(db, ['postgres:', 'postgresql:'], '54322')) {
    throw new Error('로컬 loopback API(54321)·DB(54322)를 확인하지 못해 초기화를 거부했습니다.');
  }
}

export function resetLocalDemo(args, { run = spawnSync, log = console.log } = {}) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    throw new Error('사용법: npm run demo:reset [-- --apply]. 다른 옵션이나 원격 대상은 허용하지 않습니다.');
  }
  log('로컬 데모 DB·Auth 데이터를 전체 초기화한 뒤 migration·seed·데모 계정을 다시 준비합니다.');
  log('공유 hosted DB는 초기화하지 않습니다. 브라우저 환경파일은 변경하지 않습니다.');
  log('순서: 로컬 상태 확인 → local:env → db reset → local:env → demo:setup');
  if (args.length === 0) {
    log('미리보기만 실행했습니다. 로컬 데이터를 지우려면 npm run demo:reset -- --apply를 실행하세요.');
    return;
  }

  function command(label, file, commandArgs) {
    let result;
    try {
      result = run(file, commandArgs, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    } catch {
      throw new Error(`${label} 실행에 실패해 중단했습니다. 연결값과 비밀값은 출력하지 않습니다.`);
    }
    if (result.error || result.status !== 0) {
      throw new Error(`${label} 실행에 실패해 중단했습니다. npm run local:start와 로컬 환경을 확인하세요.`);
    }
    return result.stdout ?? '';
  }

  assertLocalStatus(command('로컬 상태 확인', cli, ['status', '--output', 'json']));
  command('초기화 전 local:env', process.execPath, [path.join(root, 'scripts', 'prepare-local-env.mjs'), '--backend-only']);
  // CLI 3.0.0 targets the local stack unless --remote is supplied. User arguments are never forwarded.
  command('로컬 DB 초기화', cli, ['db', 'reset']);
  command('초기화 후 local:env', process.execPath, [path.join(root, 'scripts', 'prepare-local-env.mjs'), '--backend-only']);
  command('로컬 데모 준비', process.execPath, ['--env-file=.env.backend.local', path.join(root, 'scripts', 'setup-demo-accounts.mjs')]);
  log('로컬 데모 초기화가 완료됐습니다. 브라우저 연결 대상을 확인하고 로그아웃 후 다시 로그인하세요.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    resetLocalDemo(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : '로컬 데모 초기화에 실패했습니다.');
    process.exitCode = 1;
  }
}
