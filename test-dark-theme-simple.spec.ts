import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('capture dark theme screenshots', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(5000);
  
  // Capture homepage
  await page.screenshot({ 
    path: 'dark-theme-homepage.png', 
    fullPage: true 
  });
  
  console.log('Homepage screenshot captured!');
});