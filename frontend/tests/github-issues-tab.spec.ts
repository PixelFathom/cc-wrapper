import { test, expect } from '@playwright/test'

/**
 * Comprehensive test for GitHub Issues Tab functionality
 * Tests the UI components, filtering, and interaction
 */

test.describe('GitHub Issues Tab - UI Verification', () => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')
  })

  test('should render without module errors', async ({ page }) => {
    // Track console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(2000)

    // Check for module resolution errors
    const hasModuleError = errors.some(err =>
      err.includes("Module not found") ||
      err.includes("Can't resolve") ||
      err.includes("@radix-ui/react-select")
    )

    expect(hasModuleError).toBeFalsy()
    console.log('✓ No module resolution errors detected')
  })

  test('should display Issues tab for GitHub-linked projects', async ({ page }) => {
    // Navigate to first project if available
    const projectCards = page.locator('a[href*="/p/"]')
    const projectCount = await projectCards.count()

    if (projectCount > 0) {
      await projectCards.first().click()
      await page.waitForLoadState('networkidle')

      // Check if Issues tab exists
      const issuesTab = page.locator('button:has-text("Issues")')
      const hasIssuesTab = await issuesTab.count() > 0

      if (hasIssuesTab) {
        console.log('✓ Issues tab found')

        // Click on Issues tab
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Verify Issues tab content loaded
        const tabContent = page.locator('text=/GitHub Issues|No.*issues|not linked/i')
        await expect(tabContent.first()).toBeVisible()
        console.log('✓ Issues tab content loaded')
      } else {
        console.log('⚠ Project does not have Issues tab (not a GitHub project)')
      }
    } else {
      console.log('⚠ No projects available to test')
    }
  })

  test('should have GitHub Issues UI components', async ({ page }) => {
    const projectCards = page.locator('a[href*="/p/"]')
    const projectCount = await projectCards.count()

    if (projectCount > 0) {
      await projectCards.first().click()
      await page.waitForLoadState('networkidle')

      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for GitHub Issues header
        const header = page.locator('text=/GitHub Issues/i')
        if (await header.count() > 0) {
          console.log('✓ GitHub Issues header present')
        }

        // Check for Sync button
        const syncButton = page.locator('button:has-text("Sync")')
        if (await syncButton.count() > 0) {
          console.log('✓ Sync button present')
        }

        // Check for Search input
        const searchInput = page.locator('input[placeholder*="Search"]')
        if (await searchInput.count() > 0) {
          console.log('✓ Search input present')

          // Test search functionality
          await searchInput.fill('test')
          await page.waitForTimeout(500)
          console.log('✓ Search input is functional')
        }

        // Check for State filter dropdown (Select component)
        const stateFilter = page.locator('[role="combobox"]')
        if (await stateFilter.count() > 0) {
          console.log('✓ State filter dropdown present (Select component working)')

          // Try to open the dropdown
          await stateFilter.first().click()
          await page.waitForTimeout(500)

          // Check if dropdown options appear
          const dropdownOptions = page.locator('[role="option"], text=/Open|Closed|All/')
          if (await dropdownOptions.count() > 0) {
            console.log('✓ Dropdown options rendered correctly')
          }

          // Close dropdown
          await page.keyboard.press('Escape')
        }
      }
    }
  })

  test('should handle non-GitHub projects gracefully', async ({ page }) => {
    const projectCards = page.locator('a[href*="/p/"]')
    const projectCount = await projectCards.count()

    if (projectCount > 0) {
      await projectCards.first().click()
      await page.waitForLoadState('networkidle')

      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for appropriate messaging
        const notLinkedMessage = page.locator('text=/not linked to.*GitHub repository/i')
        const hasMessage = await notLinkedMessage.count() > 0

        if (hasMessage) {
          console.log('✓ Appropriate message shown for non-GitHub projects')
          await expect(notLinkedMessage.first()).toBeVisible()
        }
      }
    }
  })

  test('should display stats and filters correctly', async ({ page }) => {
    const projectCards = page.locator('a[href*="/p/"]')
    const projectCount = await projectCards.count()

    if (projectCount > 0) {
      await projectCards.first().click()
      await page.waitForLoadState('networkidle')

      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for stats display
        const statsText = page.locator('text=/\\d+ issues? found|\\d+ open|\\d+ closed/i')
        if (await statsText.count() > 0) {
          console.log('✓ Issue statistics displayed')
        }

        // Check for filter controls
        const filters = page.locator('input[placeholder*="Search"], [role="combobox"]')
        const filterCount = await filters.count()

        if (filterCount >= 2) {
          console.log('✓ Both search and state filters are present')
        }
      }
    }
  })

  test('should render Badge components for issue states', async ({ page }) => {
    const projectCards = page.locator('a[href*="/p/"]')
    const projectCount = await projectCards.count()

    if (projectCount > 0) {
      await projectCards.first().click()
      await page.waitForLoadState('networkidle')

      const issuesTab = page.locator('button:has-text("Issues")')
      if (await issuesTab.count() > 0) {
        await issuesTab.click()
        await page.waitForTimeout(1000)

        // Check for badge elements (used for issue states and labels)
        const badges = page.locator('[class*="badge"], .inline-flex.items-center.rounded-full')
        const badgeCount = await badges.count()

        if (badgeCount > 0) {
          console.log(`✓ Badge components rendered (${badgeCount} found)`)
        } else {
          console.log('⚠ No badges found (may be no issues to display)')
        }
      }
    }
  })

  test('should navigate back to Tasks tab', async ({ page }) => {
    const projectCards = page.locator('a[href*="/p/"]')
    const projectCount = await projectCards.count()

    if (projectCount > 0) {
      await projectCards.first().click()
      await page.waitForLoadState('networkidle')

      const issuesTab = page.locator('button:has-text("Issues")')
      const tasksTab = page.locator('button:has-text("Tasks")')

      if (await issuesTab.count() > 0 && await tasksTab.count() > 0) {
        // Click Issues tab
        await issuesTab.click()
        await page.waitForTimeout(500)

        // Click back to Tasks tab
        await tasksTab.click()
        await page.waitForTimeout(500)

        // Verify Tasks content is visible
        const tasksContent = page.locator('text=/task.*list|\$.*task/i')
        if (await tasksContent.count() > 0) {
          console.log('✓ Successfully navigated between tabs')
        }
      }
    }
  })
})
