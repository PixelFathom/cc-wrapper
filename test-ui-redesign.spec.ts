import { test, expect } from '@playwright/test';

test('capture redesigned UI screenshots', async ({ page }) => {
  // Navigate to homepage
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  
  // Wait for hero section to load
  await page.waitForSelector('h1', { timeout: 10000 });
  
  // Capture full page screenshot
  await page.screenshot({ 
    path: 'redesigned-homepage-full.png', 
    fullPage: true 
  });
  
  // Capture hero section
  await page.screenshot({ 
    path: 'redesigned-hero.png',
    clip: { x: 0, y: 0, width: 1280, height: 800 }
  });
  
  // Scroll to projects section
  await page.evaluate(() => {
    document.querySelector('h2')?.scrollIntoView({ behavior: 'smooth' });
  });
  await page.waitForTimeout(1000);
  
  // Capture projects section
  await page.screenshot({ 
    path: 'redesigned-projects.png' 
  });
  
  // Test dark mode
  const themeToggle = await page.locator('button').filter({ has: page.locator('svg') }).first();
  await themeToggle.click();
  await page.waitForTimeout(500);
  
  await page.screenshot({ 
    path: 'redesigned-dark-mode.png',
    fullPage: true
  });
  
  // Open create project dialog
  await page.click('text=Create New Project');
  await page.waitForSelector('text=Start something amazing');
  
  await page.screenshot({ 
    path: 'redesigned-create-dialog.png' 
  });
  
  console.log('UI redesign screenshots captured successfully!');
});