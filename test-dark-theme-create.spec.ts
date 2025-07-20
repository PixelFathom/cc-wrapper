import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('capture create project dialog', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(3000);
  
  // Look for the create project button - try different selectors
  try {
    // Click on the add new project card (the one with dashed border)
    await page.locator('.border-dashed').first().click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'dark-theme-create-project.png'
    });
    
    console.log('Create project dialog screenshot captured!');
  } catch (error) {
    console.log('Could not open create project dialog:', error.message);
    // Still capture the page state
    await page.screenshot({ 
      path: 'dark-theme-page-state.png'
    });
  }
});