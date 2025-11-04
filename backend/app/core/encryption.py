"""
Token encryption utilities for secure storage of GitHub OAuth tokens.
Uses Fernet symmetric encryption (AES-128-CBC).
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from functools import lru_cache


@lru_cache()
def get_encryption_key() -> bytes:
    """
    Get or generate encryption key for token storage.
    In production, this should come from environment variable or secrets manager.
    """
    # Try to get from environment
    key_str = os.getenv("ENCRYPTION_KEY")

    if key_str:
        return base64.urlsafe_b64decode(key_str.encode())

    # For development only - generate from a secret phrase
    # In production, use proper key management (AWS KMS, HashiCorp Vault, etc.)
    secret = os.getenv("SECRET_KEY", "default-secret-change-in-production")

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"github-oauth-salt",  # Fixed salt for consistency
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    return key


def encrypt_token(token: str) -> str:
    """Encrypt a token for storage."""
    fernet = Fernet(get_encryption_key())
    encrypted = fernet.encrypt(token.encode())
    return encrypted.decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token for use."""
    fernet = Fernet(get_encryption_key())
    decrypted = fernet.decrypt(encrypted_token.encode())
    return decrypted.decode()
