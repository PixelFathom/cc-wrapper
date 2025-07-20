import { test, expect } from '@playwright/test';

test('capture developer-friendly dark theme screenshots', async ({ page }) => {
  // Navigate to homepage
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(3000); // Give page time to load
  
  // Capture full homepage with terminal aesthetic
  await page.screenshot({ 
    path: 'dark-theme-homepage.png', 
    fullPage: true 
  });
  
  // Capture hero section with terminal window
  await page.screenshot({ 
    path: 'dark-theme-hero-terminal.png',
    clip: { x: 0, y: 0, width: 1280, height: 800 }
  });
  
  // Scroll to projects section
  await page.evaluate(() => {
    document.querySelector('h2')?.scrollIntoView({ behavior: 'smooth' });
  });
  await page.waitForTimeout(1000);
  
  // Capture project cards with terminal UI
  await page.screenshot({ 
    path: 'dark-theme-project-cards.png' 
  });
  
  // Click on a project if exists
  const projectCard = await page.locator('a[href^="/p/"]').first();
  if (await projectCard.count() > 0) {
    await projectCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Capture project detail page
    await page.screenshot({ 
      path: 'dark-theme-project-detail.png',
      fullPage: true
    });
    
    // Click on a task if exists
    const taskCard = await page.locator('a[href*="/t/"]').first();
    if (await taskCard.count() > 0) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Capture task detail page
      await page.screenshot({ 
        path: 'dark-theme-task-detail.png',
        fullPage: true
      });
      
      // Switch to chat tab
      await page.click('text=Chat');
      await page.waitForTimeout(500);
      
      // Capture chat interface
      await page.screenshot({ 
        path: 'dark-theme-chat.png' 
      });
    }
    
    // Go back to homepage
    await page.goto('http://localhost:3001');
  }
  
  // Open create project dialog
  await page.click('text=task --new').catch(() => page.click('text=Create New Project'));
  await page.waitForSelector('text=Initialize New Repository');
  
  await page.screenshot({ 
    path: 'dark-theme-create-dialog.png' 
  });
  
  console.log('Developer-friendly dark theme screenshots captured successfully!');
});