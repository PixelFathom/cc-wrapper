import { defineConfig, devices } from '@playwright/test';

// Docker-optimized Playwright configuration
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: [['html', { open: 'never' }], ['list']],
  
  use: {
    // Use the Docker internal host if running in Docker
    baseURL: process.env.DOCKER_ENV ? 'http://host.docker.internal:3000' : 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Increase timeouts for Docker environment
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  timeout: 60000, // 60 seconds per test

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Disable GPU in Docker
        launchOptions: {
          args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
        }
      },
    },
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
        }
      },
    },
  ],

  // Don't start web server in Docker - assume it's already running
  webServer: process.env.DOCKER_ENV ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000, // 2 minutes to start
  },
});