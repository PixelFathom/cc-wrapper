import { test, expect } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'

test.describe('Four-Stage Issue Resolution Workflow', () => {
  const projectId = 'test-project-' + uuidv4().slice(0, 8)
  const issueNumber = Math.floor(Math.random() * 1000) + 1
  const issueTitle = 'Fix authentication bug in login component'
  const issueBody = 'Users are unable to login with valid credentials. The error appears to be related to token validation.'

  test.beforeEach(async ({ page }) => {
    // Navigate to the issue resolution page
    await page.goto(`http://localhost:3000/p/${projectId}/issues/${issueNumber}`)

    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test('should display the four-stage timeline', async ({ page }) => {
    // Verify timeline is visible
    await expect(page.locator('.relative').filter({ hasText: 'Environment Setup' })).toBeVisible()
    await expect(page.locator('.relative').filter({ hasText: 'Analysis & Planning' })).toBeVisible()
    await expect(page.locator('.relative').filter({ hasText: 'Code Implementation' })).toBeVisible()
    await expect(page.locator('.relative').filter({ hasText: 'Testing & Verification' })).toBeVisible()
  })

  test('should show issue information in header', async ({ page }) => {
    // Verify issue details are displayed
    await expect(page.getByText(`Issue #${issueNumber}: ${issueTitle}`)).toBeVisible()

    // Check for GitBranch icon
    await expect(page.locator('svg.lucide-git-branch')).toBeVisible()
  })

  test('Stage 1: Deployment stage should initialize environment', async ({ page }) => {
    // Click on deployment stage to expand it
    await page.getByRole('button', { name: /deployment stage/i }).click()

    // Wait for stage content to expand
    await page.waitForTimeout(500)

    // Verify deployment stage content is visible
    await expect(page.getByText('Deployment Progress')).toBeVisible()
    await expect(page.getByText('Deployment Steps')).toBeVisible()

    // Check for deployment steps
    await expect(page.getByText('Initialize Repository')).toBeVisible()
    await expect(page.getByText('Setup Environment')).toBeVisible()
    await expect(page.getByText('Configure Development Tools')).toBeVisible()
    await expect(page.getByText('Verify Setup')).toBeVisible()

    // Verify status badges
    const deploymentCard = page.locator('.card').filter({ hasText: 'Deployment Stage' })
    await expect(deploymentCard.locator('.badge')).toBeVisible()
  })

  test('Stage 2: Planning stage should show analysis and require approval', async ({ page }) => {
    // Navigate to planning stage
    await page.getByRole('button', { name: /planning stage/i }).click()

    // Wait for content to load
    await page.waitForTimeout(500)

    // Check for planning stage elements
    await expect(page.getByText('Implementation Plan')).toBeVisible()

    // Verify tabs are present
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Full Plan' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Chat History' })).toBeVisible()

    // Mock API response for planning completion
    await page.route('**/api/projects/*/issues/*/resolution/stage-status', async route => {
      await route.fulfill({
        json: {
          current_stage: 'planning',
          resolution_state: 'planning',
          stages: {
            deployment: { complete: true, started_at: new Date().toISOString() },
            planning: {
              complete: true,
              started_at: new Date().toISOString(),
              session_id: 'planning-session-123',
              chat_id: 'chat-123'
            }
          },
          next_action: 'Review and approve the implementation plan'
        }
      })
    })

    // Refresh to get updated status
    await page.reload()

    // Wait for approval UI to appear
    await expect(page.getByText('Plan Ready for Review')).toBeVisible({ timeout: 10000 })

    // Check for approval button
    const approveButton = page.getByRole('button', { name: /review & approve plan/i })
    await expect(approveButton).toBeVisible()

    // Test approval dialog
    await approveButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Approve Planning Stage')).toBeVisible()

    // Add approval notes
    await page.getByPlaceholder(/add any notes/i).fill('Looks good, proceed with implementation')

    // Click approve button in dialog
    await page.getByRole('button', { name: /approve & start implementation/i }).click()

    // Verify dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  })

  test('Stage 3: Implementation stage should track activity', async ({ page }) => {
    // Navigate to implementation stage
    await page.getByRole('button', { name: /implementation stage/i }).click()

    // Wait for content
    await page.waitForTimeout(500)

    // Check for implementation metrics
    await expect(page.getByText('Implementation Progress')).toBeVisible()
    await expect(page.getByText('Files Modified')).toBeVisible()
    await expect(page.getByText('Commits')).toBeVisible()
    await expect(page.getByText('Tool Calls')).toBeVisible()

    // Check for activity tabs
    await expect(page.getByRole('tab', { name: 'Activity Feed' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Implementation Output' })).toBeVisible()

    // Click on Activity Feed tab
    await page.getByRole('tab', { name: 'Activity Feed' }).click()
    await expect(page.getByText('Recent Activity')).toBeVisible()

    // Mock implementation activity
    await page.route('**/api/chats/*/hooks', async route => {
      await route.fulfill({
        json: {
          hooks: [
            {
              id: '1',
              tool_name: 'Edit',
              tool_input: { file_path: 'src/components/Login.tsx' },
              received_at: new Date().toISOString()
            },
            {
              id: '2',
              tool_name: 'Bash',
              tool_input: { command: 'git commit -m "Fix authentication"' },
              received_at: new Date().toISOString()
            }
          ]
        }
      })
    })

    // Refresh to see activity
    await page.reload()
    await page.getByRole('button', { name: /implementation stage/i }).click()

    // Verify activity items appear
    await expect(page.getByText(/Modified Login.tsx/i)).toBeVisible({ timeout: 10000 })
  })

  test('Stage 4: Testing stage should show test results', async ({ page }) => {
    // Navigate to testing stage
    await page.getByRole('button', { name: /testing stage/i }).click()

    // Wait for content
    await page.waitForTimeout(500)

    // Check for testing metrics
    await expect(page.getByText('Test Execution Progress')).toBeVisible()
    await expect(page.getByText('Total Tests')).toBeVisible()
    await expect(page.getByText('Passed')).toBeVisible()
    await expect(page.getByText('Failed')).toBeVisible()
    await expect(page.getByText('Success Rate')).toBeVisible()

    // Check for test tabs
    await expect(page.getByRole('tab', { name: 'Test Cases' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Failures' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Test Output' })).toBeVisible()

    // Mock test cases
    await page.route('**/api/tasks/*/test-cases', async route => {
      await route.fulfill({
        json: {
          test_cases: [
            {
              id: 'test-1',
              name: 'Login with valid credentials',
              description: 'Should successfully authenticate user',
              status: 'passed',
              type: 'e2e',
              result: { passed: true, duration: 1234 }
            },
            {
              id: 'test-2',
              name: 'Login with invalid credentials',
              description: 'Should show error message',
              status: 'passed',
              type: 'e2e',
              result: { passed: true, duration: 890 }
            },
            {
              id: 'test-3',
              name: 'Token validation',
              description: 'Should validate JWT tokens correctly',
              status: 'failed',
              type: 'unit',
              result: {
                passed: false,
                error: 'Expected token to be valid but got invalid',
                duration: 45
              }
            }
          ]
        }
      })
    })

    // Refresh to load test cases
    await page.reload()
    await page.getByRole('button', { name: /testing stage/i }).click()

    // Verify test cases are displayed
    await expect(page.getByText('Login with valid credentials')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Token validation')).toBeVisible()

    // Click on Failures tab
    await page.getByRole('tab', { name: 'Failures' }).click()
    await expect(page.getByText('Failed Tests')).toBeVisible()
    await expect(page.getByText('Expected token to be valid')).toBeVisible()

    // Test the regenerate button
    const regenerateButton = page.getByRole('button', { name: /regenerate/i })
    await expect(regenerateButton).toBeVisible()
  })

  test('should handle stage transitions correctly', async ({ page }) => {
    // Mock API responses for stage progression
    const stages = ['deployment', 'planning', 'implementation', 'testing']
    let currentStageIndex = 0

    await page.route('**/api/projects/*/issues/*/resolution/stage-status', async route => {
      const response = {
        current_stage: stages[currentStageIndex],
        resolution_state: stages[currentStageIndex],
        stages: {}
      }

      // Mark previous stages as complete
      for (let i = 0; i < currentStageIndex; i++) {
        response.stages[stages[i]] = {
          complete: true,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        }
      }

      // Current stage in progress
      response.stages[stages[currentStageIndex]] = {
        complete: false,
        started_at: new Date().toISOString()
      }

      await route.fulfill({ json: response })
    })

    // Initial load - deployment stage
    await page.reload()

    // Verify deployment stage is active
    const deploymentCard = page.locator('.card').filter({ hasText: 'Deployment Stage' })
    await expect(deploymentCard.locator('.badge').filter({ hasText: 'Active' })).toBeVisible()

    // Progress to planning stage
    currentStageIndex = 1
    await page.reload()

    // Verify planning stage is active
    const planningCard = page.locator('.card').filter({ hasText: 'Planning Stage' })
    await expect(planningCard.locator('.badge').filter({ hasText: 'Active' })).toBeVisible()

    // Verify deployment stage shows as complete
    await expect(deploymentCard.locator('.badge').filter({ hasText: 'Complete' })).toBeVisible()
  })

  test('should handle errors and allow retry', async ({ page }) => {
    // Mock an error state
    await page.route('**/api/projects/*/issues/*/resolution/stage-status', async route => {
      await route.fulfill({
        json: {
          current_stage: 'implementation',
          resolution_state: 'failed',
          error_message: 'Failed to execute implementation: API rate limit exceeded',
          stages: {
            deployment: { complete: true },
            planning: { complete: true, approved: true },
            implementation: {
              complete: false,
              started_at: new Date().toISOString()
            }
          }
        }
      })
    })

    await page.reload()

    // Check for error alert
    await expect(page.getByText(/Error in implementation stage/i)).toBeVisible()
    await expect(page.getByText(/API rate limit exceeded/i)).toBeVisible()

    // Check for retry button
    const retryButton = page.getByRole('button', { name: /retry stage/i })
    await expect(retryButton).toBeVisible()

    // Mock successful retry
    await page.route('**/api/projects/*/issues/*/resolution/retry-stage', async route => {
      await route.fulfill({ json: { success: true } })
    })

    // Click retry
    await retryButton.click()

    // Should trigger a refetch (we'd see this in real implementation)
    await page.waitForTimeout(1000)
  })

  test('should display next action card appropriately', async ({ page }) => {
    // Mock response with next action
    await page.route('**/api/projects/*/issues/*/resolution/stage-status', async route => {
      await route.fulfill({
        json: {
          current_stage: 'planning',
          resolution_state: 'planning',
          next_action: 'Review the generated implementation plan and approve to proceed',
          stages: {
            deployment: { complete: true },
            planning: {
              complete: true,
              started_at: new Date().toISOString()
            }
          }
        }
      })
    })

    await page.reload()

    // Verify next action card
    await expect(page.getByText('Next Action Required')).toBeVisible()
    await expect(page.getByText(/Review the generated implementation plan/i)).toBeVisible()

    // Check for bot icon
    await expect(page.locator('svg.lucide-bot')).toBeVisible()
  })

  test('mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.reload()

    // Verify mobile layout works
    await expect(page.locator('.grid').first()).toBeVisible()

    // Stage cards should still be clickable
    await page.getByRole('button', { name: /deployment stage/i }).click()
    await expect(page.getByText('Deployment Progress')).toBeVisible()

    // Verify stage timeline is scrollable horizontally on mobile
    const timeline = page.locator('.overflow-x-auto').first()
    await expect(timeline).toBeVisible()
  })
})