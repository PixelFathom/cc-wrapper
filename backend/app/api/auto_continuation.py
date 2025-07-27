"""
Auto-Continuation Management API

This module provides endpoints for managing auto-continuation settings
and disabling/enabling the feature at runtime.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.auto_continuation_config import (
    get_auto_continuation_config,
    disable_auto_continuation_globally,
    enable_auto_continuation_globally
)

logger = logging.getLogger(__name__)
router = APIRouter()

class AutoContinuationToggleRequest(BaseModel):
    enabled: bool

class AutoContinuationConfigResponse(BaseModel):
    global_enabled: bool
    default_enabled: bool
    max_continuations: int
    min_delay: int
    require_opt_in: bool
    effective_default: bool

@router.get("/auto-continuation/config", response_model=AutoContinuationConfigResponse)
async def get_auto_continuation_config_endpoint():
    """Get current auto-continuation configuration"""
    try:
        config = get_auto_continuation_config()
        return AutoContinuationConfigResponse(**config.get_config_summary())
    except Exception as e:
        logger.error(f"Failed to get auto-continuation config: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get configuration: {str(e)}"
        )

@router.post("/auto-continuation/toggle")
async def toggle_auto_continuation_global(request: AutoContinuationToggleRequest):
    """Toggle auto-continuation globally"""
    try:
        if request.enabled:
            enable_auto_continuation_globally()
            message = "Auto-continuation enabled globally"
        else:
            disable_auto_continuation_globally()
            message = "Auto-continuation disabled globally"
        
        config = get_auto_continuation_config()
        
        logger.info(f"🔄 {message} | new_state={config.global_enabled}")
        
        return {
            "message": message,
            "global_enabled": config.global_enabled,
            "config": config.get_config_summary()
        }
    except Exception as e:
        logger.error(f"Failed to toggle auto-continuation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle auto-continuation: {str(e)}"
        )

@router.post("/auto-continuation/disable")
async def disable_auto_continuation():
    """Completely disable auto-continuation"""
    try:
        disable_auto_continuation_globally()
        config = get_auto_continuation_config()
        
        logger.warning("🚫 Auto-continuation disabled via API")
        
        return {
            "message": "Auto-continuation has been disabled globally",
            "global_enabled": config.global_enabled,
            "warning": "This affects all new and existing conversations"
        }
    except Exception as e:
        logger.error(f"Failed to disable auto-continuation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to disable auto-continuation: {str(e)}"
        )

@router.post("/auto-continuation/enable")
async def enable_auto_continuation():
    """Enable auto-continuation"""
    try:
        enable_auto_continuation_globally()
        config = get_auto_continuation_config()
        
        logger.info("✅ Auto-continuation enabled via API")
        
        return {
            "message": "Auto-continuation has been enabled globally",
            "global_enabled": config.global_enabled,
            "note": "Individual sessions may still have their own preferences"
        }
    except Exception as e:
        logger.error(f"Failed to enable auto-continuation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enable auto-continuation: {str(e)}"
        )