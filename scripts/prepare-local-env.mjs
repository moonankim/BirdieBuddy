import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
const isStarting = process.argv.includes('--start');

function sanitize(value) {
  return value
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[REDACTED_KEY]')
    .replace(/eyJ[A-Za-z0-9._-]{24,}/g, '[REDACTED_TOKEN]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s/]+@/gi, '$1[REDACTED]@')
    .replace(/((?:secret|service.?role|anon|publishable|database.?url|db.?url)[^\n:=]*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]');
}

function runCli(args) {
  const result = spawnSync(cli, args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw new Error(`Supabase CLI를 실행하지 못했습니다: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = sanitize(`${result.stderr ?? ''}\n${result.stdout ?? ''}`).trim().split('\n').slice(-12).join('\n');
    throw new Error(`Supabase CLI가 종료 코드 ${result.status ?? 'unknown'}을 반환했습니다. ${detail}`);
  }
  return result.stdout ?? '';
}

function parseJsonOutput(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('로컬 Supabase 상태 JSON을 찾지 못했습니다.');
  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    throw new Error('로컬 Supabase 상태 JSON을 읽지 못했습니다.');
  }
}

function flatten(value, output = []) {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      output.push([key.toLowerCase().replace(/[^a-z0-9]/g, ''), child]);
      flatten(child, output);
    }
  }
  return output;
}

function pick(entries, names) {
  for (const name of names) {
    const match = entries.find(([key, value]) => key === name && typeof value === 'string' && value.length > 0);
    if (match) return match[1];
  }
  return null;
}

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) values.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'));
  }
  return values;
}

async function readOptional(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

function upsertEnv(original, entries) {
  const lines = original ? original.split(/\r?\n/) : [];
  const keys = new Set(entries.map(([key]) => key));
  const seen = new Set();
  const output = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !keys.has(match[1])) return line;
    const entry = entries.find(([key]) => key === match[1]);
    if (!entry || seen.has(entry[0])) return '';
    seen.add(entry[0]);
    return `${entry[0]}=${JSON.stringify(entry[1])}`;
  });
  for (const [key, value] of entries) {
    if (!seen.has(key)) output.push(`${key}=${JSON.stringify(value)}`);
  }
  return `${output.filter((line, index) => line || index < output.length - 1).join('\n').trimEnd()}\n`;
}

function assertLoopback(name, value, expectedPort) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} 형식이 잘못되었습니다.`);
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || parsed.port !== expectedPort) {
    throw new Error(`${name}은 로컬 loopback의 ${expectedPort} 포트여야 합니다. 원격 URL은 거부했습니다.`);
  }
}

function assertKey(name, value, prefix) {
  if (!value.startsWith(prefix)) throw new Error(`${name}이 현대 Supabase ${prefix} 형식이 아닙니다. legacy key fallback은 허용하지 않습니다.`);
}

function assertPrivateValuesUnchanged(file, values, existing) {
  const current = parseEnv(existing);
  for (const key of ['BB_LOCAL_SECRET_KEY', 'BB_LOCAL_DATABASE_URL']) {
    if (current.has(key) && current.get(key) !== values[key]) {
      throw new Error(`${file}의 기존 ${key} 값은 덮어쓰지 않았습니다. 로컬 stack을 확인하고 파일을 직접 검토한 뒤 다시 실행하세요.`);
    }
  }
}

async function main() {
  if (isStarting) {
    runCli(['start']);
    console.log('로컬 Supabase stack이 준비되었습니다.');
  }

  const status = parseJsonOutput(runCli(['status', '--output', 'json']));
  const entries = flatten(status);
  const apiUrl = pick(entries, ['apiurl', 'supabaseurl']);
  const publishableKey = pick(entries, ['publishablekey', 'publishableapikey']);
  const secretKey = pick(entries, ['secretkey', 'secretapikey']);
  const databaseUrl = pick(entries, ['dburl', 'databaseurl']);

  if (!apiUrl || !publishableKey || !secretKey || !databaseUrl) {
    const keys = [...new Set(entries.map(([key]) => key))].sort().join(', ');
    throw new Error(`필수 로컬 연결값이 없습니다. 확인된 필드명: ${keys || '(none)'}`);
  }
  assertLoopback('로컬 API URL', apiUrl, '54321');
  assertLoopback('로컬 DB URL', databaseUrl, '54322');
  assertKey('publishable key', publishableKey, 'sb_publishable_');
  assertKey('secret key', secretKey, 'sb_secret_');

  const rootEnvPath = path.join(root, '.env.local');
  const backendEnvPath = path.join(root, '.env.backend.local');
  const functionsEnvPath = path.join(root, 'supabase', 'functions', '.env');
  const [rootEnv, backendEnv, functionsEnv] = await Promise.all([
    readOptional(rootEnvPath), readOptional(backendEnvPath), readOptional(functionsEnvPath),
  ]);

  const rootCurrent = parseEnv(rootEnv);
  const oldBrowserUrl = rootCurrent.get('NEXT_PUBLIC_SUPABASE_URL');
  const preserveRootEnv = Boolean(oldBrowserUrl && !['localhost', '127.0.0.1', '::1'].includes(new URL(oldBrowserUrl).hostname));

  const backendValues = {
    BB_LOCAL_SUPABASE_URL: apiUrl,
    BB_LOCAL_PUBLISHABLE_KEY: publishableKey,
    BB_LOCAL_SECRET_KEY: secretKey,
    BB_LOCAL_DATABASE_URL: databaseUrl,
  };
  assertPrivateValuesUnchanged(backendEnvPath, backendValues, backendEnv);
  assertPrivateValuesUnchanged(functionsEnvPath, backendValues, functionsEnv);

  const rootContents = preserveRootEnv ? rootEnv : upsertEnv(rootEnv, [
    ['NEXT_PUBLIC_SUPABASE_URL', apiUrl],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishableKey],
  ]);
  const backendContents = upsertEnv(backendEnv, Object.entries(backendValues));
  const functionsContents = upsertEnv(functionsEnv, [
    ['BB_LOCAL_PUBLISHABLE_KEY', publishableKey],
    ['BB_LOCAL_SECRET_KEY', secretKey],
    ['ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'],
    ['BB_USE_LOCAL_AI_FIXTURE', 'true'],
  ]);
  const functionsEnvChanged = functionsContents !== functionsEnv;

  await mkdir(path.dirname(functionsEnvPath), { recursive: true });
  const writes = [
    writeFile(backendEnvPath, backendContents, { mode: 0o600 }),
    writeFile(functionsEnvPath, functionsContents, { mode: 0o600 }),
  ];
  if (!preserveRootEnv) writes.push(writeFile(rootEnvPath, rootContents, { mode: 0o600 }));
  await Promise.all(writes);
  const permissions = [chmod(backendEnvPath, 0o600), chmod(functionsEnvPath, 0o600)];
  if (!preserveRootEnv) permissions.push(chmod(rootEnvPath, 0o600));
  await Promise.all(permissions);
  console.log(preserveRootEnv
    ? '로컬 backend 연결값을 .env.backend.local과 supabase/functions/.env에 기록했습니다. 값은 출력하지 않았습니다.'
    : '로컬 연결값을 .env.local, .env.backend.local, supabase/functions/.env에 기록했습니다. 값은 출력하지 않았습니다.');
  if (preserveRootEnv) console.warn('기존 .env.local이 원격 URL을 가리켜 보존했습니다. backend/local Edge 검증은 local 전용 env 파일을 사용합니다.');
  if (functionsEnvChanged) {
    runCli(['stop']);
    runCli(['start']);
    console.log('Edge Function 환경값이 바뀌어 로컬 Supabase stack을 재시작했습니다.');
  }
}

main().catch((error) => {
  console.error(sanitize(error instanceof Error ? error.message : '로컬 env 준비에 실패했습니다.'));
  process.exitCode = 1;
});
