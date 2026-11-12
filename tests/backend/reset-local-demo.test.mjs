import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetLocalDemo } from '../../scripts/reset-local-demo.mjs';

const localStatus = JSON.stringify({
  API_URL: 'http://127.0.0.1:54321',
  DB_URL: 'postgresql://postgres:fixture-secret@127.0.0.1:54322/postgres',
  SECRET_KEY: 'sb_secret_fixture',
});

function runner(status = localStatus, failAt = -1) {
  const calls = [];
  const run = (file, args) => {
    calls.push({ file, args });
    return {
      status: calls.length === failAt ? 1 : 0,
      stdout: calls.length === 1 ? status : 'sb_secret_fixture',
      stderr: 'postgresql://postgres:fixture-secret@remote.example/postgres',
    };
  };
  return { calls, run };
}

test('default preview never invokes CLI or writes environment files', () => {
  const fake = runner();
  const output = [];
  resetLocalDemo([], { run: fake.run, log: (line) => output.push(line) });
  assert.deepEqual(fake.calls, []);
  assert.match(output.join('\n'), /미리보기/);
  assert.match(output.join('\n'), /--apply/);
});

test('remote, passthrough and repeated arguments fail before any command', () => {
  for (const args of [['--remote'], ['--db-url=postgresql://remote'], ['--apply', '--remote'], ['--apply', '--apply']]) {
    const fake = runner();
    assert.throws(() => resetLocalDemo(args, { run: fake.run, log: () => {} }), /허용하지 않습니다/);
    assert.deepEqual(fake.calls, []);
  }
});

test('apply refuses non-loopback, wrong-port and missing targets before reset', () => {
  for (const status of [
    { API_URL: 'https://example.supabase.co', DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres' },
    { API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres@remote.example:54322/postgres' },
    { API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres@127.0.0.1:54323/postgres' },
    {},
  ]) {
    const fake = runner(JSON.stringify(status));
    assert.throws(() => resetLocalDemo(['--apply'], { run: fake.run, log: () => {} }), /초기화를 거부/);
    assert.equal(fake.calls.length, 1);
  }
});

test('malformed status never exposes captured CLI output or credentials', () => {
  const fake = runner('sb_secret_fixture fixture-secret');
  const output = [];
  assert.throws(() => resetLocalDemo(['--apply'], { run: fake.run, log: (line) => output.push(line) }), /로컬 Supabase 상태/);
  assert.equal(fake.calls.length, 1);
  assert.doesNotMatch(output.join('\n'), /sb_secret|fixture-secret/);
});

test('apply uses a fixed local reset between environment checks and setup', () => {
  const fake = runner();
  const output = [];
  resetLocalDemo(['--apply'], { run: fake.run, log: (line) => output.push(line) });
  assert.equal(fake.calls.length, 5);
  assert.deepEqual(fake.calls[0].args, ['status', '--output', 'json']);
  assert.match(fake.calls[1].args[0], /prepare-local-env\.mjs$/);
  assert.equal(fake.calls[1].args[1], '--backend-only');
  assert.deepEqual(fake.calls[2].args, ['db', 'reset']);
  assert.match(fake.calls[3].args[0], /prepare-local-env\.mjs$/);
  assert.equal(fake.calls[3].args[1], '--backend-only');
  assert.equal(fake.calls[4].args[0], '--env-file=.env.backend.local');
  assert.match(fake.calls[4].args[1], /setup-demo-accounts\.mjs$/);
  assert.doesNotMatch(output.join('\n'), /sb_secret|fixture-secret/);
});

test('every failed stage aborts before subsequent writes without exposing subprocess output', () => {
  for (let stage = 1; stage <= 5; stage += 1) {
    const fake = runner(localStatus, stage);
    const output = [];
    assert.throws(() => resetLocalDemo(['--apply'], { run: fake.run, log: (line) => output.push(line) }), (error) => {
      assert.match(error.message, /실행에 실패/);
      assert.doesNotMatch(error.message, /sb_secret|fixture-secret|remote\.example/);
      return true;
    });
    assert.equal(fake.calls.length, stage);
    assert.doesNotMatch(output.join('\n'), /sb_secret|fixture-secret/);
  }
});

test('backend-only environment preparation preserves hosted browser settings, including when .env.local is absent', () => {
  for (const browserOverride of [null, 'NEXT_PUBLIC_SUPABASE_URL="https://shared.example.supabase.co"\n']) {
    const isolatedRoot = mkdtempSync(path.join(os.tmpdir(), 'birdiebuddy-env-test-'));
    try {
      mkdirSync(path.join(isolatedRoot, 'scripts'));
      mkdirSync(path.join(isolatedRoot, 'node_modules', '.bin'), { recursive: true });
      copyFileSync(new URL('../../scripts/prepare-local-env.mjs', import.meta.url), path.join(isolatedRoot, 'scripts', 'prepare-local-env.mjs'));
      writeFileSync(path.join(isolatedRoot, 'status.json'), JSON.stringify({
        API_URL: 'http://127.0.0.1:54321',
        DB_URL: 'postgresql://postgres:fixture-secret@127.0.0.1:54322/postgres',
        PUBLISHABLE_KEY: 'sb_publishable_fixture',
        SECRET_KEY: 'sb_secret_fixture',
      }));
      // The isolated helper can only reach this stub, never the installed CLI or real stack.
      writeFileSync(path.join(isolatedRoot, 'node_modules', '.bin', 'supabase'), '#!/bin/sh\nif [ "$1" = "status" ]; then cat status.json; fi\n', { mode: 0o700 });
      const hostedEnv = 'NEXT_PUBLIC_SUPABASE_URL="https://shared.example.supabase.co"\n';
      writeFileSync(path.join(isolatedRoot, '.env'), hostedEnv);
      const browserFile = path.join(isolatedRoot, '.env.local');
      if (browserOverride !== null) writeFileSync(browserFile, browserOverride);
      const runtimeArgs = process.versions.deno ? ['run', '--allow-all'] : [];
      const result = spawnSync(process.execPath, [...runtimeArgs, path.join(isolatedRoot, 'scripts', 'prepare-local-env.mjs'), '--backend-only'], { encoding: 'utf8' });
      assert.equal(result.status, 0, 'isolated backend-only preparation succeeds');
      assert.equal(readFileSync(path.join(isolatedRoot, '.env'), 'utf8'), hostedEnv);
      assert.equal(existsSync(browserFile), browserOverride !== null);
      if (browserOverride !== null) assert.equal(readFileSync(browserFile, 'utf8'), browserOverride);
      assert.match(readFileSync(path.join(isolatedRoot, '.env.backend.local'), 'utf8'), /BB_LOCAL_SUPABASE_URL/);
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sb_secret_fixture|fixture-secret/);
    } finally {
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  }
});
