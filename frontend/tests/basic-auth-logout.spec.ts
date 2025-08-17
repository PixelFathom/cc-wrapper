import { test, expect } from '@playwright/test'

test.describe('Basic Auth Logout', () => {
  test('should show logout button when authenticated and logout successfully', async ({ page }) => {
    // Navigate to the application
    await page.goto('/')

    // Should see the basic auth login form initially
    await expect(page.getByText('Site Authentication')).toBeVisible()
    
    // Login with valid credentials
    await page.getByPlaceholder('Enter username').fill('admin')
    await page.getByPlaceholder('Enter password').fill('admin123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Wait for successful login - should see the main navigation
    await expect(page.getByText('Site Authentication')).not.toBeVisible()
    
    // Should see the logout button in navigation (desktop version)
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click()

    // Should return to login screen
    await expect(page.getByText('Site Authentication')).toBeVisible()
    await expect(page.getByPlaceholder('Enter username')).toBeVisible()
  })

  test('should show logout button in mobile menu', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate and login
    await page.goto('/')
    await page.getByPlaceholder('Enter username').fill('admin')
    await page.getByPlaceholder('Enter password').fill('admin123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Wait for successful login
    await expect(page.getByText('Site Authentication')).not.toBeVisible()

    // Open mobile menu
    await page.getByRole('button', { name: 'Open menu' }).click()

    // Should see logout button in mobile menu
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click()

    // Should return to login screen
    await expect(page.getByText('Site Authentication')).toBeVisible()
  })

  test('logout should clear session storage', async ({ page }) => {
    // Navigate and login
    await page.goto('/')
    await page.getByPlaceholder('Enter username').fill('admin')
    await page.getByPlaceholder('Enter password').fill('admin123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Verify session is stored
    const sessionData = await page.evaluate(() => localStorage.getItem('basic-auth-session'))
    expect(sessionData).toBeTruthy()

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()

    // Verify session is cleared
    const clearedSession = await page.evaluate(() => localStorage.getItem('basic-auth-session'))
    expect(clearedSession).toBeNull()
  })

  test('logout should close mobile menu', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate and login
    await page.goto('/')
    await page.getByPlaceholder('Enter username').fill('admin')
    await page.getByPlaceholder('Enter password').fill('admin123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Open mobile menu
    await page.getByRole('button', { name: 'Open menu' }).click()

    // Verify mobile menu is open (logout button is visible)
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click()

    // After logout, should be back to login screen (mobile menu closes automatically)
    await expect(page.getByText('Site Authentication')).toBeVisible()
  })
})