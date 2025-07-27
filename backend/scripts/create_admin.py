#!/usr/bin/env python3
"""
Script to create an admin user for the application.
Can be run from Docker Compose or directly.
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.deps import async_session_maker
from app.models.user import User
from app.core.security import get_password_hash

async def create_admin_user():
    """Create an admin user with username 'admin' and password 'admin'."""
    
    # Get environment variables with defaults
    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin") 
    admin_email = os.getenv("ADMIN_EMAIL", "admin@example.com")
    
    async with async_session_maker() as session:
        # Check if admin user already exists
        result = await session.execute(
            select(User).where(User.username == admin_username)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print(f"Admin user '{admin_username}' already exists")
            
            return
        
        # Create new admin user
        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            is_active=True,
            is_superuser=True
        )
        
        session.add(admin_user)
        await session.commit()
        
        print(f"Created admin user:")
        print(f"  Username: {admin_username}")
        print(f"  Password: {admin_password}")
        print(f"  Email: {admin_email}")
        print(f"  Is Superuser: True")

async def main():
    """Main function to run the script."""
    print("Creating admin user...")
    
    try:
        await create_admin_user()
        print("\nAdmin user setup completed successfully!")
    except Exception as e:
        print(f"\nError creating admin user: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())