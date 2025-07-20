#!/usr/bin/env python3
import asyncio
import time
from playwright.async_api import async_playwright
import requests
import json

BASE_URL = "http://localhost:3001"
API_URL = "http://localhost:8000/api"

async def test_chat_flow():
    """Test complete chat flow with Playwright"""
    print("=" * 80)
    print("TESTING CHAT FLOW WITH PLAYWRIGHT")
    print("=" * 80)
    
    # First create a project and task via API
    print("\n1. Creating test project and task...")
    
    # Create project
    project_data = {
        "name": "TestProjectPW",
        "repo_url": "https://github.com/test/test"
    }
    
    response = requests.post(f"{API_URL}/projects", json=project_data)
    if response.status_code not in [200, 201]:
        print(f"Failed to create project: {response.status_code} - {response.text}")
        return
    
    project = response.json()
    project_id = project.get('id')
    print(f"Created project: {project_id}")
    
    # Create task
    task_data = {
        "name": "TestTaskPW",
        "project_id": project_id
    }
    
    response = requests.post(f"{API_URL}/tasks", json=task_data)
    if response.status_code not in [200, 201]:
        print(f"Failed to create task: {response.status_code} - {response.text}")
        return
    
    task = response.json()
    task_id = task.get('id')
    print(f"Created task: {task_id}")
    
    async with async_playwright() as p:
        # Launch browser
        print("\n2. Launching browser...")
        browser = await p.chromium.launch(headless=False)  # Set to True for headless mode
        context = await browser.new_context()
        page = await context.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"[Browser Console] {msg.text}"))
        
        try:
            # Navigate to home page
            print("\n3. Navigating to home page...")
            await page.goto(BASE_URL)
            await page.wait_for_load_state("networkidle")
            
            # Click on the project
            print(f"\n4. Clicking on project: TestProjectPW")
            await page.click(f"text=TestProjectPW")
            await page.wait_for_load_state("networkidle")
            
            # Click on the task
            print(f"\n5. Clicking on task: TestTaskPW")
            await page.click(f"text=TestTaskPW")
            await page.wait_for_load_state("networkidle")
            
            # Click on Chat tab
            print("\n6. Clicking on Chat tab...")
            await page.click("text=Chat")
            await asyncio.sleep(2)  # Wait for tab to load
            
            # Click on New Chat button
            print("\n7. Starting new chat...")
            new_chat_button = page.locator("button:has-text('New Chat')")
            await new_chat_button.click()
            await asyncio.sleep(1)
            
            # Find the chat input
            print("\n8. Finding chat input...")
            chat_input = page.locator("input[placeholder='Type your message...']")
            await chat_input.wait_for(state="visible", timeout=5000)
            
            # Type first message
            first_message = "Hello! I am testing the chat. My favorite color is blue."
            print(f"\n9. Typing first message: {first_message}")
            await chat_input.fill(first_message)
            
            # Send the message
            print("\n10. Sending first message...")
            send_button = page.locator("button:has-text('Send')")
            await send_button.click()
            
            # Wait for response
            print("\n11. Waiting for assistant response...")
            # Wait for assistant message to appear
            assistant_message = page.locator("text=assistant").first
            await assistant_message.wait_for(state="visible", timeout=10000)
            
            # Check if processing message appears
            processing_text = page.locator("text=Processing your request...")
            if await processing_text.is_visible():
                print("✓ Processing message appeared")
            
            # Wait a bit for webhooks
            await asyncio.sleep(5)
            
            # Check for any assistant response
            assistant_messages = await page.locator("[data-role='assistant']").all_text_contents()
            print(f"\n12. Assistant messages found: {len(assistant_messages)}")
            for i, msg in enumerate(assistant_messages):
                print(f"   Assistant {i+1}: {msg[:100]}...")
            
            # Send second message to test continuity
            print("\n13. Sending second message to test continuity...")
            second_message = "What is my favorite color?"
            await chat_input.fill(second_message)
            await send_button.click()
            
            # Wait for second response
            print("\n14. Waiting for second assistant response...")
            await asyncio.sleep(5)
            
            # Get all messages
            all_messages = await page.locator(".message-content").all_text_contents()
            print(f"\n15. Total messages in conversation: {len(all_messages)}")
            
            # Check if assistant remembered the context
            assistant_messages_final = await page.locator("[data-role='assistant']").all_text_contents()
            context_remembered = any("blue" in msg.lower() for msg in assistant_messages_final)
            
            if context_remembered:
                print("\n✅ SUCCESS: Assistant remembered the context (blue color)!")
            else:
                print("\n❌ FAILED: Assistant did not remember the context")
            
            # Take screenshot
            print("\n16. Taking screenshot...")
            await page.screenshot(path="chat_test_screenshot.png")
            print("Screenshot saved as chat_test_screenshot.png")
            
            # Additional debugging - check network activity
            print("\n17. Checking for API errors...")
            # Check browser console for errors
            
        except Exception as e:
            print(f"\n❌ Error during test: {str(e)}")
            await page.screenshot(path="chat_test_error.png")
            print("Error screenshot saved as chat_test_error.png")
            raise
        
        finally:
            # Keep browser open for manual inspection
            print("\n\nTest completed. Press Enter to close browser...")
            input()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_chat_flow())