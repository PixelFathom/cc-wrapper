#!/usr/bin/env python3
"""
Script to add credits (coins) to a user account.
Can identify user by email, github_login, or user_id.

Usage:
    python scripts/add_credits.py --email user@example.com --credits 10
    python scripts/add_credits.py --github-login username --credits 50
    python scripts/add_credits.py --user-id 123e4567-e89b-12d3-a456-426614174000 --credits 25
    python scripts/add_credits.py --email user@example.com --credits 10 --reason "Promotional credits"
    python scripts/add_credits.py --email user@example.com --credits 10 --expires-in-days 30
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.deps import async_session_maker
from app.models.user import User
from app.models.coin_transaction import CoinTransaction, TransactionType


async def find_user(session, email: str = None, github_login: str = None, user_id: str = None) -> User:
    """Find user by email, github_login, or user_id."""
    query = select(User)

    if email:
        query = query.where(User.email == email)
    elif github_login:
        query = query.where(User.github_login == github_login)
    elif user_id:
        query = query.where(User.id == UUID(user_id))
    else:
        raise ValueError("Must provide email, github_login, or user_id")

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def add_credits(
    email: str = None,
    github_login: str = None,
    user_id: str = None,
    credits: int = 0,
    reason: str = "Admin credit adjustment",
    expires_in_days: int = None
):
    """Add credits to a user account."""

    async with async_session_maker() as session:
        # Find the user
        user = await find_user(session, email, github_login, user_id)

        if not user:
            identifier = email or github_login or user_id
            print(f"Error: User not found with identifier: {identifier}")
            return False

        # Store old balance for logging
        old_balance = user.coins_balance

        # Calculate expiration if specified
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        # Update user balance
        user.coins_balance += credits
        user.coins_total_allocated += credits

        # Create transaction record
        transaction = CoinTransaction(
            user_id=user.id,
            amount=credits,
            transaction_type=TransactionType.ADJUSTMENT,
            description=reason,
            balance_after=user.coins_balance,
            expires_at=expires_at,
            expired=False,
            meta_data={
                "added_by": "admin_script",
                "added_at": datetime.utcnow().isoformat()
            }
        )

        session.add(user)
        session.add(transaction)
        await session.commit()

        # Print results
        print("\n" + "=" * 50)
        print("Credits Added Successfully!")
        print("=" * 50)
        print(f"User:           {user.github_login} ({user.email or 'no email'})")
        print(f"User ID:        {user.id}")
        print(f"Credits Added:  {credits}")
        print(f"Old Balance:    {old_balance}")
        print(f"New Balance:    {user.coins_balance}")
        print(f"Reason:         {reason}")
        if expires_at:
            print(f"Expires At:     {expires_at.isoformat()}")
        print(f"Transaction ID: {transaction.id}")
        print("=" * 50 + "\n")

        return True


async def list_users(limit: int = 20):
    """List recent users for reference."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(User)
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        users = result.scalars().all()

        if not users:
            print("No users found in database.")
            return

        print("\n" + "=" * 80)
        print("Recent Users")
        print("=" * 80)
        print(f"{'GitHub Login':<20} {'Email':<30} {'Balance':<10} {'ID'}")
        print("-" * 80)

        for user in users:
            email = user.email or "N/A"
            if len(email) > 28:
                email = email[:25] + "..."
            print(f"{user.github_login:<20} {email:<30} {user.coins_balance:<10} {str(user.id)[:8]}...")

        print("=" * 80 + "\n")


async def main():
    """Main function to run the script."""
    parser = argparse.ArgumentParser(
        description="Add credits to a user account",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/add_credits.py --email user@example.com --credits 10
    python scripts/add_credits.py --github-login johndoe --credits 50
    python scripts/add_credits.py --user-id 123e4567-e89b-12d3-a456-426614174000 --credits 25
    python scripts/add_credits.py --email user@example.com --credits 10 --reason "Promotional credits"
    python scripts/add_credits.py --email user@example.com --credits 10 --expires-in-days 30
    python scripts/add_credits.py --list-users
        """
    )

    # User identification (mutually exclusive)
    id_group = parser.add_mutually_exclusive_group()
    id_group.add_argument("--email", "-e", help="User's email address")
    id_group.add_argument("--github-login", "-g", help="User's GitHub login/username")
    id_group.add_argument("--user-id", "-u", help="User's UUID")
    id_group.add_argument("--list-users", "-l", action="store_true", help="List recent users")

    # Credit options
    parser.add_argument("--credits", "-c", type=int, help="Number of credits to add")
    parser.add_argument("--reason", "-r", default="Admin credit adjustment",
                       help="Reason for adding credits (default: 'Admin credit adjustment')")
    parser.add_argument("--expires-in-days", "-x", type=int,
                       help="Number of days until credits expire (optional)")

    args = parser.parse_args()

    # List users mode
    if args.list_users:
        await list_users()
        return

    # Validation
    if not (args.email or args.github_login or args.user_id):
        parser.error("Must provide --email, --github-login, --user-id, or --list-users")

    if not args.credits:
        parser.error("Must provide --credits amount")

    if args.credits <= 0:
        parser.error("Credits must be a positive number")

    try:
        success = await add_credits(
            email=args.email,
            github_login=args.github_login,
            user_id=args.user_id,
            credits=args.credits,
            reason=args.reason,
            expires_in_days=args.expires_in_days
        )

        if not success:
            sys.exit(1)

    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
