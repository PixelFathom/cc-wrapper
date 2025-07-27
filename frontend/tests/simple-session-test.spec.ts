import { test, expect } from '@playwright/test';

/**
 * Simplified Session ID Test
 * 
 * This test verifies session ID preservation at the network level
 * without requiring complex UI navigation.
 */

test.describe('Session ID Preservation', () => {
  test('session IDs are preserved in network requests', async ({ page }) => {
    const requests: any[] = [];
    const responses: any[] = [];
    
    // Capture network requests
    page.on('request', request => {
      if (request.url().includes('/api/query')) {
        const postData = request.postData();
        if (postData) {
          try {
            const data = JSON.parse(postData);
            requests.push({
              sessionId: data.session_id,
              timestamp: Date.now()
            });
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    });
    
    // Capture network responses
    page.on('response', async response => {
      if (response.url().includes('/api/query')) {
        try {
          const data = await response.json();
          responses.push({
            sessionId: data.session_id,
            status: response.status(),
            timestamp: Date.now()
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
    
    // Navigate to any page (don't depend on specific UI)
    await page.goto('http://localhost:3000');
    
    // Use browser console to simulate API calls directly
    await page.evaluate(async () => {
      const baseUrl = 'http://localhost:8000';
      
      // Initialize a project
      const initResponse = await fetch(`${baseUrl}/api/init_project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: 'default',
          cwd: 'test-project/test-task',
          repo_url: 'git@github.com:PixelFathom/test.git'
        })
      });
      
      if (!initResponse.ok) {
        throw new Error('Failed to initialize project');
      }
      
      // Send first message
      const firstResponse = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'First test message',
          org_name: 'default',
          cwd: 'test-project/test-task'
        })
      });
      
      if (!firstResponse.ok) {
        throw new Error('First query failed');
      }
      
      const firstData = await firstResponse.json();
      const sessionId = firstData.session_id;
      
      // Send second message with session_id
      const secondResponse = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Second test message',
          org_name: 'default',
          cwd: 'test-project/test-task',
          session_id: sessionId
        })
      });
      
      if (!secondResponse.ok) {
        throw new Error('Second query failed');
      }
      
      const secondData = await secondResponse.json();
      
      // Store results in window for test access
      (window as any).testResults = {
        firstSessionId: firstData.session_id,
        secondSessionId: secondData.session_id,
        sessionPreserved: firstData.session_id === secondData.session_id
      };
    });
    
    // Get test results
    const testResults = await page.evaluate(() => (window as any).testResults);
    
    console.log('Test Results:', testResults);
    
    // Verify session preservation
    expect(testResults.sessionPreserved).toBe(true);
    expect(testResults.firstSessionId).toBe(testResults.secondSessionId);
    
    console.log('✅ Session ID preservation verified in browser context');
  });
});