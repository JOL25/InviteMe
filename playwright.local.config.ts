import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/local',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3102', trace: 'retain-on-failure' },
  webServer: {
    command:
      'npm run build && npm run start -- --hostname 127.0.0.1 --port 3102',
    url: 'http://localhost:3102',
    reuseExistingServer: false,
    timeout: 180000,
  },
});
