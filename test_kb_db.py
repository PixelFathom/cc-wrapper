import asyncio
import aiohttp
import io

async def test_upload():
    # Create test file content
    test_content = b"This is a test file for knowledge base upload"
    
    # Prepare form data
    form_data = aiohttp.FormData()
    form_data.add_field('file', 
                       test_content, 
                       filename='test_upload.txt',
                       content_type='text/plain')
    
    # Upload file
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'http://localhost:8000/api/tasks/c7fc06da-9bd9-4cbd-b011-2a2ec2732650/knowledge-base/upload',
            data=form_data
        ) as response:
            print(f"Upload status: {response.status}")
            result = await response.json()
            print(f"Upload result: {result}")
            
        # List files to verify
        async with session.get(
            'http://localhost:8000/api/tasks/c7fc06da-9bd9-4cbd-b011-2a2ec2732650/knowledge-base/files'
        ) as response:
            print(f"\nList status: {response.status}")
            result = await response.json()
            print(f"Files: {result}")
            
        # Check the external API directly
        print("\nChecking external API directly...")
        try:
            async with session.post(
                'http://localhost:8001/api/knowledge-base/upload',
                data=form_data
            ) as response:
                print(f"External API status: {response.status}")
                if response.status == 200:
                    result = await response.json()
                    print(f"External API result: {result}")
                else:
                    text = await response.text()
                    print(f"External API error: {text}")
        except Exception as e:
            print(f"External API error: {e}")

if __name__ == "__main__":
    asyncio.run(test_upload())