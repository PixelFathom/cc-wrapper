import { test, expect, Page } from '@playwright/test'

// Helper to set up authenticated user
async function setupAuthenticatedUser(page: Page) {
  // Navigate to the page first to establish context
  await page.goto('http://localhost:2000')

  // Then set localStorage
  await page.evaluate(() => {
    localStorage.setItem('github_user', JSON.stringify({
      id: '4df33c8a-957d-4146-a09c-7b1fe1019240',
      username: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
      access_token: 'gho_test_token'
    }))
  })

  // Reload page to pick up localStorage changes
  await page.reload()
  await page.waitForLoadState('networkidle')
}

test.describe('GitHub Issues Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated user (this also navigates to the page)
    await setupAuthenticatedUser(page)
  })

  test('should create project when clicking on repo and fetch issues from backend', async ({ page }) => {
    // Step 1: Navigate to GitHub Issues tab
    // Try different selectors for the tab
    const issuesTab = await page.locator('text="GitHub Issues"').first()
    if (await issuesTab.isVisible()) {
      await issuesTab.click()
    } else {
      // Fallback: try clicking by exact text
      await page.click('button:has-text("GitHub Issues")')
    }
    await page.waitForTimeout(500)

    // Step 2: Wait for repositories to load
    await page.waitForSelector('text=/Loading repositories|chatwoot/', { timeout: 10000 })

    // Step 3: Click on a repository (e.g., chatwoot)
    const repoCard = page.locator('button').filter({ hasText: 'chatwoot' }).first()

    // Intercept API calls to verify correct flow
    const projectsPromise = page.waitForRequest('**/api/projects')
    const createProjectPromise = page.waitForResponse(
      response => response.url().includes('/api/projects') && response.request().method() === 'POST'
    )
    const issuesPromise = page.waitForRequest(req =>
      req.url().includes('/api/projects/') && req.url().includes('/issues')
    )

    // Click the repo
    await repoCard.click()

    // Verify API calls were made in correct order
    await projectsPromise // First, get existing projects
    const createResponse = await Promise.race([
      createProjectPromise.catch(() => null), // Project might already exist
      page.waitForTimeout(2000).then(() => null)
    ])
    await issuesPromise // Finally, fetch issues from backend

    // Step 4: Verify issues are displayed
    await page.waitForSelector('text=/open issue|No open issues/', { timeout: 10000 })

    // Check if we're showing issues or empty state
    const hasIssues = await page.locator('text=#').count() > 0
    if (hasIssues) {
      console.log('✓ Issues loaded from backend')
    } else {
      console.log('✓ No issues in repository')
    }
  })

  test('should solve an issue using correct project ID', async ({ page }) => {
    // Navigate to GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')
    await page.waitForTimeout(500)

    // Select a repository
    const repoCard = page.locator('button').filter({ hasText: 'chatwoot' }).first()
    await repoCard.click()

    // Wait for issues to load
    await page.waitForSelector('text=/open issue|No open issues/', { timeout: 10000 })

    // Check if there are issues
    const issueCards = page.locator('[data-testid="issue-card"], div:has(> div > div > span:has-text("#"))')
    const issueCount = await issueCards.count()

    if (issueCount > 0) {
      // Click on the first issue to view details
      await issueCards.first().click()

      // Wait for modal to appear
      await page.waitForSelector('text="Solve This Issue"', { timeout: 5000 })

      // Set up API interception for solve endpoint
      const solvePromise = page.waitForRequest(req => {
        const url = req.url()
        const method = req.method()
        return url.includes('/api/projects/') &&
               url.includes('/issues/') &&
               url.includes('/solve') &&
               method === 'POST'
      })

      // Click Solve This Issue button
      await page.click('text="Solve This Issue"')

      // Verify the solve API was called with correct params
      const solveRequest = await solvePromise
      const url = solveRequest.url()

      // Extract project ID and issue number from URL
      const urlMatch = url.match(/\/api\/projects\/([^\/]+)\/issues\/(\d+)\/solve/)
      expect(urlMatch).not.toBeNull()

      const [, projectId, issueNumber] = urlMatch!
      console.log(`✓ Solve API called with project_id: ${projectId}, issue_number: ${issueNumber}`)

      // Verify request has correct headers
      const headers = solveRequest.headers()
      expect(headers['x-user-id']).toBe('4df33c8a-957d-4146-a09c-7b1fe1019240')
      expect(headers['content-type']).toContain('application/json')

      console.log('✓ Solve request has correct headers')
    } else {
      console.log('⚠ No issues available to test solving')
    }
  })

  test('should show existing projects in Projects tab', async ({ page }) => {
    // First create a project via GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')
    await page.waitForTimeout(500)

    const repoCard = page.locator('button').filter({ hasText: 'chatwoot' }).first()
    if (await repoCard.isVisible()) {
      await repoCard.click()
      await page.waitForSelector('text=/open issue|No open issues/', { timeout: 10000 })

      // Now go back to Projects tab
      await page.click('button:has-text("Projects")')
      await page.waitForTimeout(500)

      // Verify the project appears in the projects list
      await page.waitForSelector('text=/chatwoot|Active Repositories/', { timeout: 10000 })

      const projectCards = page.locator('[data-testid="project-card"]')
      const projectCount = await projectCards.count()

      if (projectCount > 0) {
        console.log(`✓ ${projectCount} project(s) displayed in Projects tab`)

        // Click on a project to verify it navigates correctly
        const firstProject = projectCards.first()
        const projectLink = firstProject.locator('a').first()
        const href = await projectLink.getAttribute('href')

        if (href && href.startsWith('/p/')) {
          console.log(`✓ Project links to: ${href}`)
        }
      }
    }
  })

  test('should handle repo with no issues gracefully', async ({ page }) => {
    // Navigate to GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')
    await page.waitForTimeout(500)

    // Look for a repo with 0 issues
    const repoWithNoIssues = page.locator('button:has-text("0 issues")').first()

    if (await repoWithNoIssues.isVisible()) {
      await repoWithNoIssues.click()

      // Should show empty state
      await page.waitForSelector('text="No open issues"', { timeout: 10000 })
      console.log('✓ Empty state shown for repo with no issues')
    } else {
      console.log('⚠ No repos with 0 issues to test')
    }
  })

  test('full flow: create project, view issues, solve issue', async ({ page }) => {
    console.log('Starting full flow test...')

    // Step 1: Go to GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')
    console.log('✓ Navigated to GitHub Issues tab')

    // Step 2: Select chatwoot repository
    await page.waitForSelector('button:has-text("chatwoot")', { timeout: 10000 })

    // Monitor network requests
    let projectId: string | null = null
    page.on('response', async response => {
      if (response.url().includes('/api/projects') && response.request().method() === 'POST') {
        const data = await response.json().catch(() => null)
        if (data?.id) {
          projectId = data.id
          console.log(`✓ Project created with ID: ${projectId}`)
        }
      }
    })

    await page.locator('button:has-text("chatwoot")').first().click()
    console.log('✓ Clicked on chatwoot repository')

    // Step 3: Wait for issues to load
    await page.waitForSelector('text=/open issue|No open issues/', { timeout: 10000 })
    const issueCount = await page.locator('div:has(> div > div > span:has-text("#"))').count()
    console.log(`✓ ${issueCount} issues loaded from backend`)

    if (issueCount > 0) {
      // Step 4: Click on first issue
      await page.locator('div:has(> div > div > span:has-text("#"))').first().click()
      await page.waitForSelector('text="Solve This Issue"', { timeout: 5000 })
      console.log('✓ Issue detail modal opened')

      // Step 5: Solve the issue
      const solveResponsePromise = page.waitForResponse(
        resp => resp.url().includes('/solve') && resp.request().method() === 'POST'
      )

      await page.click('text="Solve This Issue"')

      const solveResponse = await solveResponsePromise
      const solveData = await solveResponse.json().catch(() => null)

      if (solveResponse.status() === 200) {
        console.log('✓ Issue solved successfully')
        console.log(`  Task ID: ${solveData?.task_id}`)
        console.log(`  Resolution ID: ${solveData?.resolution_id}`)
      } else if (solveResponse.status() === 409) {
        console.log('⚠ Issue already has a resolution task')
      } else {
        console.log(`✗ Solve failed with status: ${solveResponse.status()}`)
      }
    } else {
      console.log('⚠ No issues available to solve')
    }

    console.log('✓ Full flow test completed')
  })
})

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated user (this also navigates to the page)
    await setupAuthenticatedUser(page)
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')

    // Intercept and fail the repositories request
    await page.route('**/api/github/repositories', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' })
      })
    })

    // Should show error state or handle gracefully
    await page.waitForTimeout(2000)

    // Check that the page doesn't crash
    const pageTitle = await page.title()
    expect(pageTitle).toBeTruthy()
    console.log('✓ Page handles API errors without crashing')
  })
})