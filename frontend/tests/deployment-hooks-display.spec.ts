import { test, expect } from '@playwright/test';

const PROJECT_ID = 'bb9fb55c-b0cb-4302-91cf-698ece95e36d';
const TASK_ID = '0bdcaa4d-ad47-4a52-9cc0-2fdc7665a199';
const USER_ID = '59ca99bb-84ce-4bdd-aaef-a07003036eee';
const BASE_URL = 'http://localhost:2000';

test.describe('Deployment Hooks Display', () => {
  test.beforeEach(async ({ page }) => {
    // Set user authentication in localStorage first
    await page.goto(BASE_URL);
    await page.evaluate((userId) => {
      localStorage.setItem('github_user', JSON.stringify({ id: userId }));
    }, USER_ID);
  });

  test('should display deployment hooks in task detail view', async ({ page }) => {
    // Navigate to the task page
    await page.goto(`${BASE_URL}/p/${PROJECT_ID}/t/${TASK_ID}`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for deployment hooks to load (API call)
    const deploymentHooksRequest = page.waitForResponse(
      (response) => response.url().includes(`/tasks/${TASK_ID}/deployment-hooks`),
      { timeout: 10000 }
    );

    try {
      const response = await deploymentHooksRequest;
      const hooksData = await response.json();

      console.log('Deployment hooks response:', hooksData);

      // Check if we have hooks
      if (hooksData.hooks && hooksData.hooks.length > 0) {
        // First check if we're on the deployment stage - may need to click to expand it
        const deploymentStage = page.locator('text=Deployment').first();
        if (await deploymentStage.isVisible()) {
          console.log('Found deployment stage header, attempting to expand...');
          await deploymentStage.click();
          await page.waitForTimeout(1000);
        }

        // Verify that the "Jobs" section header is visible
        await expect(page.locator('h3:has-text("Jobs")').first()).toBeVisible({ timeout: 10000 });

        // Verify deployment logs component is rendered
        const deploymentLogsContainer = page.locator('div.rounded-lg.border').filter({
          has: page.locator('h3:has-text("Jobs")')
        });
        await expect(deploymentLogsContainer).toBeVisible();

        // Verify hook count is displayed
        const hookCount = hooksData.hooks.length;
        await expect(page.locator(`text=${hookCount} events`).first()).toBeVisible();

        // Verify at least one job/step is displayed
        const jobItems = page.locator('[data-testid="job-item"], .group.hover\\:bg-muted\\/30');
        const jobCount = await jobItems.count();
        expect(jobCount).toBeGreaterThan(0);

        console.log(`Found ${jobCount} job groups in the UI`);

        // Check for status icons (completed, running, or error)
        const statusIcons = page.locator('svg').filter({
          hasText: /CheckCircled|CrossCircled|Update|Clock/
        });
        expect(await statusIcons.count()).toBeGreaterThan(0);

        // Expand the first job to see detailed hooks
        const firstJob = jobItems.first();
        await firstJob.click();

        // Wait for expansion animation
        await page.waitForTimeout(500);

        // Verify detailed steps are visible after expansion
        const detailedSteps = page.locator('.border-l-2.border-muted');
        await expect(detailedSteps.first()).toBeVisible();

        // Check that individual hook details are displayed
        const hookDetails = page.locator('text=/Waiting for jobs|COMPLETED|ERROR|FAILED|completed|succeeded/i');
        expect(await hookDetails.count()).toBeGreaterThan(0);

        console.log('✅ Deployment hooks are properly displayed on the UI');
      } else {
        console.log('No deployment hooks found in response');

        // If no hooks, verify the waiting state is shown
        await expect(page.locator('text=Waiting for jobs to start...')).toBeVisible();
      }
    } catch (error) {
      console.error('Failed to load deployment hooks:', error);
      throw error;
    }
  });

  test('should display hook details when expanded', async ({ page }) => {
    // Navigate to the task page
    await page.goto(`${BASE_URL}/p/${PROJECT_ID}/t/${TASK_ID}`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for deployment hooks
    await page.waitForResponse(
      (response) => response.url().includes(`/tasks/${TASK_ID}/deployment-hooks`),
      { timeout: 10000 }
    );

    // Wait for Jobs section
    await page.waitForSelector('text=Jobs', { timeout: 10000 });

    // Find and click the first job item to expand
    const jobItems = page.locator('button').filter({
      has: page.locator('h4')
    });

    if (await jobItems.count() > 0) {
      const firstJob = jobItems.first();
      await firstJob.click();

      // Wait for expansion
      await page.waitForTimeout(500);

      // Look for "View output" buttons which indicate hooks with details
      const viewOutputButtons = page.locator('button:has-text("View output")');

      if (await viewOutputButtons.count() > 0) {
        // Click the first "View output" button
        await viewOutputButtons.first().click();

        // Wait for hook details to expand
        await page.waitForTimeout(300);

        // Verify that detailed information is displayed
        // Could be tool input, result, error, or metadata
        const codeBlocks = page.locator('pre code');
        expect(await codeBlocks.count()).toBeGreaterThan(0);

        console.log('✅ Hook details expand and display properly');
      } else {
        console.log('No hooks with detailed output found');
      }
    }
  });

  test('should show deployment progress indicators', async ({ page }) => {
    // Navigate to the task page
    await page.goto(`${BASE_URL}/p/${PROJECT_ID}/t/${TASK_ID}`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for deployment hooks response
    const response = await page.waitForResponse(
      (response) => response.url().includes(`/tasks/${TASK_ID}/deployment-hooks`),
      { timeout: 10000 }
    );

    const hooksData = await response.json();

    if (hooksData.hooks && hooksData.hooks.length > 0) {
      // Check for deployment progress bar
      const progressBar = page.locator('text=Deployment Progress').first();
      await expect(progressBar).toBeVisible();

      // Verify event count is displayed
      await expect(page.locator(`text=${hooksData.hooks.length} events`).first()).toBeVisible();

      console.log('✅ Deployment progress indicators are visible');
    }
  });

  test('should poll for new deployment hooks when deployment is active', async ({ page }) => {
    // Navigate to the task page
    await page.goto(`${BASE_URL}/p/${PROJECT_ID}/t/${TASK_ID}`);

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Track deployment hooks API calls
    let requestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes(`/tasks/${TASK_ID}/deployment-hooks`)) {
        requestCount++;
        console.log(`Deployment hooks API call #${requestCount}`);
      }
    });

    // Wait for first request
    await page.waitForResponse(
      (response) => response.url().includes(`/tasks/${TASK_ID}/deployment-hooks`)
    );

    // Wait for polling to occur (should happen within 5 seconds based on refetchInterval)
    await page.waitForTimeout(6000);

    // Verify multiple requests were made (polling is active)
    expect(requestCount).toBeGreaterThan(1);
    console.log(`✅ Polling is active: ${requestCount} requests made`);
  });

  test('should verify X-User-ID header is sent with deployment hooks request', async ({ page }) => {
    // Navigate to the task page
    await page.goto(`${BASE_URL}/p/${PROJECT_ID}/t/${TASK_ID}`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Intercept the deployment hooks request and verify headers
    const requestPromise = page.waitForRequest(
      (request) => request.url().includes(`/tasks/${TASK_ID}/deployment-hooks`)
    );

    const request = await requestPromise;
    const headers = request.headers();

    // Verify X-User-ID header is present
    expect(headers['x-user-id']).toBe(USER_ID);
    console.log('✅ X-User-ID header is correctly set:', headers['x-user-id']);
  });
});
