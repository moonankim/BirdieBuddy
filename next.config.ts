import type { NextConfig } from 'next';

// 루트 lib/api·lib/supabase는 Node(NodeNext) 규칙대로 './types.js'처럼 .js 확장자로 TypeScript 파일을 import한다.
// webpack 빌드에서도 이를 .ts로 찾도록 맞춘다. dev·build 스크립트는 검증한 webpack 경로(--webpack)를 쓴다.
const config: NextConfig = {
  turbopack: {},
  webpack(webpackConfig) {
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.extensionAlias = { ...webpackConfig.resolve.extensionAlias, '.js': ['.ts', '.tsx', '.js'] };
    return webpackConfig;
  },
};
export default config;
