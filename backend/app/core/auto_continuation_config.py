"""
Auto-Continuation Configuration Module

This module provides configuration and controls for disabling or modifying
auto-continuation behavior in the cc wrapper.
"""

import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class AutoContinuationConfig:
    """Configuration manager for auto-continuation features"""
    
    def __init__(self):
        # Environment variable to completely disable auto-continuation
        self.global_enabled = os.environ.get('AUTO_CONTINUATION_ENABLED', 'true').lower() == 'true'
        
        # Default auto-continuation setting for new chats
        self.default_enabled = os.environ.get('AUTO_CONTINUATION_DEFAULT', 'false').lower() == 'true'
        
        # Maximum number of auto-continuations per session
        self.max_continuations = int(os.environ.get('AUTO_CONTINUATION_MAX', '3'))
        
        # Minimum delay between auto-continuations (seconds)
        self.min_delay = int(os.environ.get('AUTO_CONTINUATION_DELAY', '2'))
        
        # Whether to require explicit user opt-in
        self.require_opt_in = os.environ.get('AUTO_CONTINUATION_REQUIRE_OPT_IN', 'true').lower() == 'true'
        
    def is_enabled_globally(self) -> bool:
        """Check if auto-continuation is enabled globally"""
        return self.global_enabled
    
    def get_default_setting(self) -> bool:
        """Get the default auto-continuation setting for new chats"""
        if not self.global_enabled:
            return False
        return self.default_enabled
    
    def should_auto_continue(
        self, 
        session_enabled: Optional[bool] = None,
        continuation_count: int = 0,
        user_opted_in: bool = False
    ) -> bool:
        """
        Determine if auto-continuation should trigger
        
        Args:
            session_enabled: Per-session setting (None = use default)
            continuation_count: Current number of continuations in this session
            user_opted_in: Whether user has explicitly opted in
            
        Returns:
            bool: Whether auto-continuation should proceed
        """
        # Global kill switch
        if not self.global_enabled:
            logger.info("🚫 Auto-continuation disabled globally")
            return False
        
        # Require opt-in check
        if self.require_opt_in and not user_opted_in:
            logger.info("🚫 Auto-continuation requires user opt-in")
            return False
        
        # Check continuation limit
        if continuation_count >= self.max_continuations:
            logger.info(f"🚫 Auto-continuation limit reached: {continuation_count}/{self.max_continuations}")
            return False
        
        # Check session-specific setting
        enabled = session_enabled if session_enabled is not None else self.default_enabled
        if not enabled:
            logger.info("🚫 Auto-continuation disabled for this session")
            return False
        
        logger.info("✅ Auto-continuation allowed")
        return True
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration"""
        return {
            "global_enabled": self.global_enabled,
            "default_enabled": self.default_enabled,
            "max_continuations": self.max_continuations,
            "min_delay": self.min_delay,
            "require_opt_in": self.require_opt_in,
            "effective_default": self.get_default_setting()
        }

# Global instance
auto_continuation_config = AutoContinuationConfig()

def disable_auto_continuation_globally():
    """Disable auto-continuation globally (runtime override)"""
    auto_continuation_config.global_enabled = False
    logger.warning("🚫 Auto-continuation disabled globally via runtime override")

def enable_auto_continuation_globally():
    """Enable auto-continuation globally (runtime override)"""
    auto_continuation_config.global_enabled = True
    logger.info("✅ Auto-continuation enabled globally via runtime override")

def get_auto_continuation_config() -> AutoContinuationConfig:
    """Get the global auto-continuation configuration"""
    return auto_continuation_config