import { test, expect } from '@playwright/test';

/**
 * Local Session ID Fix Test
 * 
 * This test verifies that the session ID preservation fix works correctly
 * in the local development environment.
 */

test.describe('Session ID Fix Verification', () => {
  const LOCAL_URL = 'http://localhost:3000';
  
  // Helper to capture session IDs from network requests
  async function captureSessionIdFlow(page: any) {
    const sessionFlow = {
      requests: [] as any[],
      responses: [] as any[],
      sessionIds: [] as string[]
    };
    
    // Capture requests
    page.on('request', (request: any) => {
      if (request.url().includes('/api/query')) {
        const postData = request.postData();
        if (postData) {
          try {
            const data = JSON.parse(postData);
            sessionFlow.requests.push({
              url: request.url(),
              sessionId: data.session_id || null,
              hasSessionId: !!data.session_id,
              timestamp: Date.now()
            });
            console.log('📤 Request:', { 
              hasSessionId: !!data.session_id, 
              sessionId: data.session_id 
            });
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    // Capture responses
    page.on('response', async (response: any) => {
      if (response.url().includes('/api/query')) {
        try {
          const data = await response.json();
          sessionFlow.responses.push({
            url: response.url(),
            sessionId: data.session_id || null,
            status: response.status(),
            timestamp: Date.now()
          });
          
          console.log('📥 Response:', { 
            sessionId: data.session_id, 
            status: response.status() 
          });
          
          if (data.session_id) {
            sessionFlow.sessionIds.push(data.session_id);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    
    return sessionFlow;
  }

  // Helper to navigate to the test project
  async function navigateToTestProject(page: any) {
    await page.goto(LOCAL_URL);
    
    // Wait for the page to load
    await page.waitForSelector('text=Project Hub', { timeout: 15000 });
    
    // Click Start Building to reveal projects
    await page.click('button:has-text("Start Building")');
    
    // Wait for project list to load
    await page.waitForSelector('text=cc-wrapper-3', { timeout: 10000 });
    
    // Click on the test project
    await page.click('text=cc-wrapper-3');
    
    // Wait for project page to load
    await page.waitForSelector('text=test-ecf201ba-5a36-47ad-8027-f17c30397286', { timeout: 10000 });
    
    // Click on the test task
    await page.click('text=test-ecf201ba-5a36-47ad-8027-f17c30397286');
    
    // Wait for task page to load and navigate to Chat tab
    await page.waitForSelector('button:has-text("Chat")', { timeout: 10000 });
    await page.click('button:has-text("Chat")');
    
    // Wait for chat interface to be ready
    await page.waitForSelector('textarea[placeholder*="What\'s happening"]', { timeout: 10000 });
  }

  test('session ID preservation fix works correctly', async ({ page }) => {
    console.log('🔗 Testing session ID preservation fix...');
    
    const sessionFlow = await captureSessionIdFlow(page);
    await navigateToTestProject(page);
    
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    const sendButton = page.locator('button:has-text("Send")');
    
    // Send first message (should not have session_id in request)
    console.log('📝 Sending first message...');
    await chatInput.fill('First message - testing session ID preservation');
    await sendButton.click();
    
    // Wait for message to appear and processing to start
    await expect(page.locator('text=First message - testing session ID')).toBeVisible();
    
    // Wait for processing to complete (input becomes enabled again)
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    
    // Wait a moment for all network activity to settle
    await page.waitForTimeout(3000);
    
    console.log('📊 First message session flow:', {
      requests: sessionFlow.requests.length,
      responses: sessionFlow.responses.length,
      sessionIds: sessionFlow.sessionIds
    });
    
    // Verify first request had no session_id
    const firstRequest = sessionFlow.requests[0];
    expect(firstRequest?.hasSessionId).toBe(false);
    console.log('✅ First request correctly had no session_id');
    
    // Verify response provided a session_id
    const firstResponse = sessionFlow.responses[0];
    expect(firstResponse?.sessionId).toBeTruthy();
    const firstSessionId = firstResponse?.sessionId;
    console.log('✅ First response provided session_id:', firstSessionId);
    
    // Send second message (should include session_id from first response)
    console.log('📝 Sending second message...');
    await chatInput.fill('Second message - verifying session continuity');
    await sendButton.click();
    
    // Wait for message processing
    await expect(page.locator('text=Second message - verifying session')).toBeVisible();
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    await page.waitForTimeout(3000);
    
    console.log('📊 Second message session flow:', {
      requests: sessionFlow.requests.length,
      responses: sessionFlow.responses.length,
      sessionIds: sessionFlow.sessionIds
    });
    
    // CRITICAL TEST: Verify second request had the session_id from first response
    if (sessionFlow.requests.length >= 2) {
      const secondRequest = sessionFlow.requests[1];
      expect(secondRequest?.hasSessionId).toBe(true);
      expect(secondRequest?.sessionId).toBe(firstSessionId);
      console.log('✅ Second request correctly used session_id from first response');
    } else {
      throw new Error('Second request not captured');
    }
    
    // CRITICAL TEST: Verify second response uses the SAME session_id (no new conversation)
    if (sessionFlow.responses.length >= 2) {
      const secondResponse = sessionFlow.responses[1];
      expect(secondResponse?.sessionId).toBe(firstSessionId);
      console.log('✅ Second response preserved session_id (no new conversation created)');
    } else {
      throw new Error('Second response not captured');
    }
    
    // Send third message to triple-verify session preservation
    console.log('📝 Sending third message...');
    await chatInput.fill('Third message - final session verification');
    await sendButton.click();
    
    await expect(page.locator('text=Third message - final session')).toBeVisible();
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Verify all requests and responses use the same session_id
    const allRequestSessionIds = sessionFlow.requests.slice(1).map(r => r.sessionId);
    const allResponseSessionIds = sessionFlow.responses.map(r => r.sessionId);
    
    // All continuation requests should have the same session_id
    expect(allRequestSessionIds.every(id => id === firstSessionId)).toBe(true);
    console.log('✅ All continuation requests used the same session_id');
    
    // All responses should have the same session_id
    expect(allResponseSessionIds.every(id => id === firstSessionId)).toBe(true);
    console.log('✅ All responses preserved the same session_id');
    
    console.log('🎉 Session ID preservation fix verified successfully!');
    console.log('📈 Final stats:', {
      totalRequests: sessionFlow.requests.length,
      totalResponses: sessionFlow.responses.length,
      uniqueSessionIds: new Set(sessionFlow.sessionIds).size,
      expectedSessionIds: 1
    });
    
    // Final assertion: should have exactly 1 unique session ID throughout the conversation
    expect(new Set(sessionFlow.sessionIds).size).toBe(1);
  });
});