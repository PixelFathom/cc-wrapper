import { test, expect } from '@playwright/test';

test.describe('Approval Widget - Basic Tests', () => {
  test('should load homepage and show approval widget', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the approval widget button exists (it should always be there)
    // Look for the floating action button
    const fabButton = page.locator('button').filter({ 
      has: page.locator('svg').first() 
    }).last();
    
    // The button should be visible
    await expect(fabButton).toBeVisible({ timeout: 10000 });
    
    // Click the button to open the approval panel
    await fabButton.click();
    
    // Check if the approval center panel opens
    await expect(page.locator('text=Approval Center')).toBeVisible({ timeout: 5000 });
    
    // Close the panel by clicking outside or pressing ESC
    await page.keyboard.press('Escape');
    
    // Panel should be hidden
    await expect(page.locator('text=Approval Center')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show empty state when no approvals', async ({ page }) => {
    // Mock empty approvals
    await page.route('**/api/approvals/pending', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Open approval panel
    const fabButton = page.locator('button').filter({ 
      has: page.locator('svg').first() 
    }).last();
    await fabButton.click();
    
    // Should show empty state
    await expect(page.locator('text=All Clear!')).toBeVisible({ timeout: 5000 });
  });

  test('should display mock approvals correctly', async ({ page }) => {
    // Mock approvals data
    await page.route('**/api/approvals/pending', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-1',
            type: 'mcp',
            tool_name: 'Bash',
            display_text: 'Run npm install',
            created_at: new Date().toISOString(),
            urgency: 'high'
          }
        ])
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for the polling to pick up the mocked data
    await page.waitForTimeout(3000);
    
    // Open approval panel
    const fabButton = page.locator('button').filter({ 
      has: page.locator('svg').first() 
    }).last();
    await fabButton.click();
    
    // Should show the approval
    await expect(page.locator('text=Bash')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Run npm install')).toBeVisible({ timeout: 5000 });
  });
});