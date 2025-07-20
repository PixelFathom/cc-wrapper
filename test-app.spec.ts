import { test, expect, chromium } from '@playwright/test';

test.describe('Project Management App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for initial load
    page.setDefaultTimeout(30000);
  });

  test('should load homepage and display project list', async ({ page }) => {
    console.log('Navigating to homepage...');
    await page.goto('http://localhost:3001');
    
    // Wait for the main heading
    await page.waitForSelector('h1:has-text("Projects")', { timeout: 10000 });
    
    // Check if the page has loaded
    const heading = await page.locator('h1').textContent();
    expect(heading).toBe('Projects');
    
    // Check for the subtitle
    const subtitle = await page.locator('p.text-gray-600').textContent();
    expect(subtitle).toContain('Manage your projects');
    
    // Take screenshot
    await page.screenshot({ path: 'homepage.png' });
  });

  test('should display existing project', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Wait for project cards to load (not skeleton loaders)
    await page.waitForSelector('.rounded-2xl', { timeout: 15000 });
    
    // Look for the TDS GitHub Pages project
    const projectCard = await page.locator('text=TDS GitHub Pages').first();
    
    if (await projectCard.isVisible()) {
      console.log('Found existing project');
      
      // Verify the repo URL is displayed
      const repoText = await page.locator('text=tds-1/tds-1.github.io').first();
      expect(await repoText.isVisible()).toBeTruthy();
      
      await page.screenshot({ path: 'project-list.png' });
    } else {
      console.log('No existing projects found');
    }
  });

  test('should create a new project', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Projects")');
    
    // Click the create button (FAB)
    const createButton = await page.locator('button.fixed.bottom-8.right-8');
    await createButton.click();
    
    // Wait for dialog to open
    await page.waitForSelector('text=Create New Project', { timeout: 5000 });
    
    // Fill in the form
    await page.fill('input[id="name"]', 'Test Playwright Project');
    await page.fill('input[id="repo"]', 'https://github.com/test/playwright-project');
    
    // Submit the form
    await page.click('button:has-text("Create Project")');
    
    // Wait for dialog to close and project to appear
    await page.waitForSelector('text=Test Playwright Project', { timeout: 10000 });
    
    console.log('Project created successfully');
    await page.screenshot({ path: 'new-project.png' });
  });

  test('should navigate to project detail and create task', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Wait for projects to load
    await page.waitForSelector('.rounded-2xl');
    
    // Click on a project card
    const projectCard = await page.locator('.rounded-2xl').first();
    await projectCard.click();
    
    // Wait for navigation to project detail
    await page.waitForSelector('text=Tasks', { timeout: 10000 });
    
    // Click Add Task button
    await page.click('button:has-text("Add Task")');
    
    // Fill in task name
    await page.fill('input[placeholder="Task name"]', 'Playwright Test Task');
    
    // Create the task
    await page.click('button:has-text("Create")');
    
    // Verify task was created
    await page.waitForSelector('text=Playwright Test Task', { timeout: 5000 });
    
    console.log('Task created successfully');
    await page.screenshot({ path: 'task-created.png' });
  });

  test('should test API connectivity', async ({ page }) => {
    // Direct API test
    const response = await page.request.get('http://localhost:8000/api/projects');
    expect(response.ok()).toBeTruthy();
    
    const projects = await response.json();
    console.log(`Found ${projects.length} projects via API`);
    
    // Test if frontend can access API
    await page.goto('http://localhost:3001');
    
    // Monitor network requests
    const apiRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
      }
    });
    
    // Wait a bit for API calls
    await page.waitForTimeout(3000);
    
    console.log('API requests made by frontend:', apiRequests);
  });

  test('should check console for errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    if (consoleMessages.length > 0) {
      console.log('Console errors found:', consoleMessages);
    } else {
      console.log('No console errors detected');
    }
  });
});

// Standalone test to debug connection issues
test('debug API connection', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable request interception
  await page.route('**/*', route => {
    const request = route.request();
    if (request.url().includes('/api/')) {
      console.log(`API Request: ${request.method()} ${request.url()}`);
    }
    route.continue();
  });
  
  // Check response headers
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`API Response: ${response.status()} ${response.url()}`);
      console.log('Headers:', response.headers());
    }
  });
  
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(5000);
  
  await browser.close();
});