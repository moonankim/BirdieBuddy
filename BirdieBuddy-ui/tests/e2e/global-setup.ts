import type { FullConfig } from '@playwright/test';

// Preflight routes on either the managed dev server or an external snapshot server.
export default async function prepareRoutes(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('E2E baseURL is required');
  for (const path of ['/login', '/chat', '/chat/room-1', '/inbox', '/inbox/settings', '/inbox/verification', '/admin', '/']) {
    const response = await fetch(new URL(path, baseURL), { signal: AbortSignal.timeout(60_000) });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`E2E preflight ${path}: HTTP ${response.status}`);
  }
}
