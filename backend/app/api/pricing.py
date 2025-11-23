import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_session
from app.models.pricing import PricingPlan, PricingPlansResponse, PricingPlanResponse

router = APIRouter()


@router.get("/pricing/plans", response_model=PricingPlansResponse)
async def get_pricing_plans(session: AsyncSession = Depends(get_session)):
    """Get all active pricing plans"""
    try:
        statement = select(PricingPlan).where(PricingPlan.is_active == True).order_by(PricingPlan.sort_order)
        result = await session.exec(statement)
        plans = result.all()

        # Convert to response format
        plan_responses = []
        for plan in plans:
            try:
                features = json.loads(plan.features) if plan.features else []
            except json.JSONDecodeError:
                features = []

            plan_responses.append(PricingPlanResponse(
                id=str(plan.id),
                name=plan.name,
                price=plan.price,
                period=plan.period,
                description=plan.description,
                features=features,
                cta=plan.cta,
                is_popular=plan.is_popular,
                sort_order=plan.sort_order
            ))

        return PricingPlansResponse(plans=plan_responses)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching pricing plans: {str(e)}")


@router.delete("/pricing/plans/clear")
async def clear_pricing_plans(session: AsyncSession = Depends(get_session)):
    """Clear all pricing plans - for development only"""
    try:
        statement = select(PricingPlan)
        result = await session.exec(statement)
        existing_plans = result.all()

        for plan in existing_plans:
            await session.delete(plan)

        await session.commit()
        return {"message": "All pricing plans cleared", "count": len(existing_plans)}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Error clearing pricing plans: {str(e)}")


@router.post("/pricing/plans/seed")
async def seed_pricing_plans(session: AsyncSession = Depends(get_session)):
    """Seed initial pricing plans - for development only"""
    try:
        # Clear existing plans first
        statement = select(PricingPlan)
        result = await session.exec(statement)
        existing_plans = result.all()

        for plan in existing_plans:
            await session.delete(plan)

        await session.commit()

        # Create default pricing plans - 4 comprehensive tiers
        plans_data = [
            {
                "name": "Free",
                "price": "Free",
                "period": "Forever",
                "description": "Perfect for getting started with project development",
                "features": json.dumps([
                    "GitHub Integration",
                    "Basic Project Management",
                    "Community Support",
                    "Open Source Templates",
                    "1 Project"
                ]),
                "cta": "Get Started",
                "is_popular": False,
                "sort_order": 1
            },
            {
                "name": "Starter",
                "price": "$19",
                "period": "/month",
                "description": "Ideal for individual developers and small projects",
                "features": json.dumps([
                    "Everything in Free",
                    "Advanced AI Features",
                    "Priority Support",
                    "Custom Integrations",
                    "5 Projects",
                    "Cloud Deployment",
                    "24/7 Support"
                ]),
                "cta": "Start Free Trial",
                "is_popular": False,
                "sort_order": 2
            },
            {
                "name": "Pro",
                "price": "$49",
                "period": "/month",
                "description": "Perfect for growing teams and professional development",
                "features": json.dumps([
                    "Everything in Starter",
                    "Team Collaboration",
                    "Advanced Analytics",
                    "Custom Workflows",
                    "Unlimited Projects",
                    "Premium Support",
                    "White-label Options"
                ]),
                "cta": "Start Free Trial",
                "is_popular": True,
                "sort_order": 3
            },
            {
                "name": "Enterprise",
                "price": "Contact Us",
                "period": "for pricing",
                "description": "Comprehensive solution for large organizations",
                "features": json.dumps([
                    "Everything in Pro",
                    "Enterprise SSO",
                    "Advanced Security",
                    "Dedicated Support",
                    "Custom Implementation",
                    "SLA Guarantee",
                    "On-premise Deployment"
                ]),
                "cta": "Contact Sales",
                "is_popular": False,
                "sort_order": 4
            }
        ]

        for plan_data in plans_data:
            plan = PricingPlan(**plan_data)
            session.add(plan)

        await session.commit()

        return {"message": "Pricing plans seeded successfully", "count": len(plans_data)}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Error seeding pricing plans: {str(e)}")