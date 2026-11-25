export default {
  testDir: 'test/e2e',
  use: { baseURL: 'http://127.0.0.1:5199', browserName: 'chromium' },
  webServer: { command: 'node build.mjs && node serve.mjs dist 5199', url: 'http://127.0.0.1:5199', reuseExistingServer: false },
}
