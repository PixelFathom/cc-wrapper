import { test, expect, Page } from '@playwright/test';

// Mock approval data for testing
const mockApprovals = [
  {
    id: 'test-approval-1',
    type: 'mcp',
    tool_name: 'Bash',
    display_text: 'Execute command: npm install',
    cwd: '/project/frontend',
    created_at: new Date().toISOString(),
    urgency: 'high'
  },
  {
    id: 'test-approval-2',
    type: 'mcp',
    tool_name: 'Write',
    display_text: 'Write file: config.json',
    cwd: '/project/backend',
    created_at: new Date().toISOString(),
    urgency: 'medium'
  },
  {
    id: 'test-approval-3',
    type: 'regular',
    action_type: 'file_edit',
    prompt: 'Edit application settings',
    created_at: new Date().toISOString(),
    urgency: 'low'
  }
];

// Helper to mock API responses
async function mockApprovalAPI(page: Page, approvals: any[] = mockApprovals) {
  await page.route('**/api/approvals/pending', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(approvals)
    });
  });

  // Mock approval submission endpoint
  await page.route('**/api/approvals/result', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });
}

test.describe('Approval Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show floating action button when approvals are pending', async ({ page }) => {
    await mockApprovalAPI(page);
    
    // Wait for the approval center to load
    await page.waitForTimeout(250000); // Wait for polling
    
    // Check floating action button is visible
    const fab = page.locator('button').filter({ hasText: /^\d+$/ }).first();
    await expect(fab).toBeVisible();
    
    // Check badge count
    const badge = page.locator('div').filter({ hasText: '3' }).first();
    await expect(badge).toBeVisible();
    
    // Check urgency-based styling (red/orange for high priority)
    const fabButton = page.locator('motion\\:div button').first();
    await expect(fabButton).toHaveClass(/from-red-600/);
  });

  test('should open approval panel when clicking floating button', async ({ page }) => {
    await mockApprovalAPI(page);
    await page.waitForTimeout(2500);
    
    // Click the floating action button
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    
    // Check panel is visible
    await expect(page.locator('text=Approval Center')).toBeVisible();
    await expect(page.locator('text=Review and manage permissions')).toBeVisible();
    
    // Check all approvals are listed
    await expect(page.locator('text=Bash')).toBeVisible();
    await expect(page.locator('text=Write')).toBeVisible();
    await expect(page.locator('text=file_edit')).toBeVisible();
  });

  test('should display approval details correctly', async ({ page }) => {
    await mockApprovalAPI(page);
    await page.waitForTimeout(2500);
    
    // Open approval panel
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    
    // Check first approval details
    const firstApproval = page.locator('button').filter({ hasText: 'Bash' }).first();
    await expect(firstApproval).toBeVisible();
    
    // Check urgency badge
    await expect(page.locator('text=high').first()).toBeVisible();
    
    // Check working directory
    await expect(page.locator('text=/project/frontend')).toBeVisible();
    
    // Check timestamp
    await expect(page.locator('text=just now')).toBeVisible();
  });

  test('should open approval detail modal when clicking review', async ({ page }) => {
    await mockApprovalAPI(page);
    await page.waitForTimeout(2500);
    
    // Open approval panel
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    
    // Click on an approval
    await page.locator('button').filter({ hasText: 'Bash' }).first().click();
    
    // Check modal is open
    await expect(page.locator('text=Permission Request')).toBeVisible();
    await expect(page.locator('text=Execute command: npm install')).toBeVisible();
    
    // Check action buttons
    await expect(page.locator('button').filter({ hasText: 'Approve' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Deny' })).toBeVisible();
  });

  test('should handle approval submission', async ({ page }) => {
    await mockApprovalAPI(page);
    await page.waitForTimeout(2500);
    
    // Open approval panel and click first approval
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    await page.locator('button').filter({ hasText: 'Bash' }).first().click();
    
    // Add comment
    await page.fill('textarea', 'Looks good to proceed');
    
    // Click approve
    await page.locator('button').filter({ hasText: 'Approve' }).click();
    
    // Modal should close after submission
    await expect(page.locator('text=Permission Request')).not.toBeVisible({ timeout: 2000 });
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await mockApprovalAPI(page);
    await page.waitForTimeout(2500);
    
    // Test Cmd+A to open approval center
    await page.keyboard.press('Meta+a');
    await expect(page.locator('text=Approval Center')).toBeVisible();
    
    // Test ESC to close
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Approval Center')).not.toBeVisible();
    
    // Open again and open a modal
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    await page.locator('button').filter({ hasText: 'Bash' }).first().click();
    
    // Test Cmd+Enter to approve
    await page.keyboard.press('Meta+Enter');
    await expect(page.locator('text=Permission Request')).not.toBeVisible({ timeout: 2000 });
  });

  test('should show empty state when no approvals', async ({ page }) => {
    await mockApprovalAPI(page, []); // Empty approvals
    await page.waitForTimeout(2500);
    
    // Open approval panel
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    
    // Check empty state
    await expect(page.locator('text=All Clear!')).toBeVisible();
    await expect(page.locator('text=No pending approvals at the moment')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await mockApprovalAPI(page);
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2500);
    
    // Check FAB is visible and properly sized
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await expect(fab).toBeVisible();
    
    // Open panel
    await fab.click();
    
    // Panel should take full width on mobile
    const panel = page.locator('div').filter({ hasText: 'Approval Center' }).first();
    await expect(panel).toBeVisible();
    
    // Check backdrop is visible on mobile
    const backdrop = page.locator('div.fixed.inset-0.bg-black\\/50');
    await expect(backdrop).toBeVisible();
  });

  test('should update in real-time when new approvals arrive', async ({ page }) => {
    // Start with no approvals
    await mockApprovalAPI(page, []);
    await page.waitForTimeout(2500);
    
    // Open panel to see empty state
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    await expect(page.locator('text=All Clear!')).toBeVisible();
    
    // Update API to return approvals
    await mockApprovalAPI(page, mockApprovals);
    
    // Wait for polling to pick up changes
    await page.waitForTimeout(3000);
    
    // Should now show approvals
    await expect(page.locator('text=All Clear!')).not.toBeVisible();
    await expect(page.locator('text=Bash')).toBeVisible();
  });

  test('should handle collapsible request details', async ({ page }) => {
    const detailedApproval = [{
      ...mockApprovals[0],
      tool_input: { command: 'npm install', flags: ['--save-dev'] }
    }];
    
    await mockApprovalAPI(page, detailedApproval);
    await page.waitForTimeout(2500);
    
    // Open approval and modal
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    await page.locator('button').filter({ hasText: 'Bash' }).first().click();
    
    // Check request details button
    const detailsButton = page.locator('button').filter({ hasText: 'Request Details' });
    await expect(detailsButton).toBeVisible();
    
    // Click to expand
    await detailsButton.click();
    
    // Check JSON content is visible
    await expect(page.locator('text="command"')).toBeVisible();
    await expect(page.locator('text="npm install"')).toBeVisible();
  });
});

test.describe('Approval Widget - Error Handling', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/approvals/pending', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/');
    await page.waitForTimeout(2500);
    
    // FAB should still be visible (with no count)
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await expect(fab).toBeVisible();
    
    // Open panel
    await fab.click();
    
    // Should show empty state (fallback on error)
    await expect(page.locator('text=All Clear!')).toBeVisible();
  });

  test('should handle submission errors', async ({ page }) => {
    await mockApprovalAPI(page);
    
    // Mock submission to fail
    await page.route('**/api/approvals/result', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid approval' })
      });
    });
    
    await page.waitForTimeout(2500);
    
    // Open approval and modal
    const fab = page.locator('button').filter({ has: page.locator('svg') }).last();
    await fab.click();
    await page.locator('button').filter({ hasText: 'Bash' }).first().click();
    
    // Try to approve
    await page.locator('button').filter({ hasText: 'Approve' }).click();
    
    // Modal should remain open on error
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Permission Request')).toBeVisible();
  });
});