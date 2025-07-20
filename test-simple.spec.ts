import { test, expect } from '@playwright/test';

test('check API and frontend connectivity', async ({ page }) => {
  // Test 1: Check if backend is accessible
  console.log('Testing backend API...');
  const apiResponse = await page.request.get('http://localhost:8000/api/projects');
  console.log('API Status:', apiResponse.status());
  const projects = await apiResponse.json();
  console.log('Projects from API:', projects);

  // Test 2: Load frontend
  console.log('\nLoading frontend...');
  await page.goto('http://localhost:3001');
  
  // Test 3: Check page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Test 4: Wait for and check main heading
  await page.waitForSelector('h1', { timeout: 5000 });
  const heading = await page.locator('h1').textContent();
  console.log('Main heading:', heading);
  
  // Test 5: Check for skeleton loaders or project cards
  const skeletons = await page.locator('.animate-pulse').count();
  console.log('Number of skeleton loaders:', skeletons);
  
  const projectCards = await page.locator('.rounded-2xl').count();
  console.log('Number of project cards:', projectCards);
  
  // Test 6: Check network activity
  const requests: any[] = [];
  page.on('request', request => {
    if (request.url().includes('api')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('api')) {
      console.log(`API Response: ${response.status()} ${response.url()}`);
    }
  });
  
  // Wait for potential API calls
  await page.waitForTimeout(3000);
  
  console.log('\nAPI Requests made by frontend:', requests);
  
  // Test 7: Check console errors
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.reload();
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('\nConsole errors:', errors);
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
});