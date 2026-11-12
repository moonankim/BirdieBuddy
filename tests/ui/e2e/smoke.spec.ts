import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, account: string) {
  if (!page.url().endsWith('/login')) await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`\\(${account}\\)$`) }).click();
}

async function switchAccount(page: Page, account: string) {
  await page.getByRole('button', { name: '계정 전환', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: new RegExp(`\\(${account}\\)$`) }).click();
}

async function enterFirstRoom(page: Page) {
  const room = page.locator('article').filter({ hasText: '인플루언서 1 인증됨' });
  const link = room.getByRole('link');
  const requiresAdmission = (await link.innerText()).includes('입장하기');
  await link.click();
  await expect(page).toHaveURL(/\/chat\/room-1$/);
  if (requiresAdmission) await page.getByRole('button', { name: '입장하기', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toBeVisible();
}

async function submit(page: Page, body: string) {
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill(body);
  await page.getByRole('button', { name: '보내기', exact: true }).click();
}

for (const [account, route, heading] of [
  ['userA', '/chat', '채팅방'], ['userB', '/chat', '채팅방'],
  ['influencer', '/inbox', '인박스'], ['pendingInfluencer', '/inbox', null],
  ['admin', '/admin', '관리자'],
] as const) {
  test(`mock account ${account} uses its role home and clears session on switch`, async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/login$/);
    await login(page, account);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    if (heading) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    else {
      await expect(page.getByText('이 화면을 사용할 권한이 없어요.', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: '인증 신청', exact: true })).toBeVisible();
    }
    await page.reload();
    if (heading) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '계정 전환', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '더미 계정으로 시작' })).toBeVisible();
    await expect(page.getByRole('button', { name: '계정 전환', exact: true })).toHaveCount(0);
  });
}

test('fan admission, pass, both suggestion forms, block and persistent failure', async ({ page }) => {
  await login(page, 'userA');
  await expect(page.locator('article').filter({ hasText: '인플루언서 1 인증됨' })).toContainText('입장할 수 있어요');
  await enterFirstRoom(page);
  await expect(page.getByText('인사말', { exact: false }).first()).toBeVisible();
  await submit(page, 'E2E 기본 질문');
  await expect(page.getByText('E2E 기본 질문', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('');
  await submit(page, '[suggest] E2E 수정 문장');
  await expect(page.getByRole('button', { name: '이대로 보내기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이대로 보내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이대로 보내기', exact: true })).toHaveCount(0);
  await expect(page.getByText('E2E 수정 문장', { exact: true })).toBeVisible();
  await submit(page, '[suggest-null] E2E 안내만');
  await expect(page.getByRole('status')).toContainText('표현을 바꿔 보세요.');
  await expect(page.getByRole('button', { name: '이대로 보내기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('[suggest-null] E2E 안내만');
  await submit(page, '[block] E2E 차단');
  await expect(page.getByRole('status')).toContainText('메시지를 보낼 수 없어요.');
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('[block] E2E 차단');
  await submit(page, '[fail] E2E 반복 실패');
  const failure = page.getByRole('main').getByRole('alert');
  await expect(failure).toContainText('지금은 메시지를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(failure).toContainText('지금은 메시지를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.');
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('[fail] E2E 반복 실패');
});

test('fan question reaches inbox, owner replies, broadcasts and deletes, fan sees results after switching', async ({ page }) => {
  await login(page, 'userA');
  await enterFirstRoom(page);
  await submit(page, 'E2E 인박스 질문');
  await expect(page.getByText('E2E 인박스 질문', { exact: true })).toBeVisible();
  await switchAccount(page, 'influencer');
  const question = page.locator('article').filter({ hasText: 'E2E 인박스 질문' });
  await question.getByRole('button', { name: '답변하기', exact: true }).click();
  await question.getByRole('textbox', { name: '답변', exact: true }).fill('E2E 답변');
  await question.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect(page.getByText('E2E 답변', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '답변 완료 포함' }).check();
  await expect(question).toContainText('답변 완료');
  await page.getByRole('textbox', { name: '전체 메시지', exact: true }).fill('E2E 삭제할 방송');
  await page.getByRole('button', { name: '전체 메시지 보내기', exact: true }).click();
  const broadcast = page.locator('article').filter({ hasText: 'E2E 삭제할 방송' });
  await expect(broadcast).toBeVisible();
  const deletedBefore = await page.getByText('삭제된 메시지', { exact: true }).count();
  await broadcast.getByRole('button', { name: '삭제', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '메시지 삭제' });
  await expect(confirmation).toContainText('삭제하면 되돌릴 수 없어요.');
  await confirmation.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByText('삭제된 메시지', { exact: true })).toHaveCount(deletedBefore + 1);
  await switchAccount(page, 'userA');
  await enterFirstRoom(page);
  await expect(page.getByText('E2E 답변', { exact: true })).toBeVisible();
  await expect(page.getByText('E2E 삭제할 방송', { exact: true })).toHaveCount(0);
  await expect(page.getByText('삭제된 메시지', { exact: true }).first()).toBeVisible();
});

test('pending verification restricts access, approval admits the same account and creates a preparing room', async ({ page }) => {
  await login(page, 'pendingInfluencer');
  await page.getByRole('link', { name: '인증 신청', exact: true }).click();
  await expect(page.getByRole('heading', { name: '인증 신청', exact: true })).toBeVisible();
  await expect(page.getByText(/유튜버.*심사 대기/)).toBeVisible();
  await page.getByRole('textbox', { name: '증빙 URL' }).fill('http://example.com');
  await expect(page.getByRole('button', { name: '신청', exact: true })).toBeDisabled();
  await switchAccount(page, 'admin');
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await expect(page.getByText('심사 대기 신청이 없어요.', { exact: true })).toBeVisible();
  await switchAccount(page, 'pendingInfluencer');
  await expect(page.getByRole('heading', { name: '인박스', exact: true })).toBeVisible();
  await switchAccount(page, 'userB');
  const preparing = page.locator('article').filter({ hasText: '신청자' });
  await expect(preparing).toContainText('카드 준비 중');
  await expect(preparing.getByRole('link')).toHaveCount(0);
});

test('owner edits a greeting within the limit and restores the default with empty input', async ({ page }) => {
  await login(page, 'influencer');
  await page.getByRole('link', { name: '설정', exact: true }).click();
  const greeting = page.getByRole('textbox', { name: '인사말', exact: true });
  const save = page.getByRole('button', { name: '저장', exact: true });
  await greeting.fill('가'.repeat(201));
  await expect(save).toBeDisabled();
  await greeting.fill('E2E 새 인사말');
  await save.click();
  await page.getByRole('link', { name: 'BirdieBuddy', exact: true }).click();
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(greeting).toHaveValue('E2E 새 인사말');
  await greeting.fill('');
  await save.click();
  await expect(page.getByText(/^기본 문구:/)).toBeVisible();
});

test('photo selection rejects MIME and size violations and accepts a valid PNG upload', async ({ page }) => {
  await login(page, 'influencer');
  await page.getByRole('link', { name: '설정', exact: true }).click();
  const photo = page.getByLabel('사진 선택');
  const save = page.getByRole('button', { name: '사진 저장', exact: true });
  const error = page.getByText('JPG·PNG·WebP 형식의 5MB 이하 사진만 올릴 수 있어요', { exact: true });
  await photo.setInputFiles({ name: 'bad.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(error).toBeVisible(); await expect(save).toBeDisabled();
  await photo.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5_242_881) });
  await expect(error).toBeVisible(); await expect(save).toBeDisabled();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
  await photo.setInputFiles({ name: 'boundary.png', mimeType: 'image/png', buffer: Buffer.concat([png, Buffer.alloc(5_242_880 - png.length)]) });
  await expect(error).toHaveCount(0); await expect(save).toBeEnabled();
  await photo.setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: '프로필 사진 미리보기' })).toBeVisible();
  await save.click();
  await expect(save).toBeDisabled();
  await expect(page.getByRole('img', { name: '프로필 사진 미리보기' })).toHaveAttribute('src', /^blob:/);
});
