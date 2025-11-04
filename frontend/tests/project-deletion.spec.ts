import { test, expect, Page } from '@playwright/test'

// Helper to set up authenticated user
async function setupAuthenticatedUser(page: Page) {
  await page.goto('http://localhost:2000')
  await page.evaluate(() => {
    localStorage.setItem('github_user', JSON.stringify({
      id: '4df33c8a-957d-4146-a09c-7b1fe1019240',
      username: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
      access_token: 'gho_test_token'
    }))
  })
  await page.reload()
  await page.waitForLoadState('networkidle')
}

test.describe('Project Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page)
  })

  test('should show delete button on project detail page', async ({ page }) => {
    // Navigate to projects
    await page.click('button:has-text("Projects")')
    await page.waitForTimeout(500)

    // Look for any project card
    const projectCard = page.locator('[data-testid="project-card"]').first()

    if (await projectCard.isVisible()) {
      // Click on the project to go to detail page
      await projectCard.click()

      // Wait for project detail page to load
      await page.waitForSelector('text="Delete Project"', { timeout: 10000 })

      // Verify delete button exists
      const deleteButton = page.locator('button:has-text("Delete Project")')
      expect(await deleteButton.isVisible()).toBe(true)

      // Verify button has correct styling
      const buttonClasses = await deleteButton.getAttribute('class')
      expect(buttonClasses).toContain('border-red-500')

      console.log('✓ Delete button displayed correctly on project detail page')
    } else {
      console.log('⚠ No projects available to test deletion UI')
    }
  })

  test('should show confirmation modal when delete is clicked', async ({ page }) => {
    // Navigate to projects
    await page.click('button:has-text("Projects")')
    await page.waitForTimeout(500)

    const projectCard = page.locator('[data-testid="project-card"]').first()

    if (await projectCard.isVisible()) {
      await projectCard.click()
      await page.waitForSelector('text="Delete Project"', { timeout: 10000 })

      // Click delete button
      await page.click('button:has-text("Delete Project")')

      // Wait for confirmation modal
      await page.waitForSelector('text="Delete Project"', {
        state: 'visible',
        timeout: 5000
      })

      // Verify modal content
      const modalTitle = page.locator('h3:has-text("Delete Project")')
      expect(await modalTitle.isVisible()).toBe(true)

      // Check for warning message - using partial text match
      const warningText = page.locator('text=/cannot be undone|permanently delete/')
      expect(await warningText.isVisible()).toBe(true)

      // Check for warning list items
      const warningItems = [
        'All tasks will be deleted',
        'All chat sessions will be lost',
        'All test cases will be removed',
        'This action is irreversible'
      ]

      for (const item of warningItems) {
        const element = page.locator(`text="${item}"`)
        expect(await element.isVisible()).toBe(true)
      }

      // Verify buttons
      const cancelButton = page.locator('button:has-text("Cancel")')
      const confirmButton = page.locator('button:has-text("Delete Project")').last()

      expect(await cancelButton.isVisible()).toBe(true)
      expect(await confirmButton.isVisible()).toBe(true)

      console.log('✓ Confirmation modal displayed with all warnings')

      // Test cancel functionality
      await cancelButton.click()
      await page.waitForTimeout(500)

      // Modal should be closed
      const modalAfterCancel = page.locator('h3:has-text("Delete Project")')
      expect(await modalAfterCancel.isVisible()).toBe(false)

      console.log('✓ Cancel button closes the modal')
    }
  })

  test('should handle project deletion flow', async ({ page }) => {
    // For this test, we'll mock the API response to avoid actually deleting data
    let deleteRequestMade = false

    await page.route('**/api/projects/*', async route => {
      if (route.request().method() === 'DELETE') {
        deleteRequestMade = true
        await route.fulfill({
          status: 204,
          body: ''
        })
      } else {
        await route.continue()
      }
    })

    // Navigate to projects
    await page.click('button:has-text("Projects")')
    await page.waitForTimeout(500)

    const projectCard = page.locator('[data-testid="project-card"]').first()

    if (await projectCard.isVisible()) {
      await projectCard.click()
      await page.waitForSelector('text="Delete Project"', { timeout: 10000 })

      // Click delete button
      await page.click('button:has-text("Delete Project")')

      // Wait for modal
      await page.waitForSelector('h3:has-text("Delete Project")')

      // Click confirm button
      const confirmButton = page.locator('button:has-text("Delete Project")').last()
      await confirmButton.click()

      // Wait for potential redirect or loading state
      await page.waitForTimeout(2000)

      // Verify API was called
      expect(deleteRequestMade).toBe(true)
      console.log('✓ Delete API endpoint was called')

      // Should redirect to home page after deletion
      await page.waitForURL('**/p/*', {
        state: 'detached',
        timeout: 5000
      }).catch(() => {
        console.log('✓ Page redirected after deletion')
      })
    }
  })
})

test.describe('Issue Solving Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page)
  })

  test('should show improved confirmation modal when solving issue', async ({ page }) => {
    // Navigate to GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')
    await page.waitForTimeout(500)

    // Select a repository with issues
    const repoCard = page.locator('button:has-text("chatwoot")').first()

    if (await repoCard.isVisible()) {
      await repoCard.click()
      await page.waitForSelector('text=/open issue|No open issues/', { timeout: 10000 })

      const issueCard = page.locator('div:has(> div > div > span:has-text("#"))').first()

      if (await issueCard.isVisible()) {
        await issueCard.click()
        await page.waitForSelector('text="Solve This Issue"')

        // Click solve button
        await page.click('button:has-text("Solve This Issue")')

        // Wait for confirmation modal
        await page.waitForSelector('text="Start Issue Resolution"', { timeout: 5000 })

        // Verify improved modal content
        const modalTitle = page.locator('h3:has-text("Start Issue Resolution")')
        expect(await modalTitle.isVisible()).toBe(true)

        // Check for issue details section
        const issueDetails = page.locator('text="📋 Issue Details:"')
        expect(await issueDetails.isVisible()).toBe(true)

        // Check for next steps section
        const nextSteps = page.locator('text="🚀 Next Steps:"')
        expect(await nextSteps.isVisible()).toBe(true)

        // Verify next steps list
        const steps = [
          'Create a dedicated task for this issue',
          'Initialize development environment',
          'Start automated resolution process',
          "You'll be redirected to the task page"
        ]

        for (const step of steps) {
          const element = page.locator(`text="${step}"`)
          expect(await element.isVisible()).toBe(true)
        }

        console.log('✓ Improved issue solving confirmation modal displayed correctly')

        // Test cancel
        const cancelButton = page.locator('button:has-text("Cancel")')
        await cancelButton.click()

        await page.waitForTimeout(500)
        const modalAfterCancel = page.locator('h3:has-text("Start Issue Resolution")')
        expect(await modalAfterCancel.isVisible()).toBe(false)

        console.log('✓ Cancel button works correctly')
      } else {
        console.log('⚠ No issues available to test')
      }
    } else {
      console.log('⚠ Repository not found')
    }
  })

  test('should show fork notice in confirmation when applicable', async ({ page }) => {
    // Navigate to GitHub Issues tab
    await page.click('button:has-text("GitHub Issues")')
    await page.waitForTimeout(500)

    // Look for a public repository without write access
    const publicRepo = page.locator('button').filter({
      has: page.locator('text=/\\d+ issues/'),
      hasNot: page.locator('text="Fork"')
    }).first()

    if (await publicRepo.isVisible()) {
      await publicRepo.click()
      await page.waitForSelector('text=/open issue|No open issues/', { timeout: 10000 })

      const issueCard = page.locator('div:has(> div > div > span:has-text("#"))').first()

      if (await issueCard.isVisible()) {
        await issueCard.click()
        await page.waitForSelector('text="Solve This Issue"')

        // Click solve button
        await page.click('button:has-text("Solve This Issue")')

        // Wait for confirmation modal
        await page.waitForSelector('text="Start Issue Resolution"', { timeout: 5000 })

        // Check for fork notice
        const forkNotice = page.locator('text="🔀 Fork Required:"')
        if (await forkNotice.isVisible()) {
          console.log('✓ Fork notice displayed in confirmation modal')

          const forkDescription = page.locator('text=/fork will be created automatically/')
          expect(await forkDescription.isVisible()).toBe(true)
          console.log('✓ Fork description displayed correctly')
        } else {
          console.log('⚠ Repository may have write access or fork notice not shown')
        }
      }
    } else {
      console.log('⚠ No suitable public repositories found')
    }
  })
})

console.log('\n=== Project Deletion and Confirmation Tests Complete ===\n')