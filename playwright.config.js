const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : 'list',

    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure'
    },

    webServer: {
        command: `node tests/static-server.js`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(PORT) }
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ]
});
