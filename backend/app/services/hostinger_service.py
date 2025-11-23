import httpx
import logging
import random
import string
from typing import Optional, Dict, Any, List
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class HostingerDNSService:
    """Service for managing DNS records via Hostinger API"""

    def __init__(self):
        settings = get_settings()
        self.api_token = settings.hostinger_api_token
        self.domain = settings.hostinger_domain
        self.base_url = settings.hostinger_api_base_url
        self.server_ip = settings.server_ip
        self.default_ttl = settings.default_dns_ttl

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Hostinger API requests"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def get_dns_records(self) -> Optional[Dict[str, Any]]:
        """
        Retrieve all DNS records for the configured domain.

        Returns:
            Dictionary containing DNS records or None on error
        """
        if not self.api_token or not self.domain:
            logger.error("Hostinger API token or domain not configured")
            return None

        url = f"{self.base_url}/api/dns/v1/zones/{self.domain}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting DNS records: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.HTTPError as e:
            logger.error(f"Error getting DNS records: {e}")
            raise

    async def add_a_record(
        self,
        subdomain: str,
        ip: Optional[str] = None,
        ttl: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Add an A record for a subdomain.

        Args:
            subdomain: The subdomain name (e.g., 'app' for app.example.com)
            ip: Target IP address (defaults to configured server_ip)
            ttl: Time to live in seconds (defaults to configured default_ttl)

        Returns:
            API response dictionary
        """
        if not self.api_token or not self.domain:
            raise ValueError("Hostinger API token or domain not configured")

        target_ip = ip or self.server_ip
        record_ttl = ttl or self.default_ttl

        url = f"{self.base_url}/api/dns/v1/zones/{self.domain}"

        payload = {
            "zone": [
                {
                    "name": subdomain,
                    "type": "A",
                    "ttl": record_ttl,
                    "records": [
                        {"content": target_ip}
                    ]
                }
            ],
            "overwrite": False  # Don't replace existing records
        }

        logger.info(f"Adding A record: {subdomain}.{self.domain} -> {target_ip} (TTL: {record_ttl})")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()

                result = response.json()
                logger.info(f"Successfully added A record for {subdomain}.{self.domain}")
                return {
                    "success": True,
                    "subdomain": subdomain,
                    "fqdn": f"{subdomain}.{self.domain}",
                    "ip": target_ip,
                    "ttl": record_ttl,
                    "response": result
                }
        except httpx.HTTPStatusError as e:
            # 422 means record already exists - treat as success
            if e.response.status_code == 422:
                logger.info(f"A record already exists for {subdomain}.{self.domain} (422 response)")
                return {
                    "success": True,
                    "subdomain": subdomain,
                    "fqdn": f"{subdomain}.{self.domain}",
                    "ip": target_ip,
                    "ttl": record_ttl,
                    "already_exists": True,
                    "message": "DNS record already exists"
                }
            logger.error(f"HTTP error adding A record: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.HTTPError as e:
            logger.error(f"Error adding A record: {e}")
            raise

    async def delete_a_record(self, subdomain: str) -> Dict[str, Any]:
        """
        Delete an A record for a subdomain.

        Args:
            subdomain: The subdomain name to delete

        Returns:
            API response dictionary
        """
        if not self.api_token or not self.domain:
            raise ValueError("Hostinger API token or domain not configured")

        url = f"{self.base_url}/api/dns/v1/zones/{self.domain}"

        payload = {
            "filters": [
                {
                    "name": subdomain,
                    "type": "A"
                }
            ]
        }

        logger.info(f"Deleting A record: {subdomain}.{self.domain}")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    "DELETE",
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()

                logger.info(f"Successfully deleted A record for {subdomain}.{self.domain}")
                return {
                    "success": True,
                    "subdomain": subdomain,
                    "fqdn": f"{subdomain}.{self.domain}"
                }
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error deleting A record: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.HTTPError as e:
            logger.error(f"Error deleting A record: {e}")
            raise

    async def validate_records(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate DNS records before applying them.

        Args:
            records: List of record dictionaries to validate

        Returns:
            Validation result
        """
        if not self.api_token or not self.domain:
            raise ValueError("Hostinger API token or domain not configured")

        url = f"{self.base_url}/api/dns/v1/zones/{self.domain}/validate"

        payload = {"zone": records}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )

                if response.status_code == 200:
                    return {"valid": True, "response": response.json()}
                elif response.status_code == 422:
                    return {"valid": False, "errors": response.json()}
                else:
                    response.raise_for_status()

        except httpx.HTTPError as e:
            logger.error(f"Error validating DNS records: {e}")
            raise

    @staticmethod
    def generate_random_subdomain(length: int = 8, prefix: str = "") -> str:
        """
        Generate a random subdomain name.

        Args:
            length: Length of the random part
            prefix: Optional prefix for the subdomain

        Returns:
            Random subdomain string
        """
        chars = string.ascii_lowercase + string.digits
        random_part = ''.join(random.choices(chars, k=length))

        if prefix:
            return f"{prefix}-{random_part}"
        return random_part

    async def check_subdomain_exists(self, subdomain: str) -> bool:
        """
        Check if a subdomain already has an A record.

        Args:
            subdomain: The subdomain to check

        Returns:
            True if exists, False otherwise
        """
        try:
            records = await self.get_dns_records()
            if not records:
                return False

            # Check if any A record matches the subdomain
            for record in records.get("records", []):
                if record.get("type") == "A" and record.get("name") == subdomain:
                    return True
            return False
        except Exception as e:
            logger.warning(f"Error checking subdomain existence: {e}")
            return False

    async def get_unique_subdomain(self, prefix: str = "site", max_attempts: int = 10) -> str:
        """
        Generate a unique subdomain that doesn't exist.

        Args:
            prefix: Prefix for the subdomain
            max_attempts: Maximum attempts to find unique subdomain

        Returns:
            Unique subdomain string

        Raises:
            ValueError: If unable to generate unique subdomain
        """
        for _ in range(max_attempts):
            subdomain = self.generate_random_subdomain(prefix=prefix)
            if not await self.check_subdomain_exists(subdomain):
                return subdomain

        raise ValueError(f"Unable to generate unique subdomain after {max_attempts} attempts")


# Singleton instance
hostinger_dns_service = HostingerDNSService()
