import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureVersion = 'birdiebuddy-demo-v1';
const firstInfluencerId = '20000000-0000-4000-8000-000000000001';
const pendingInfluencerId = '20000000-0000-4000-8000-000000000011';
const lineUpPath = path.join(root, 'supabase', 'fixtures', 'influencers.json');
const issueCardFixturePath = path.join(root, 'supabase', 'fixtures', 'local_issue_card.sql');
const issueCardFixtureMarker = 'LOCAL MOCK FIXTURE: deterministic sample award for isolated local development only. Replace with MoonhwanP A-09.';
const passwordFilePath = path.join(root, '.demo-passwords.json');

const accounts = [
  { key: 'userA', email: 'user-a@example.test', nickname: '사용자 A', role: 'user' },
  { key: 'userB', email: 'user-b@example.test', nickname: '사용자 B', role: 'user' },
  { key: 'influencer', email: 'influencer@example.test', nickname: '인플루언서 1', role: 'influencer', influencerId: firstInfluencerId },
  { key: 'pendingInfluencer', email: 'pending-influencer@example.test', nickname: '심사 대기 인플루언서', role: 'influencer', influencerId: pendingInfluencerId },
  { key: 'admin', email: 'admin@example.test', nickname: '로컬 관리자', role: 'admin' },
  { key: 'influencerB', email: 'influencer-b@example.test', nickname: '인플루언서 2', role: 'influencer', influencerId: '20000000-0000-4000-8000-000000000002' },
  { key: 'outsider', email: 'outsider@example.test', nickname: '권한 검증 사용자', role: 'user' },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`필수 로컬 환경변수 ${name}이 없습니다. npm run local:env를 실행하세요.`);
  return value;
}

function assertLocalTarget(urlValue, expectedPort, label) {
  let url;
  try { url = new URL(urlValue); } catch { throw new Error(`${label} 형식이 잘못되었습니다.`); }
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.port !== expectedPort) {
    throw new Error(`${label}은 loopback의 ${expectedPort} 포트여야 합니다. 원격 쓰기를 거부했습니다.`);
  }
}

async function readPasswordFile() {
  try {
    return JSON.parse(await readFile(passwordFilePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { accounts: {} };
    throw new Error('.demo-passwords.json을 읽을 수 없습니다. 로컬 비밀 파일을 직접 확인하세요.');
  }
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function ensureAuthAccounts(adminClient, oldCredentials) {
  const { data: page, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error('로컬 Auth 계정을 조회하지 못했습니다.');
  const existingByEmail = new Map(page.users.map((user) => [user.email, user]));
  const nextCredentials = { accounts: {} };

  for (const account of accounts) {
    let user = existingByEmail.get(account.email);
    const previous = oldCredentials.accounts?.[account.key];
    let password = typeof previous?.password === 'string' ? previous.password : null;
    if (!user) {
      password ??= randomBytes(32).toString('base64url');
      const { data, error } = await adminClient.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { nickname: account.nickname },
      });
      if (error || !data.user) throw new Error(`로컬 Auth 계정 ${account.key}을 만들지 못했습니다.`);
      user = data.user;
    } else if (!password) {
      password = randomBytes(32).toString('base64url');
      const { error } = await adminClient.auth.admin.updateUserById(user.id, { password });
      if (error) throw new Error(`기존 로컬 Auth 계정 ${account.key}의 암호를 준비하지 못했습니다.`);
    }
    nextCredentials.accounts[account.key] = { id: user.id, email: account.email, password };
  }

  await writeFile(passwordFilePath, `${JSON.stringify(nextCredentials, null, 2)}\n`, { mode: 0o600 });
  await chmod(passwordFilePath, 0o600);
  return nextCredentials.accounts;
}

async function configureDomainAccounts(db, accountData, enableForceGrade) {
  await db.query('begin');
  try {
    const setupResult = await db.query('select 1 from private.demo_fixture_runs where fixture_version = $1', [fixtureVersion]);
    const firstTemplate = await db.query(
      `select t.id from public.card_templates t
       where t.influencer_id = $1 and t.style = 'illust'::public.card_style`,
      [firstInfluencerId],
    );
    ensure(firstTemplate.rowCount === 1, '첫 인물 illust 카드 템플릿이 없습니다. supabase db reset부터 실행하세요.');
    const initialTemplateId = firstTemplate.rows[0].id;

    for (const account of accounts) {
      const user = accountData[account.key];
      await db.query('update public.profiles set nickname = $2, role = $3::public.user_role, updated_at = clock_timestamp() where id = $1',
        [user.id, account.nickname, account.role]);
      const profile = await db.query('select 1 from public.profiles where id = $1', [user.id]);
      ensure(profile.rowCount === 1, `Auth 계정 ${account.key}에 profiles 행이 없습니다.`);
      if (account.influencerId) {
        await db.query(
          `insert into private.influencer_accounts (influencer_id, user_id) values ($1, $2)
           on conflict (influencer_id) do nothing`, [account.influencerId, user.id],
        );
        const mapping = await db.query('select user_id from private.influencer_accounts where influencer_id = $1', [account.influencerId]);
        ensure(mapping.rowCount === 1 && mapping.rows[0].user_id === user.id, `인플루언서 ${account.key} 계정 매핑이 이미 다른 사용자에 연결돼 있습니다.`);
      }
    }

    const capabilityAccounts = accounts.filter((account) => ['userA', 'userB', 'admin', 'influencer', 'pendingInfluencer', 'influencerB', 'outsider'].includes(account.key));
    for (const account of capabilityAccounts) {
      const user = accountData[account.key];
      const canAdvanceMonth = account.key === 'admin';
      const canForceGrade = enableForceGrade && ['userA', 'userB'].includes(account.key);
      await db.query(
        `insert into private.demo_accounts (user_id, can_force_grade, can_advance_month) values ($1, $2, $3)
         on conflict (user_id) do update set can_force_grade = excluded.can_force_grade,
           can_advance_month = excluded.can_advance_month`,
        [user.id, canForceGrade, canAdvanceMonth],
      );
    }
    await db.query(
      `insert into private.runtime_flags (key, value) values ('demo_force_grade', $1::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = clock_timestamp()`,
      [JSON.stringify({ enabled: enableForceGrade })],
    );

    if (setupResult.rowCount === 0) {
      const protectedRows = await db.query(
        `select
           (select count(*) from public.user_cards where user_id = any($1::uuid[])) as card_rows,
           (select count(*) from public.rounds where user_id = any($1::uuid[])) as round_rows,
           (select count(*) from public.room_members where user_id = $2) as member_rows`,
        [[accountData.userA.id, accountData.userB.id], accountData.userB.id],
      );
      ensure(Number(protectedRows.rows[0].card_rows) === 0 && Number(protectedRows.rows[0].round_rows) === 0 && Number(protectedRows.rows[0].member_rows) === 0,
        'demo fixture marker가 없지만 사용자 카드·라운드·멤버십 데이터가 이미 있습니다. 이를 덮어쓰지 않았습니다. 로컬 DB reset 후 다시 실행하세요.');

      const clock = await db.query("select to_char(current_month, 'YYYY-MM-DD') as current_month, to_char((current_month - interval '1 month')::date, 'YYYY-MM-DD') as previous_month from private.demo_clock where id = 'hackathon' for update");
      ensure(clock.rowCount === 1, '로컬 demo clock이 없습니다. supabase db reset부터 실행하세요.');
      const periodMonth = String(clock.rows[0].previous_month);

      for (const [key, drawCount] of [['userA', 10], ['userB', 5]]) {
        const userId = accountData[key].id;
        const roundRows = await db.query(
          `insert into public.rounds (user_id, played_at, period_month, clock_kind)
           select $1, clock_timestamp(), $2::date, 'demo' from generate_series(1, $3)
           returning id`, [userId, periodMonth, drawCount],
        );
        for (let index = 0; index < roundRows.rows.length; index += 1) {
          await db.query(
            `insert into public.draws (user_id, round_id, template_id, grade, is_new, forced)
             values ($1, $2, $3, 'common', $4, false)`,
            [userId, roundRows.rows[index].id, initialTemplateId, index === 0],
          );
        }
        await db.query(
          `insert into public.user_cards (user_id, template_id, grade, count)
           values ($1, $2, 'common', $3)`, [userId, initialTemplateId, drawCount],
        );
      }

      const currentMonth = clock.rows[0].current_month;
      const joinedAt = new Date(Date.now() - 60_000).toISOString();
      const firstRoom = await db.query('select id from public.chat_rooms where influencer_id = $1', [firstInfluencerId]);
      ensure(firstRoom.rowCount === 1, '첫 인물 채팅방이 없습니다. supabase db reset부터 실행하세요.');
      await db.query(
        `insert into public.room_members (room_id, user_id, gauge, status, joined_at, joined_month, updated_at)
         values ($1, $2, 50, 'active', $3, $4::date, $3)`,
        [firstRoom.rows[0].id, accountData.userB.id, joinedAt, currentMonth],
      );
      await db.query(
        `insert into private.room_member_periods (room_id, user_id, joined_at) values ($1, $2, $3)`,
        [firstRoom.rows[0].id, accountData.userB.id, joinedAt],
      );
      await db.query('insert into private.demo_fixture_runs (fixture_version) values ($1)', [fixtureVersion]);
    }

    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

async function ensureLocalIssueCardFixture(db) {
  const existing = await db.query(
    `select to_regprocedure('private.issue_card(uuid,uuid,public.card_grade)')::oid as oid,
            case when to_regprocedure('private.issue_card(uuid,uuid,public.card_grade)') is null then null
                 else obj_description(to_regprocedure('private.issue_card(uuid,uuid,public.card_grade)')::oid,'pg_proc') end as marker`,
  );
  const { oid, marker } = existing.rows[0];
  if (oid !== null && marker !== issueCardFixtureMarker) {
    console.log('로컬 카드 발급 구현이 이미 있어 A-09 fixture를 건너뛰었습니다.');
    return;
  }
  await db.query(await readFile(issueCardFixturePath, 'utf8'));
  console.log('결정적 샘플 카드 발급 fixture를 로컬 DB에 준비했습니다. 확률 추첨 동작은 검증하지 않습니다.');
}

async function uploadCardPlaceholders(supabase, lineup) {
  for (const influencer of lineup.filter((entry) => !entry.pending)) {
    for (const style of ['illust', 'retro', 'holo']) {
      const objectPath = `${influencer.id}/${style}.webp`;
      const filePath = path.join(root, 'supabase', 'fixtures', 'card-assets', objectPath);
      const bytes = await readFile(filePath);
      const { error } = await supabase.storage.from('card-assets').upload(objectPath, bytes, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      });
      if (error && !['Duplicate', 'Asset Already Exists'].includes(error.message) && error.statusCode !== '409') {
        throw new Error(`로컬 카드 placeholder를 업로드하지 못했습니다 (${influencer.id}/${style}).`);
      }
    }
  }
}

async function main() {
  const url = requireEnv('BB_LOCAL_SUPABASE_URL');
  const publishableKey = requireEnv('BB_LOCAL_PUBLISHABLE_KEY');
  const secretKey = requireEnv('BB_LOCAL_SECRET_KEY');
  const databaseUrl = requireEnv('BB_LOCAL_DATABASE_URL');
  assertLocalTarget(url, '54321', 'Supabase URL');
  assertLocalTarget(databaseUrl, '54322', 'Postgres URL');
  ensure(publishableKey.startsWith('sb_publishable_') && secretKey.startsWith('sb_secret_'), 'legacy Supabase key는 로컬 setup에서 사용할 수 없습니다.');

  const adminClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client({ connectionString: databaseUrl, application_name: 'birdiebuddy-local-demo-setup' });
  const oldCredentials = await readPasswordFile();
  const lineup = JSON.parse(await readFile(lineUpPath, 'utf8'));
  const enableForceGrade = process.env.BB_ENABLE_DEMO_FORCE_GRADE === 'true';

  await db.connect();
  try {
    await ensureLocalIssueCardFixture(db);
    const credentials = await ensureAuthAccounts(adminClient, oldCredentials);
    await configureDomainAccounts(db, credentials, enableForceGrade);
    await uploadCardPlaceholders(adminClient, lineup);
    console.log('로컬 데모 Auth 계정 7개, 권한 매핑, userA/userB 카드·라운드, userB 첫 방 입장, 카드 placeholder 30개를 준비했습니다. 암호는 .demo-passwords.json에만 저장했습니다.');
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '로컬 데모 설정에 실패했습니다.');
  process.exitCode = 1;
});
