from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import logging

from app.deps import get_session, get_current_user, get_admin_user
from app.services.hosting_service import hosting_service
from app.services.hostinger_service import hostinger_dns_service
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hosting", tags=["hosting"])


# Request/Response Models
class ProvisionHostingRequest(BaseModel):
    """Request to provision hosting for a task"""
    task_id: UUID
    subdomain: Optional[str] = Field(None, description="Custom subdomain (auto-generated if not provided)")
    upstream_port: Optional[int] = Field(None, description="Port for reverse proxy (uses task deployment_port if not provided)")


class SimpleProvisionRequest(BaseModel):
    """Request to provision hosting without a task"""
    subdomain: str = Field(..., description="Subdomain name")
    upstream_port: int = Field(..., description="Port to proxy to")
    ip: Optional[str] = Field(None, description="Target IP address (uses default if not provided)")


class AddDNSRecordRequest(BaseModel):
    """Request to add a DNS A record"""
    subdomain: str = Field(..., description="Subdomain name")
    ip: Optional[str] = Field(None, description="Target IP address (uses default if not provided)")
    ttl: Optional[int] = Field(300, description="TTL in seconds")


class RemoveHostingRequest(BaseModel):
    """Request to remove hosting for a task"""
    task_id: UUID


class HostingResponse(BaseModel):
    """Generic hosting response"""
    success: bool
    message: str
    data: Optional[dict] = None


# Endpoints
@router.post("/provision", response_model=dict)
async def provision_hosting(
    request: ProvisionHostingRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Provision complete hosting for a task.

    This will:
    1. Create a DNS A record via Hostinger API
    2. Configure Nginx reverse proxy
    3. Setup SSL certificate via Certbot

    The subdomain will be auto-generated based on task name if not provided.
    """
    try:
        result = await hosting_service.provision_hosting(
            db=db,
            task_id=request.task_id,
            subdomain=request.subdomain,
            upstream_port=request.upstream_port
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to provision hosting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision hosting: {str(e)}"
        )


@router.post("/provision/simple", response_model=dict)
async def provision_hosting_simple(
    request: SimpleProvisionRequest,
    current_user: User = Depends(get_admin_user)
):
    """
    Provision hosting without a task (simple API). Admin only.

    This will:
    1. Create a DNS A record
    2. Configure Nginx reverse proxy
    3. Setup SSL certificate

    Useful for quick deployments without task tracking.
    """
    try:
        result = await hosting_service.provision_simple(
            subdomain=request.subdomain,
            upstream_port=request.upstream_port,
            ip=request.ip
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to provision hosting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision hosting: {str(e)}"
        )


@router.get("/status/{task_id}", response_model=dict)
async def get_hosting_status(
    task_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get hosting status for a task.
    """
    try:
        result = await hosting_service.get_hosting_status(db=db, task_id=task_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get hosting status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hosting status: {str(e)}"
        )


@router.delete("/{task_id}", response_model=dict)
async def remove_hosting(
    task_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Remove hosting for a task.

    This will:
    1. Remove Nginx configuration
    2. Remove DNS A record
    """
    try:
        result = await hosting_service.remove_hosting(db=db, task_id=task_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to remove hosting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove hosting: {str(e)}"
        )


# DNS-specific endpoints (Admin only)
@router.get("/dns/records", response_model=dict)
async def get_dns_records(
    current_user: User = Depends(get_admin_user)
):
    """
    Get all DNS records for the configured domain. Admin only.
    """
    try:
        records = await hostinger_dns_service.get_dns_records()
        return {"success": True, "records": records}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get DNS records: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get DNS records: {str(e)}"
        )


@router.post("/dns/add", response_model=dict)
async def add_dns_record(
    request: AddDNSRecordRequest,
    current_user: User = Depends(get_admin_user)
):
    """
    Add a DNS A record for a subdomain. Admin only.

    This only adds the DNS record without configuring Nginx or SSL.
    """
    try:
        result = await hostinger_dns_service.add_a_record(
            subdomain=request.subdomain,
            ip=request.ip,
            ttl=request.ttl
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to add DNS record: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add DNS record: {str(e)}"
        )


@router.delete("/dns/{subdomain}", response_model=dict)
async def delete_dns_record(
    subdomain: str,
    current_user: User = Depends(get_admin_user)
):
    """
    Delete a DNS A record for a subdomain. Admin only.
    """
    try:
        result = await hostinger_dns_service.delete_a_record(subdomain)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete DNS record: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete DNS record: {str(e)}"
        )


@router.post("/dns/validate", response_model=dict)
async def validate_dns_records(
    records: list,
    current_user: User = Depends(get_admin_user)
):
    """
    Validate DNS records before applying them. Admin only.
    """
    try:
        result = await hostinger_dns_service.validate_records(records)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to validate DNS records: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate DNS records: {str(e)}"
        )


@router.get("/dns/check/{subdomain}", response_model=dict)
async def check_subdomain_exists(
    subdomain: str,
    current_user: User = Depends(get_admin_user)
):
    """
    Check if a subdomain already has an A record. Admin only.
    """
    try:
        exists = await hostinger_dns_service.check_subdomain_exists(subdomain)
        domain = hostinger_dns_service.domain
        return {
            "subdomain": subdomain,
            "fqdn": f"{subdomain}.{domain}",
            "exists": exists
        }
    except Exception as e:
        logger.error(f"Failed to check subdomain: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check subdomain: {str(e)}"
        )


@router.get("/dns/generate-subdomain", response_model=dict)
async def generate_unique_subdomain(
    prefix: str = "tedious",
    current_user: User = Depends(get_admin_user)
):
    """
    Generate a unique subdomain that doesn't exist. Admin only.
    """
    try:
        subdomain = await hostinger_dns_service.get_unique_subdomain(prefix=prefix)
        domain = hostinger_dns_service.domain
        return {
            "subdomain": subdomain,
            "fqdn": f"{subdomain}.{domain}"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate subdomain: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate subdomain: {str(e)}"
        )


# Retry endpoints
class RetryStepRequest(BaseModel):
    """Request to retry a specific hosting step"""
    step: str = Field(..., description="Step to retry: 'dns', 'nginx', or 'ssl'")


@router.post("/{task_id}/retry-step", response_model=dict)
async def retry_hosting_step(
    task_id: UUID,
    request: RetryStepRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Retry a specific failed step for a task's hosting setup.

    Use this when DNS, Nginx, or SSL setup failed and you want to retry just that step.
    Valid steps: 'dns', 'nginx', 'ssl'
    """
    try:
        result = await hosting_service.retry_step(
            db=db,
            task_id=task_id,
            step=request.step
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to retry step: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry step: {str(e)}"
        )


@router.post("/{task_id}/retry-all", response_model=dict)
async def retry_all_hosting_steps(
    task_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Retry all hosting steps (DNS, Nginx, SSL) for a task.

    Use this to regenerate all hosting configuration when multiple steps failed.
    """
    try:
        result = await hosting_service.retry_all_failed(
            db=db,
            task_id=task_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to retry hosting steps: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry hosting steps: {str(e)}"
        )
