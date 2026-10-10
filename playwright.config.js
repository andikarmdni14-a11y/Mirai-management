// @ts-check
// Uji E2E Mirai. Server uji (tests/fixtures/server.js) dijalankan oleh tiap berkas spec, jadi tidak perlu webServer.
// Supabase diganti SDK tiruan; tidak ada koneksi ke proyek Supabase sungguhan.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // tiap spec memakai server uji dan basis data tiruan sendiri; berurutan agar log mudah dibaca
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
