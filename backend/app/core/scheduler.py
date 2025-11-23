"""
APScheduler configuration for background jobs.
Handles periodic tasks like credit expiration.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession
import logging

from app.core.settings import get_settings
from app.services.credit_expiration_service import CreditExpirationService

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()


async def expire_credits_job():
    """
    Daily job to expire old credits.
    Runs every day at 2 AM UTC.
    """
    logger.info("🕐 Starting credit expiration job")

    settings = get_settings()

    # Create async engine and session
    engine = create_async_engine(
        settings.get_database_url(),
        echo=False,
        future=True
    )

    async_session_maker = sessionmaker(
        engine,
        class_=SQLModelAsyncSession,
        expire_on_commit=False
    )

    try:
        async with async_session_maker() as session:
            result = await CreditExpirationService.expire_old_credits(session)

            logger.info(
                f"✅ Credit expiration job completed | "
                f"expired={result['total_expired']} | "
                f"amount={result['total_amount']} | "
                f"users={result['users_affected']}"
            )
    except Exception as e:
        logger.error(f"❌ Credit expiration job failed: {str(e)}", exc_info=True)
    finally:
        await engine.dispose()


def start_scheduler():
    """
    Start the APScheduler with all configured jobs.
    """
    # Add credit expiration job - runs daily at 2 AM UTC
    scheduler.add_job(
        expire_credits_job,
        trigger=CronTrigger(hour=2, minute=0, timezone='UTC'),
        id="expire_credits_daily",
        name="Expire old credits (daily at 2 AM UTC)",
        replace_existing=True,
        max_instances=1  # Prevent concurrent executions
    )

    # Optional: For development/testing - run every 5 minutes
    # Uncomment to test the job more frequently
    # scheduler.add_job(
    #     expire_credits_job,
    #     trigger=IntervalTrigger(minutes=5),
    #     id="expire_credits_test",
    #     name="Expire old credits (test - every 5 min)",
    #     replace_existing=True,
    #     max_instances=1
    # )

    scheduler.start()
    logger.info("✅ Scheduler started with credit expiration job")


def shutdown_scheduler():
    """
    Gracefully shutdown the scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("🛑 Scheduler shut down")
