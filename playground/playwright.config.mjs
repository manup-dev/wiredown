export default {
  testDir: 'test/e2e',
  use: { baseURL: 'http://127.0.0.1:5199', browserName: 'chromium' },
  projects: [
    { name: 'chromium', testIgnore: /play-media\.spec/ },
    // Page emulation does not reach an SVG shown as <img>; launch flags do.
    {
      name: 'forced-media',
      testMatch: /play-media\.spec/,
      use: { launchOptions: { args: ['--force-prefers-reduced-motion', '--force-dark-mode', '--blink-settings=preferredColorScheme=0'] } },
    },
  ],
  webServer: { command: 'node build.mjs && node serve.mjs dist 5199', url: 'http://127.0.0.1:5199', reuseExistingServer: false },
}
