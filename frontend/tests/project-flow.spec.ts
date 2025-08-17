import { test, expect } from '@playwright/test';

test('create project and navigate to task', async ({ page }) => {
  await page.goto('/');

  // Click create project button
  await page.click('button[aria-label="Create project"]');
  
  // Fill project form
  await page.fill('input[name="name"]', 'E2E Test Project');
  await page.fill('input[name="repo"]', 'https://github.com/test/e2e');
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForSelector('h1:has-text("E2E Test Project")');
  
  // Create a task
  await page.click('button:has-text("Add Task")');
  await page.fill('input[placeholder="Task name"]', 'E2E Test Task');
  await page.click('button:has-text("Create")');
  
  // Click on the task
  await page.click('text=E2E Test Task');
  
  // Verify we're on the task page
  await expect(page.locator('h1')).toContainText('E2E Test Task');
});

test('mobile responsive layout', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  await page.goto('/');
  
  // Check that cards stack vertically on mobile
  const cards = await page.locator('.grid > div').count();
  if (cards > 0) {
    const firstCard = await page.locator('.grid > div').first().boundingBox();
    const secondCard = await page.locator('.grid > div').nth(1).boundingBox();
    
    if (firstCard && secondCard) {
      // Cards should be stacked vertically
      expect(firstCard.y).toBeLessThan(secondCard.y);
    }
  }
});