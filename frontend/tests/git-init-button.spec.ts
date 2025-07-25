import { test, expect } from '@playwright/test';

test.describe('Git Init and Push Button', () => {
  test('should submit form when clicking git init && push button', async ({ page }) => {
    await page.goto('/');

    // Click create project button to open dialog
    await page.click('button[aria-label="Create project"]');
    
    // Wait for dialog to be visible
    await page.waitForSelector('[role="dialog"]');
    
    // Fill project form
    await page.fill('input#name', 'Test CC Wrapper 2');
    await page.fill('input#repo', 'git@github.com:PixelFathom/cc-wrapper-2.git');
    
    // Wait for validation to complete
    await page.waitForTimeout(500);
    
    // Click the git init && push button
    const submitButton = page.locator('button:has-text("git init && push")');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    
    // Set up request interception to catch the API call
    const createProjectPromise = page.waitForRequest(request => 
      request.url().includes('/api/projects') && request.method() === 'POST'
    );
    
    // Click the button
    await submitButton.click();
    
    // Verify the API request was made
    const request = await createProjectPromise;
    const postData = request.postDataJSON();
    
    expect(postData).toEqual({
      name: 'Test CC Wrapper 2',
      repo_url: 'git@github.com:PixelFathom/cc-wrapper-2.git'
    });
  });

  test('should validate PixelFathom repository URLs', async ({ page }) => {
    await page.goto('/');

    // Click create project button
    await page.click('button[aria-label="Create project"]');
    
    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');
    
    // Test invalid URL
    await page.fill('input#repo', 'https://github.com/other/repo.git');
    
    // Should show error message
    await expect(page.locator('text=Only PixelFathom GitHub SSH URLs are allowed')).toBeVisible();
    
    // Submit button should still be enabled but form validation should prevent submission
    const submitButton = page.locator('button:has-text("git init && push")');
    await expect(submitButton).toBeVisible();
    
    // Test valid URL
    await page.fill('input#repo', 'git@github.com:PixelFathom/cc-wrapper.git');
    
    // Error should disappear and checkmark should appear
    await expect(page.locator('text=Only PixelFathom GitHub SSH URLs are allowed')).not.toBeVisible();
    await expect(page.locator('svg.text-green-500')).toBeVisible();
  });
});