import httpx
import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.settings import get_settings
from app.services.hostinger_service import hostinger_dns_service, HostingerDNSService
from app.models import Task

logger = logging.getLogger(__name__)


class HostingService:
    """
    Service for provisioning complete hosting setup including:
    - DNS A record via Hostinger API
    - Nginx reverse proxy configuration
    - SSL certificate via Certbot
    """

    def __init__(self):
        settings = get_settings()
        self.nginx_api_url = settings.nginx_api_url
        self.domain = settings.hostinger_domain
        self.server_ip = settings.server_ip
        self.dns_service = hostinger_dns_service

    async def provision_hosting(
        self,
        db: AsyncSession,
        task_id: UUID,
        subdomain: Optional[str] = None,
        upstream_port: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Provision complete hosting for a task.

        Steps:
        1. Generate/validate subdomain
        2. Add A record via Hostinger API
        3. Configure Nginx reverse proxy
        4. Setup SSL via Certbot

        Args:
            db: Database session
            task_id: Task UUID to provision hosting for
            subdomain: Optional custom subdomain (auto-generated if not provided)
            upstream_port: Port for nginx upstream (uses task.deployment_port if not provided)

        Returns:
            Dictionary with provisioning results
        """
        # Get task
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        # Determine subdomain
        if not subdomain:
            # Generate unique subdomain with task name prefix
            prefix = task.name[:10].lower().replace(" ", "-").replace("_", "-") if task.name else "site"
            # Clean prefix to only allow alphanumeric and hyphens
            prefix = ''.join(c for c in prefix if c.isalnum() or c == '-')
            subdomain = await self.dns_service.get_unique_subdomain(prefix=prefix)

        # Determine upstream port
        port = upstream_port or task.deployment_port
        if not port:
            raise ValueError("No deployment port available for task")

        fqdn = f"{subdomain}.{self.domain}"
        results = {
            "task_id": str(task_id),
            "subdomain": subdomain,
            "fqdn": fqdn,
            "url": f"https://{fqdn}",
            "steps": {}
        }

        try:
            # Step 1: Add DNS A record
            logger.info(f"Step 1: Adding DNS A record for {fqdn}")
            dns_result = await self.dns_service.add_a_record(subdomain)
            results["steps"]["dns"] = {
                "status": "success",
                "message": f"A record added: {fqdn} -> {self.server_ip}"
            }
            logger.info(f"DNS A record created: {dns_result}")

        except Exception as e:
            logger.error(f"Failed to add DNS record: {e}")
            results["steps"]["dns"] = {
                "status": "failed",
                "error": str(e)
            }
            results["status"] = "failed"
            results["error"] = f"DNS setup failed: {e}"
            return results

        try:
            # Step 2: Configure Nginx
            logger.info(f"Step 2: Configuring Nginx for {fqdn}")
            nginx_result = await self._configure_nginx(fqdn, port)
            results["steps"]["nginx"] = {
                "status": "success",
                "message": f"Nginx configured for {fqdn} -> localhost:{port}"
            }
            logger.info(f"Nginx configured: {nginx_result}")

        except Exception as e:
            logger.error(f"Failed to configure Nginx: {e}")
            results["steps"]["nginx"] = {
                "status": "failed",
                "error": str(e)
            }
            # Continue to SSL setup even if nginx has issues - it might already be configured
            logger.warning("Continuing despite Nginx error...")

        try:
            # Step 3: Setup SSL certificate
            logger.info(f"Step 3: Setting up SSL for {fqdn}")
            ssl_result = await self._setup_ssl(fqdn)
            results["steps"]["ssl"] = {
                "status": "success",
                "message": f"SSL certificate obtained for {fqdn}"
            }
            logger.info(f"SSL configured: {ssl_result}")

        except Exception as e:
            logger.error(f"Failed to setup SSL: {e}")
            results["steps"]["ssl"] = {
                "status": "failed",
                "error": str(e)
            }
            # SSL failure is not critical - site will work on HTTP
            logger.warning("SSL setup failed, site will be available on HTTP only")

        # Update task with hosting info
        task.hosting_subdomain = subdomain
        task.hosting_fqdn = fqdn
        task.hosting_provisioned_at = datetime.utcnow()

        # Determine overall status
        dns_ok = results["steps"]["dns"]["status"] == "success"
        nginx_ok = results["steps"].get("nginx", {}).get("status") == "success"
        ssl_ok = results["steps"].get("ssl", {}).get("status") == "success"

        if dns_ok and nginx_ok and ssl_ok:
            results["status"] = "success"
            task.hosting_status = "active"
        elif dns_ok and nginx_ok:
            results["status"] = "partial"
            results["warning"] = "SSL setup failed, site available on HTTP only"
            task.hosting_status = "active_no_ssl"
        elif dns_ok:
            results["status"] = "partial"
            results["warning"] = "Nginx and/or SSL setup failed"
            task.hosting_status = "dns_only"
        else:
            results["status"] = "failed"
            task.hosting_status = "failed"

        await db.commit()

        return results

    async def _configure_nginx(self, fqdn: str, upstream_port: int) -> Dict[str, Any]:
        """
        Configure Nginx reverse proxy for the domain.

        Args:
            fqdn: Fully qualified domain name
            upstream_port: Port to proxy to

        Returns:
            API response
        """
        # Remove protocol if present
        host_clean = fqdn.replace("https://", "").replace("http://", "").strip()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.nginx_api_url}/create-config",
                json={"port": upstream_port, "host_name": host_clean},
                timeout=60.0
            )
            response.raise_for_status()
            return response.json()

    async def _setup_ssl(self, fqdn: str, email: str = "admin@example.com") -> Dict[str, Any]:
        """
        Setup SSL certificate using the nginx API.

        Args:
            fqdn: Fully qualified domain name
            email: Email for Let's Encrypt certificate notifications

        Returns:
            API response
        """
        # Remove protocol if present
        host_clean = fqdn.replace("https://", "").replace("http://", "").strip()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.nginx_api_url}/add-ssl",
                json={"host_name": host_clean, "email": email},
                timeout=120.0  # SSL setup can take time
            )
            response.raise_for_status()
            return response.json()

    async def remove_hosting(
        self,
        db: AsyncSession,
        task_id: UUID
    ) -> Dict[str, Any]:
        """
        Remove hosting for a task.

        Steps:
        1. Remove Nginx configuration
        2. Remove DNS A record

        Args:
            db: Database session
            task_id: Task UUID

        Returns:
            Removal results
        """
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        if not task.hosting_subdomain:
            raise ValueError("Task does not have hosting configured")

        subdomain = task.hosting_subdomain
        fqdn = task.hosting_fqdn or f"{subdomain}.{self.domain}"

        results = {
            "task_id": str(task_id),
            "subdomain": subdomain,
            "fqdn": fqdn,
            "steps": {}
        }

        # Step 1: Remove Nginx config
        try:
            logger.info(f"Removing Nginx config for {fqdn}")
            await self._remove_nginx(fqdn)
            results["steps"]["nginx"] = {"status": "success"}
        except Exception as e:
            logger.error(f"Failed to remove Nginx config: {e}")
            results["steps"]["nginx"] = {"status": "failed", "error": str(e)}

        # Step 2: Remove DNS record
        try:
            logger.info(f"Removing DNS record for {subdomain}")
            await self.dns_service.delete_a_record(subdomain)
            results["steps"]["dns"] = {"status": "success"}
        except Exception as e:
            logger.error(f"Failed to remove DNS record: {e}")
            results["steps"]["dns"] = {"status": "failed", "error": str(e)}

        # Update task
        task.hosting_subdomain = None
        task.hosting_fqdn = None
        task.hosting_status = "removed"
        task.hosting_removed_at = datetime.utcnow()

        await db.commit()

        results["status"] = "success" if all(
            s.get("status") == "success" for s in results["steps"].values()
        ) else "partial"

        return results

    async def _remove_nginx(self, fqdn: str) -> Dict[str, Any]:
        """
        Remove Nginx configuration for a domain.

        Args:
            fqdn: Fully qualified domain name

        Returns:
            API response
        """
        url = f"{self.nginx_api_url}/remove"

        payload = {"domain": fqdn}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def get_hosting_status(
        self,
        db: AsyncSession,
        task_id: UUID
    ) -> Dict[str, Any]:
        """
        Get hosting status for a task.

        Args:
            db: Database session
            task_id: Task UUID

        Returns:
            Hosting status information
        """
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        if not task.hosting_subdomain:
            return {
                "task_id": str(task_id),
                "status": "not_provisioned",
                "message": "Hosting not provisioned for this task"
            }

        return {
            "task_id": str(task_id),
            "subdomain": task.hosting_subdomain,
            "fqdn": task.hosting_fqdn,
            "url": f"https://{task.hosting_fqdn}" if task.hosting_fqdn else None,
            "status": task.hosting_status or "unknown",
            "provisioned_at": task.hosting_provisioned_at.isoformat() if task.hosting_provisioned_at else None,
            "deployment_port": task.deployment_port
        }

    async def provision_simple(
        self,
        subdomain: str,
        upstream_port: int,
        ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Provision hosting without a task (simple API).

        Args:
            subdomain: Subdomain name
            upstream_port: Port to proxy to
            ip: Optional IP address (defaults to configured server_ip)

        Returns:
            Provisioning results
        """
        fqdn = f"{subdomain}.{self.domain}"
        target_ip = ip or self.server_ip

        results = {
            "subdomain": subdomain,
            "fqdn": fqdn,
            "url": f"https://{fqdn}",
            "upstream_port": upstream_port,
            "ip": target_ip,
            "steps": {}
        }

        # Step 1: Add DNS
        try:
            await self.dns_service.add_a_record(subdomain, ip=target_ip)
            results["steps"]["dns"] = {"status": "success"}
        except Exception as e:
            results["steps"]["dns"] = {"status": "failed", "error": str(e)}
            results["status"] = "failed"
            return results

        # Step 2: Configure Nginx
        try:
            await self._configure_nginx(fqdn, upstream_port)
            results["steps"]["nginx"] = {"status": "success"}
        except Exception as e:
            results["steps"]["nginx"] = {"status": "failed", "error": str(e)}

        # Step 3: Setup SSL
        try:
            await self._setup_ssl(fqdn)
            results["steps"]["ssl"] = {"status": "success"}
        except Exception as e:
            results["steps"]["ssl"] = {"status": "failed", "error": str(e)}

        # Determine status
        all_success = all(s.get("status") == "success" for s in results["steps"].values())
        results["status"] = "success" if all_success else "partial"

        return results

    async def retry_step(
        self,
        db: AsyncSession,
        task_id: UUID,
        step: str
    ) -> Dict[str, Any]:
        """
        Retry a specific failed step for a task's hosting setup.

        Args:
            db: Database session
            task_id: Task UUID
            step: Step to retry ('dns', 'nginx', or 'ssl')

        Returns:
            Result of the retry operation
        """
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        if not task.hosting_subdomain or not task.hosting_fqdn:
            raise ValueError("Hosting not provisioned for this task. Use provision_hosting first.")

        fqdn = task.hosting_fqdn
        subdomain = task.hosting_subdomain
        port = task.deployment_port

        if not port:
            raise ValueError("No deployment port available for task")

        result = {
            "task_id": str(task_id),
            "step": step,
            "fqdn": fqdn
        }

        try:
            if step == "dns":
                await self.dns_service.add_a_record(subdomain, ip=self.server_ip)
                result["status"] = "success"
                result["message"] = f"DNS A record added: {fqdn} -> {self.server_ip}"

            elif step == "nginx":
                await self._configure_nginx(fqdn, port)
                result["status"] = "success"
                result["message"] = f"Nginx configured for {fqdn} -> localhost:{port}"

            elif step == "ssl":
                await self._setup_ssl(fqdn)
                result["status"] = "success"
                result["message"] = f"SSL certificate obtained for {fqdn}"

            else:
                raise ValueError(f"Invalid step: {step}. Must be 'dns', 'nginx', or 'ssl'")

            # Update task hosting status based on result
            await self._update_hosting_status(db, task)

        except Exception as e:
            logger.error(f"Failed to retry step {step} for {fqdn}: {e}")
            result["status"] = "failed"
            result["error"] = str(e)

        return result

    async def _update_hosting_status(self, db: AsyncSession, task: Task) -> None:
        """Update task hosting status based on current state."""
        # For now, just mark as active since a retry succeeded
        if task.hosting_status in ("failed", "dns_only", "active_no_ssl"):
            task.hosting_status = "active"
            await db.commit()

    async def retry_all_failed(
        self,
        db: AsyncSession,
        task_id: UUID
    ) -> Dict[str, Any]:
        """
        Retry all steps for a task's hosting setup (useful for regenerating).

        Args:
            db: Database session
            task_id: Task UUID

        Returns:
            Results of all retry operations
        """
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        if not task.hosting_subdomain or not task.hosting_fqdn:
            raise ValueError("Hosting not provisioned for this task. Use provision_hosting first.")

        fqdn = task.hosting_fqdn
        subdomain = task.hosting_subdomain
        port = task.deployment_port

        if not port:
            raise ValueError("No deployment port available for task")

        results = {
            "task_id": str(task_id),
            "subdomain": subdomain,
            "fqdn": fqdn,
            "steps": {}
        }

        # Step 1: Retry DNS
        try:
            await self.dns_service.add_a_record(subdomain, ip=self.server_ip)
            results["steps"]["dns"] = {"status": "success", "message": f"DNS A record added: {fqdn} -> {self.server_ip}"}
        except Exception as e:
            results["steps"]["dns"] = {"status": "failed", "error": str(e)}

        # Step 2: Retry Nginx
        try:
            await self._configure_nginx(fqdn, port)
            results["steps"]["nginx"] = {"status": "success", "message": f"Nginx configured for {fqdn} -> localhost:{port}"}
        except Exception as e:
            results["steps"]["nginx"] = {"status": "failed", "error": str(e)}

        # Step 3: Retry SSL
        try:
            await self._setup_ssl(fqdn)
            results["steps"]["ssl"] = {"status": "success", "message": f"SSL certificate obtained for {fqdn}"}
        except Exception as e:
            results["steps"]["ssl"] = {"status": "failed", "error": str(e)}

        # Determine overall status
        dns_ok = results["steps"]["dns"]["status"] == "success"
        nginx_ok = results["steps"]["nginx"]["status"] == "success"
        ssl_ok = results["steps"]["ssl"]["status"] == "success"

        if dns_ok and nginx_ok and ssl_ok:
            results["status"] = "success"
            task.hosting_status = "active"
        elif dns_ok and nginx_ok:
            results["status"] = "partial"
            results["warning"] = "SSL setup failed, site available on HTTP only"
            task.hosting_status = "active_no_ssl"
        elif dns_ok:
            results["status"] = "partial"
            results["warning"] = "Nginx and/or SSL setup failed"
            task.hosting_status = "dns_only"
        else:
            results["status"] = "failed"
            task.hosting_status = "failed"

        await db.commit()

        return results


# Singleton instance
hosting_service = HostingService()
