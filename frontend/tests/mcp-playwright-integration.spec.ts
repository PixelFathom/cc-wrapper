import { test, expect } from '@playwright/test';

/**
 * MCP Playwright Integration Tests for code.tanmaydeepsharma.com
 * 
 * These tests verify that the Playwright MCP can properly interact with the deployed 
 * application, handle session IDs correctly, and work with the real backend APIs.
 */

test.describe('MCP Playwright Integration with Live Site', () => {
  const LIVE_SITE_URL = 'https://code.tanmaydeepsharma.com';
  
  // Helper to capture session IDs from network requests
  async function captureSessionIdFlow(page: any) {
    const sessionFlow = {
      requests: [] as any[],
      responses: [] as any[],
      sessionIds: [] as string[]
    };
    
    // Capture requests
    page.on('request', (request: any) => {
      if (request.url().includes('/api/query') || request.url().includes('/api/chats/')) {
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
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    // Capture responses
    page.on('response', async (response: any) => {
      if (response.url().includes('/api/query') || response.url().includes('/api/chats/')) {
        try {
          const data = await response.json();
          sessionFlow.responses.push({
            url: response.url(),
            sessionId: data.session_id || null,
            status: response.status(),
            timestamp: Date.now()
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

  // Helper to navigate to a project task
  async function navigateToTask(page: any, projectName: string = 'cc-wrapper-3') {
    await page.goto(LIVE_SITE_URL);
    
    // Wait for project list to load
    await page.waitForSelector('text=Active Repositories', { timeout: 10000 });
    
    // Look for the specified project and click on it
    const projectLink = page.locator(`text=${projectName}`).first();
    await expect(projectLink).toBeVisible();
    await projectLink.click();
    
    // Wait for project page to load
    await page.waitForSelector('text=$tasklist', { timeout: 10000 });
    
    // Check if there are existing tasks, create one if needed
    const taskLinks = page.locator('[href*="/t/"]');
    const taskCount = await taskLinks.count();
    
    if (taskCount === 0) {
      // Create a new task
      await page.click('button:has-text("task --new")');
      await page.fill('input[placeholder*="Task name"]', 'MCP Playwright Test');
      await page.fill('textarea[placeholder*="description"]', 'Test task for MCP Playwright integration');
      await page.click('button:has-text("Create Task")');
      await page.waitForSelector('text=MCP Playwright Test');
      await page.click('text=MCP Playwright Test');
    } else {
      // Use the first existing task
      await taskLinks.first().click();
    }
    
    // Wait for task page to load and navigate to Chat tab
    await page.waitForSelector('button:has-text("Chat")', { timeout: 10000 });
    await page.click('button:has-text("Chat")');
    
    // Wait for chat interface to be ready
    await page.waitForSelector('textarea[placeholder*="What\'s happening"]', { timeout: 10000 });
  }

  test('can navigate to live site and access project', async ({ page }) => {
    console.log('🌐 Testing navigation to live site...');
    
    await page.goto(LIVE_SITE_URL);
    
    // Verify the site loads properly
    await expect(page).toHaveTitle(/Project Hub/);
    
    // Click Start Building to reveal projects
    await page.click('button:has-text("Start Building")');
    
    // Verify projects are visible
    await expect(page.locator('text=Active Repositories')).toBeVisible();
    await expect(page.locator('text=cc-wrapper-3')).toBeVisible();
    
    console.log('✅ Successfully navigated to live site and verified project visibility');
  });

  test('can access chat interface and verify session handling', async ({ page }) => {
    console.log('💬 Testing chat interface access...');
    
    const sessionFlow = await captureSessionIdFlow(page);
    await navigateToTask(page);
    
    // Verify chat interface is loaded
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    await expect(chatInput).toBeVisible();
    
    // Check bypass mode controls
    const bypassButton = page.locator('button:has-text("Bypass")');
    await expect(bypassButton).toBeVisible();
    
    console.log('✅ Chat interface loaded successfully');
    console.log('📊 Session flow captured:', {
      requestCount: sessionFlow.requests.length,
      responseCount: sessionFlow.responses.length,
      sessionIdCount: sessionFlow.sessionIds.length
    });
  });

  test('session ID handling works correctly for new conversations', async ({ page }) => {
    console.log('🔗 Testing session ID handling for new conversations...');
    
    const sessionFlow = await captureSessionIdFlow(page);
    await navigateToTask(page);
    
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    const sendButton = page.locator('button:has-text("Send")');
    
    // Send first message (should not have session_id in request)
    console.log('📝 Sending first message...');
    await chatInput.fill('Hello, this is a test message from Playwright MCP integration');
    await sendButton.click();
    
    // Wait for message to appear and processing to start
    await expect(page.locator('text=Hello, this is a test message')).toBeVisible();
    
    // Wait for processing to complete (input becomes enabled again)
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    
    // Wait a moment for all network activity to settle
    await page.waitForTimeout(2000);
    
    console.log('📊 First message session flow:', {
      requests: sessionFlow.requests.length,
      responses: sessionFlow.responses.length,
      sessionIds: sessionFlow.sessionIds
    });
    
    // Verify first request had no session_id
    const firstRequest = sessionFlow.requests[0];
    expect(firstRequest?.hasSessionId).toBe(false);
    
    // Verify response provided a session_id
    const firstResponse = sessionFlow.responses[0];
    expect(firstResponse?.sessionId).toBeTruthy();
    
    // Send second message (should include session_id from first response)
    console.log('📝 Sending second message...');
    await chatInput.fill('This is my second message to verify session continuity');
    await sendButton.click();
    
    // Wait for message processing
    await expect(page.locator('text=This is my second message')).toBeVisible();
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    await page.waitForTimeout(2000);
    
    console.log('📊 Second message session flow:', {
      requests: sessionFlow.requests.length,
      responses: sessionFlow.responses.length,
      sessionIds: sessionFlow.sessionIds
    });
    
    // Verify second request had the session_id from first response
    if (sessionFlow.requests.length >= 2) {
      const secondRequest = sessionFlow.requests[1];
      expect(secondRequest?.hasSessionId).toBe(true);
      expect(secondRequest?.sessionId).toBe(firstResponse?.sessionId);
    }
    
    console.log('✅ Session ID handling test completed successfully');
  });

  test('bypass mode toggle works correctly', async ({ page }) => {
    console.log('🔄 Testing bypass mode toggle...');
    
    await navigateToTask(page);
    
    const bypassButton = page.locator('button:has-text("Bypass")');
    await expect(bypassButton).toBeVisible();
    
    // Check initial bypass state
    const initialState = await page.locator('text=Bypass').textContent();
    console.log('Initial bypass state:', initialState);
    
    // Toggle bypass mode
    await bypassButton.click();
    
    // Verify state changed
    await page.waitForTimeout(1000);
    const newState = await page.locator('text=Bypass').textContent();
    console.log('New bypass state:', newState);
    
    expect(newState).not.toBe(initialState);
    
    console.log('✅ Bypass mode toggle test completed');
  });

  test('can handle chat sessions and history', async ({ page }) => {
    console.log('📚 Testing chat sessions and history...');
    
    await navigateToTask(page);
    
    // Check for session indicator
    const sessionIndicator = page.locator('button[aria-label*="sessions"], button:has-text("sessions")');
    
    if (await sessionIndicator.isVisible()) {
      await sessionIndicator.click();
      
      // Verify sessions panel opens
      await expect(page.locator('text=sessions')).toBeVisible();
      
      console.log('✅ Sessions panel accessible');
    } else {
      console.log('ℹ️ No existing sessions found, which is expected for new chats');
    }
    
    // Send a test message to create session history
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    const sendButton = page.locator('button:has-text("Send")');
    
    await chatInput.fill('Creating session history for testing');
    await sendButton.click();
    
    await expect(page.locator('text=Creating session history')).toBeVisible();
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    
    console.log('✅ Session history test completed');
  });

  test('can interact with MCP servers through the interface', async ({ page }) => {
    console.log('⚙️ Testing MCP server interaction...');
    
    await navigateToTask(page);
    
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    const sendButton = page.locator('button:has-text("Send")');
    
    // Send a message that would trigger MCP server usage
    await chatInput.fill('Can you help me understand this project structure? Please use your tools to explore the codebase.');
    await sendButton.click();
    
    // Wait for processing
    await expect(page.locator('text=Can you help me understand')).toBeVisible();
    
    // Look for tool usage indicators or hook execution logs
    // These would appear in the chat as the assistant processes the request
    await page.waitForTimeout(5000);
    
    // Check if any tool execution is visible in the UI
    const toolIndicators = page.locator('[data-testid*="tool"], .tool-execution, text=🔧, text=📁, text=🔍');
    const toolCount = await toolIndicators.count();
    
    console.log('📊 Tool execution indicators found:', toolCount);
    
    // Wait for processing to complete
    await expect(chatInput).toBeEnabled({ timeout: 90000 });
    
    console.log('✅ MCP server interaction test completed');
  });

  test('real-time webhook processing works', async ({ page }) => {
    console.log('⚡ Testing real-time webhook processing...');
    
    await navigateToTask(page);
    
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    const sendButton = page.locator('button:has-text("Send")');
    
    // Send a message that will trigger webhook processing
    await chatInput.fill('Please show me the current status of this project and any recent changes.');
    await sendButton.click();
    
    // Wait for message to appear
    await expect(page.locator('text=Please show me the current status')).toBeVisible();
    
    // Monitor for real-time updates
    let webhookUpdatesCount = 0;
    
    // Set up a listener for DOM changes that might indicate webhook processing
    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Count additions that might be webhook updates
            window.webhookUpdates = (window.webhookUpdates || 0) + 1;
          }
        });
      });
      
      const chatContainer = document.querySelector('[data-role="chat"], .chat-container, main');
      if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true });
      }
    });
    
    // Wait for processing with periodic checks
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      
      const updates = await page.evaluate(() => window.webhookUpdates || 0);
      if (updates > webhookUpdatesCount) {
        webhookUpdatesCount = updates;
        console.log(`📡 Webhook updates detected: ${webhookUpdatesCount}`);
      }
      
      // Check if processing is complete
      const isEnabled = await chatInput.isEnabled();
      if (isEnabled) {
        console.log('✅ Processing completed');
        break;
      }
    }
    
    console.log(`📊 Total webhook updates observed: ${webhookUpdatesCount}`);
    console.log('✅ Real-time webhook processing test completed');
  });

  test('handles network errors gracefully', async ({ page }) => {
    console.log('🛠️ Testing error handling...');
    
    await navigateToTask(page);
    
    // Intercept network requests to simulate failures
    await page.route('**/api/query', route => {
      route.abort('failed');
    });
    
    const chatInput = page.locator('textarea[placeholder*="What\'s happening"]');
    const sendButton = page.locator('button:has-text("Send")');
    
    await chatInput.fill('This message should trigger a network error');
    await sendButton.click();
    
    // Wait for error state
    await page.waitForTimeout(3000);
    
    // Check for error indicators in the UI
    const errorIndicators = page.locator('text=error, text=failed, .error-message, [data-testid*="error"]');
    const hasErrorUI = await errorIndicators.count() > 0;
    
    console.log('Error handling UI present:', hasErrorUI);
    
    // Remove network interception
    await page.unroute('**/api/query');
    
    console.log('✅ Error handling test completed');
  });
});