import { test, expect } from '@playwright/test';

test.describe('Bypass Mode Indicator', () => {
  test('shows bypass mode indicator in chat interface', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Create a project if needed or use existing one
    // Check if there are any projects
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    
    if (projectCount === 0) {
      // Create a new project
      await page.click('button[aria-label="Create project"]');
      await page.fill('input[name="name"]', 'Bypass Test Project');
      await page.fill('input[name="repo"]', 'https://github.com/test/bypass');
      await page.click('button[type="submit"]');
      await page.waitForSelector('h1:has-text("Bypass Test Project")');
      
      // Create a task
      await page.click('button:has-text("Add Task")');
      await page.fill('input[placeholder="Task name"]', 'Bypass Test Task');
      await page.click('button:has-text("Create")');
      
      // Navigate to task
      await page.click('text=Bypass Test Task');
    } else {
      // Click on first project
      await page.locator('[data-testid="project-card"]').first().click();
      
      // Wait for project page to load and click on first task
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
    }
    
    // Wait for chat interface to load
    await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
    
    // Check for bypass mode indicator
    const bypassIndicator = page.locator('text=Bypass ON');
    await expect(bypassIndicator).toBeVisible();
    
    // Verify the indicator has the correct styling
    const indicatorContainer = page.locator('div:has-text("Bypass ON")').filter({
      has: page.locator('.text-amber-500')
    });
    await expect(indicatorContainer).toBeVisible();
    
    // Verify gear icon is present
    const gearIcon = indicatorContainer.locator('svg');
    await expect(gearIcon).toBeVisible();
  });
  
  test('bypass mode indicator is visible on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Navigate to a project/task (similar to above but simplified for mobile)
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    
    if (projectCount > 0) {
      await page.locator('[data-testid="project-card"]').first().click();
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
      
      // Wait for chat interface
      await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
      
      // Verify bypass indicator is still visible on mobile
      const bypassIndicator = page.locator('text=Bypass ON');
      await expect(bypassIndicator).toBeVisible();
    }
  });
  
  test('bypass mode indicator persists after sending message', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to a chat (reuse existing project/task if available)
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    
    if (projectCount > 0) {
      await page.locator('[data-testid="project-card"]').first().click();
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
      
      // Wait for chat interface
      await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
      
      // Verify bypass indicator is visible before sending message
      await expect(page.locator('text=Bypass ON')).toBeVisible();
      
      // Send a test message
      const textarea = page.locator('textarea[placeholder*="What\'s happening with your code?"]');
      await textarea.fill('Test message for bypass mode');
      
      // Submit the message (either by clicking send button or pressing Enter)
      const sendButton = page.locator('button[type="submit"]');
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        await textarea.press('Enter');
      }
      
      // Wait a moment for the message to be processed
      await page.waitForTimeout(1000);
      
      // Verify bypass indicator is still visible after sending message
      await expect(page.locator('text=Bypass ON')).toBeVisible();
    }
  });
});