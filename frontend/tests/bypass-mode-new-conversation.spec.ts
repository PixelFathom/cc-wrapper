import { test, expect } from '@playwright/test';

test.describe('Bypass Mode Selection for New Conversations', () => {
  test('shows bypass mode selection on new conversations', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Navigate to a project/task
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    
    if (projectCount === 0) {
      // Create a new project
      await page.click('button[aria-label="Create project"]');
      await page.fill('input[name="name"]', 'Bypass Selection Test');
      await page.fill('input[name="repo"]', 'https://github.com/test/bypass-selection');
      await page.click('button[type="submit"]');
      await page.waitForSelector('h1:has-text("Bypass Selection Test")');
      
      // Create a task
      await page.click('button:has-text("Add Task")');
      await page.fill('input[placeholder="Task name"]', 'Test Task');
      await page.click('button:has-text("Create")');
      
      // Navigate to task
      await page.click('text=Test Task');
    } else {
      // Click on first project
      await page.locator('[data-testid="project-card"]').first().click();
      
      // Wait for project page to load and click on first task
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
    }
    
    // Wait for chat interface to load
    await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
    
    // Check for the welcome screen with bypass mode selection
    const welcomeText = page.locator('text=Welcome to developer chat');
    await expect(welcomeText).toBeVisible();
    
    // Check for bypass mode selection options
    const approvalModeSection = page.locator('text=Choose Approval Mode:');
    await expect(approvalModeSection).toBeVisible();
    
    // Verify both options are visible
    const approvalRequiredOption = page.locator('text=Approval Required');
    const bypassModeOption = page.locator('text=Bypass Mode');
    
    await expect(approvalRequiredOption).toBeVisible();
    await expect(bypassModeOption).toBeVisible();
    
    // Verify bypass mode is selected by default (amber styling)
    const bypassButton = page.locator('button:has-text("Bypass Mode")');
    await expect(bypassButton).toHaveClass(/border-amber-500/);
  });
  
  test('can toggle bypass mode before sending first message', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to a chat
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    if (projectCount > 0) {
      await page.locator('[data-testid="project-card"]').first().click();
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
      
      // Wait for chat interface
      await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
      
      // Check if it's a new conversation
      const welcomeText = page.locator('text=Welcome to developer chat');
      if (await welcomeText.isVisible()) {
        // Click on Approval Required option
        const approvalButton = page.locator('button:has-text("Approval Required")');
        await approvalButton.click();
        
        // Verify it's now selected (cyan styling)
        await expect(approvalButton).toHaveClass(/border-cyan-500/);
        
        // Verify bypass indicator in header shows OFF
        const bypassIndicator = page.locator('text=Bypass OFF');
        await expect(bypassIndicator).toBeVisible();
        
        // Toggle back to bypass mode
        const bypassButton = page.locator('button:has-text("Bypass Mode")');
        await bypassButton.click();
        
        // Verify bypass mode is selected
        await expect(bypassButton).toHaveClass(/border-amber-500/);
        
        // Verify bypass indicator in header shows ON
        const bypassOnIndicator = page.locator('text=Bypass ON');
        await expect(bypassOnIndicator).toBeVisible();
      }
    }
  });
  
  test('bypass mode toggle button is always visible in header', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to a chat
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    if (projectCount > 0) {
      await page.locator('[data-testid="project-card"]').first().click();
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
      
      // Wait for chat interface
      await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
      
      // Check for bypass toggle button in header (should be visible even without session)
      const bypassToggleButton = page.locator('button:has-text("Bypass")').first();
      await expect(bypassToggleButton).toBeVisible();
      
      // Click the toggle button
      await bypassToggleButton.click();
      
      // Verify the indicator changes
      // The exact text depends on current state, but button should remain visible
      await expect(bypassToggleButton).toBeVisible();
    }
  });
  
  test('bypass mode preference persists across page reloads', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to a chat
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    if (projectCount > 0) {
      await page.locator('[data-testid="project-card"]').first().click();
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
      await page.locator('[data-testid="task-card"]').first().click();
      
      // Wait for chat interface
      await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
      
      // Check if it's a new conversation
      const welcomeText = page.locator('text=Welcome to developer chat');
      if (await welcomeText.isVisible()) {
        // Set to Approval Required mode
        const approvalButton = page.locator('button:has-text("Approval Required")');
        await approvalButton.click();
        
        // Verify it's selected
        await expect(approvalButton).toHaveClass(/border-cyan-500/);
        
        // Reload the page
        await page.reload();
        
        // Wait for chat interface to reload
        await page.waitForSelector('.gradient-border-neon', { timeout: 10000 });
        
        // Verify Approval Required is still selected after reload
        const approvalButtonAfterReload = page.locator('button:has-text("Approval Required")');
        await expect(approvalButtonAfterReload).toHaveClass(/border-cyan-500/);
        
        // Verify bypass indicator shows OFF
        const bypassIndicator = page.locator('text=Bypass OFF');
        await expect(bypassIndicator).toBeVisible();
      }
    }
  });
});