import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { execFileSync } from 'node:child_process';
const sha =
  process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'public-demo-entry',
      transformIndexHtml: {
        order: 'pre',
        handler: (html, context) =>
          html
            .replace('/src/main.tsx', '/src/public-demo/main.tsx')
            .replace(
              '<head>',
              `<head><meta name="public-demo" content="PUBLIC_DEMO">` +
                (context.server
                  ? ''
                  : `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'">`),
            )
            .replace(/<title>.*?<\/title>/, '<title>快康养互动演示</title>'),
      },
      // Compile-time copy adaptation; production source and build keep their original wording.
      transform(code, id) {
        if (
          id.includes('/src/') &&
          /\.(tsx?|css)$/.test(id) &&
          !id.includes('/public-demo/') &&
          !id.includes('/api/')
        )
          return code
            .replaceAll('服务器', '模拟服务')
            .replaceAll('人工确认', '模拟来源确认')
            .replaceAll('真实事件时间线', '模拟事件时间线')
            .replaceAll('按真实确认', '按模拟确认')
            .replaceAll('用实际联系与到访记录', '用模拟联系与到访记录')
            .replaceAll('实际确认人', '模拟确认人')
            .replaceAll('按实际填写', '按合成资料填写');
      },
      generateBundle() {
        const modules = [...this.getModuleIds()].map((id) => id.replaceAll('\\', '/'));
        if (modules.some((id) => /\/admin-web\/src\/(?:api\/client|experience)\.tsx?$/.test(id)))
          this.error('Public demo must not include the real transport or production experience');
        if (modules.some((id) => /\/miniprogram\/(?:data|datasets)\//.test(id)))
          this.error('Public demo must not include institution or personal datasets');
        this.emitFile({
          type: 'asset',
          fileName: 'build-info.json',
          source: JSON.stringify({
            mode: 'PUBLIC_DEMO',
            sha,
            task: 'ADMIN-PAGES-MOCK-DEMO-V1-20261031',
          }),
        });
        this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
      },
    },
  ],
  base: '/wuhan-eldercare-match/',
  resolve: {
    alias: [
      {
        find: /^(?:\.\.\/|\.\/)api\/client$/,
        replacement: fileURLToPath(new URL('./src/public-demo/client.ts', import.meta.url)),
      },
      {
        find: /^(?:\.\.\/|\.\/)experience$/,
        replacement: fileURLToPath(new URL('./src/public-demo/experience.tsx', import.meta.url)),
      },
    ],
  },
  define: { __BUILD_SHA__: JSON.stringify(sha) },
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
  preview: { host: '127.0.0.1', port: 5187, strictPort: true },
  build: {
    outDir: 'dist-pages',
    sourcemap: false,
    manifest: true,
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
});
