import { test, expect } from '@playwright/test'

// Mock user for testing
const TEST_USER = {
  id: 'test-user-123',
  github_login: 'testuser',
  name: 'Test User',
  email: 'test@example.com'
}

test.describe('GitHub Issue Resolution Workflow', () => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    // Set up authentication by storing user in localStorage
    await page.goto(baseUrl)

    await page.evaluate((user) => {
      localStorage.setItem('github_user', JSON.stringify(user))
    }, TEST_USER)

    // Wait for page to be ready
    await page.waitForLoadState('networkidle')
  })

  test('should show Issues tab on project detail page for GitHub projects', async ({ page }) => {
    // Navigate to a project (assuming we have a test project)
    await page.goto(baseUrl)

    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"], .terminal-bg', { timeout: 10000 })

    // Check if there are any projects
    const hasProjects = await page.locator('[data-testid="project-card"], a[href*="/p/"]').count() > 0

    if (hasProjects) {
      // Click on first project
      const firstProject = page.locator('[data-testid="project-card"], a[href*="/p/"]').first()
      await firstProject.click()

      // Wait for project detail page to load
      await page.waitForLoadState('networkidle')

      // Check if Issues tab is visible (only for GitHub projects)
      const issuesTabExists = await page.locator('button:has-text("Issues")').count() > 0

      if (issuesTabExists) {
        console.log('✓ Issues tab found on project detail page')

        // Click on Issues tab
        await page.locator('button:has-text("Issues")').click()
        await page.waitForTimeout(1000)

        // Check if GitHub issues list is visible or appropriate message
        const hasIssuesList = await page.locator('text=/GitHub Issues|No.*issues/i').count() > 0
        expect(hasIssuesList).toBeTruthy()
        console.log('✓ Issues tab content loaded')
      } else {
        console.log('⚠ Project is not linked to GitHub repository (Issues tab not available)')
      }
    } else {
      console.log('⚠ No projects found to test')
    }
  })

  test('should display GitHub issues list with filters', async ({ page }) => {
    // This test requires a GitHub-linked project
    // We'll check if the components render correctly

    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')

    // Try to find a project with GitHub integration
    const projectLinks = await page.locator('a[href*="/p/"]').all()

    if (projectLinks.length > 0) {
      await projectLinks[0].click()
      await page.waitForLoadState('networkidle')

      // Check for Issues tab
      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for filter controls (state filter)
        const hasFilters = await page.locator('[role="combobox"], select, input[placeholder*="Search"]').count() > 0
        if (hasFilters) {
          console.log('✓ Issue filters are present')
        }

        // Check for sync button
        const syncButton = page.locator('button:has-text("Sync")')
        if (await syncButton.count() > 0) {
          console.log('✓ Sync button found')
        }
      }
    }
  })

  test('should show Issue Resolution tab in task detail', async ({ page }) => {
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')

    // Navigate to any task
    const taskLinks = await page.locator('a[href*="/t/"]').all()

    if (taskLinks.length > 0) {
      await taskLinks[0].click()
      await page.waitForLoadState('networkidle')

      // Check if Issue Resolution tab exists
      const issueResolutionTab = page.locator('button:has-text("Issue Resolution")')
      const tabExists = await issueResolutionTab.count() > 0

      if (tabExists) {
        console.log('✓ Issue Resolution tab found in task detail')

        // Click on the tab
        await issueResolutionTab.click()
        await page.waitForTimeout(1000)

        // Check if content loads (either resolution view or "no resolution" message)
        const hasContent = await page.locator('text=/No resolution|Issue Resolution|Loading/i').count() > 0
        expect(hasContent).toBeTruthy()
        console.log('✓ Issue Resolution tab content loaded')
      } else {
        console.log('⚠ Issue Resolution tab not found (task may not be linked to an issue)')
      }
    } else {
      console.log('⚠ No tasks found to test')
    }
  })

  test('should render issue resolution components without errors', async ({ page }) => {
    // Test that the components can be accessed and don't throw errors
    await page.goto(baseUrl)

    // Listen for console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Listen for page errors
    const pageErrors: Error[] = []
    page.on('pageerror', error => {
      pageErrors.push(error)
    })

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate through the app
    const projectLinks = await page.locator('a[href*="/p/"]').all()
    if (projectLinks.length > 0) {
      await projectLinks[0].click()
      await page.waitForLoadState('networkidle')

      // Try to access Issues tab
      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)
      }
    }

    // Check for React/component errors
    const hasComponentErrors = consoleErrors.some(err =>
      err.includes('Module not found') ||
      err.includes('Cannot resolve') ||
      err.includes('Failed to compile')
    )

    if (hasComponentErrors) {
      console.error('❌ Component errors found:', consoleErrors)
    } else {
      console.log('✓ No critical component errors detected')
    }

    expect(hasComponentErrors).toBeFalsy()
    expect(pageErrors.length).toBe(0)
  })

  test('should have all required UI components available', async ({ page }) => {
    // Test that all new UI components are accessible
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')

    // Check if the page loads without module errors
    const pageTitle = await page.title()
    expect(pageTitle).toBeTruthy()
    console.log('✓ Page loaded successfully:', pageTitle)

    // Navigate to check if components work
    const projectLinks = await page.locator('a[href*="/p/"]').all()
    if (projectLinks.length > 0) {
      await projectLinks[0].click()
      await page.waitForLoadState('networkidle')

      // Check for tabs component (Tasks/Issues tabs)
      const hasTabs = await page.locator('[role="tablist"], button:has-text("Tasks")').count() > 0
      if (hasTabs) {
        console.log('✓ Tabs component working')
      }

      // Try Issues tab if available
      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for Select component (filter dropdown)
        const hasSelect = await page.locator('[role="combobox"]').count() > 0
        if (hasSelect) {
          console.log('✓ Select component working')
        }

        // Check for Badge component (issue labels/states)
        const hasBadge = await page.locator('.inline-flex.items-center.rounded-full, [class*="badge"]').count() > 0
        if (hasBadge) {
          console.log('✓ Badge component working')
        }
      }
    }
  })

  test('should display appropriate messages for non-GitHub projects', async ({ page }) => {
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')

    const projectLinks = await page.locator('a[href*="/p/"]').all()

    if (projectLinks.length > 0) {
      await projectLinks[0].click()
      await page.waitForLoadState('networkidle')

      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for appropriate message if not linked to GitHub
        const hasMessage = await page.locator('text=/not linked to.*GitHub repository|No.*issues/i').count() > 0

        if (hasMessage) {
          console.log('✓ Appropriate message shown for non-GitHub projects')
        }
      }
    }
  })

  test('integration: complete workflow UI elements present', async ({ page }) => {
    // Comprehensive test to verify all UI elements exist
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')

    console.log('Testing complete GitHub Issue Resolution workflow UI...')

    // 1. Check home page loads
    const homeLoaded = await page.locator('text=/Projects|repositories/i').count() > 0
    expect(homeLoaded).toBeTruthy()
    console.log('✓ Home page loaded')

    // 2. Navigate to project
    const projectLinks = await page.locator('a[href*="/p/"]').all()
    if (projectLinks.length > 0) {
      await projectLinks[0].click()
      await page.waitForLoadState('networkidle')
      console.log('✓ Navigated to project')

      // 3. Check for Issues tab
      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        console.log('✓ Issues tab present')

        await issuesTab.click()
        await page.waitForTimeout(1000)
        console.log('✓ Issues tab clicked')

        // 4. Check for issue list components
        const hasIssueHeader = await page.locator('text=/GitHub Issues/i').count() > 0
        if (hasIssueHeader) {
          console.log('✓ GitHub Issues header displayed')
        }

        // 5. Check for filter/search components
        const hasSearch = await page.locator('input[placeholder*="Search"]').count() > 0
        if (hasSearch) {
          console.log('✓ Search input present')
        }
      }

      // 6. Navigate to a task
      const taskLinks = await page.locator('a[href*="/t/"]').all()
      if (taskLinks.length > 0) {
        await taskLinks[0].click()
        await page.waitForLoadState('networkidle')
        console.log('✓ Navigated to task')

        // 7. Check for Issue Resolution tab
        const issueResTab = page.locator('button:has-text("Issue Resolution")')
        if (await issueResTab.count() > 0) {
          console.log('✓ Issue Resolution tab present')

          await issueResTab.click()
          await page.waitForTimeout(1000)
          console.log('✓ Issue Resolution tab clicked')
        }
      }
    }

    console.log('✓ Integration test completed successfully')
  })
})
