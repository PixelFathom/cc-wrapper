/**
 * Session ID Management Utilities
 * 
 * Simplified session management utilities for conversation continuity
 */

import { useState } from 'react';

export interface MessageMetadata {
  next_session_id?: string;
  webhook_session_id?: string;
  bypass_mode_enabled?: boolean;
  auto_continuation_enabled?: boolean;
  task_id?: string;
  conversation_id?: string;
  status?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'hook' | 'auto';
  content: {
    text?: string;
    metadata?: MessageMetadata;
    [key: string]: any;
  };
  timestamp: string;
  sessionId?: string;
  isProcessing?: boolean;
  chatId?: string;
  hooks?: any[];
  continuationStatus?: 'none' | 'needed' | 'in_progress' | 'completed';
  parentMessageId?: string;
}

/**
 * Resolves the session ID to use for the next message based on priority:
 * 1. next_session_id (from ResultMessage webhook) - highest priority
 * 2. webhook_session_id (from webhook processing) - medium priority  
 * 3. current sessionId - fallback
 */
export function resolveNextSessionId(
  messages: Message[], 
  currentSessionId: string | null
): string | null {
  if (!messages.length) {
    return currentSessionId;
  }
  
  // Find the last assistant message with metadata
  const assistantMessages = messages
    .filter(m => m.role === 'assistant' && m.content?.metadata)
    .reverse(); // Start from most recent
  
  const lastAssistantMessage = assistantMessages[0];
  
  if (!lastAssistantMessage?.content?.metadata) {
    return currentSessionId;
  }
  
  const metadata = lastAssistantMessage.content.metadata;
  
  // Priority 1: next_session_id (from ResultMessage webhook)
  if (metadata.next_session_id) {
    console.log('🎯 Using next_session_id from ResultMessage webhook:', metadata.next_session_id);
    return metadata.next_session_id;
  }
  
  // Priority 2: webhook_session_id (from webhook processing)
  if (metadata.webhook_session_id) {
    console.log('🎯 Using webhook_session_id from webhook:', metadata.webhook_session_id);
    return metadata.webhook_session_id;
  }
  
  // Priority 3: current session ID (fallback)
  console.log('🎯 Using current session ID (fallback):', currentSessionId);
  return currentSessionId;
}

/**
 * Extracts session ID from various sources in a message
 */
export function extractSessionIdFromMessage(message: Message): string | null {
  if (!message.content?.metadata) {
    return message.sessionId || null;
  }
  
  const metadata = message.content.metadata;
  
  // Return the highest priority session ID available
  return metadata.next_session_id || 
         metadata.webhook_session_id || 
         message.sessionId || 
         null;
}

/**
 * Validates that a session ID is properly formatted
 */
export function validateSessionId(sessionId: string | null): boolean {
  if (!sessionId) return false;
  
  // Session IDs should be alphanumeric with possible hyphens/underscores
  const sessionIdPattern = /^[a-zA-Z0-9-_]+$/;
  return sessionIdPattern.test(sessionId);
}

/**
 * Creates a temporary session ID for new conversations
 */
export function createTemporarySessionId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determines if a session ID is temporary
 */
export function isTemporarySessionId(sessionId: string | null): boolean {
  return sessionId?.startsWith('temp-') || false;
}

/**
 * Updates the session ID for conversation continuity
 * This function ensures proper session management between messages
 */
export function updateSessionForContinuity(
  messages: Message[],
  currentSessionId: string | null,
  setSessionId: (sessionId: string | null) => void
): string | null {
  const nextSessionId = resolveNextSessionId(messages, currentSessionId);
  
  if (nextSessionId && nextSessionId !== currentSessionId) {
    console.log('📌 Updating session ID for continuity:', {
      from: currentSessionId,
      to: nextSessionId,
      messageCount: messages.length
    });
    
    setSessionId(nextSessionId);
    return nextSessionId;
  }
  
  return currentSessionId;
}

/**
 * Analyzes conversation state for debugging
 */
export function analyzeConversationState(messages: Message[], currentSessionId: string | null) {
  const analysis = {
    messageCount: messages.length,
    currentSessionId,
    sessionIds: new Set<string>(),
    assistantMessages: 0,
    userMessages: 0,
    lastAssistantMetadata: null as MessageMetadata | null,
    sessionTransitions: [] as Array<{from: string | null, to: string | null, index: number}>
  };
  
  let lastSessionId: string | null = null;
  
  messages.forEach((message, index) => {
    if (message.sessionId) {
      analysis.sessionIds.add(message.sessionId);
      
      if (message.sessionId !== lastSessionId) {
        analysis.sessionTransitions.push({
          from: lastSessionId,
          to: message.sessionId,
          index
        });
        lastSessionId = message.sessionId;
      }
    }
    
    if (message.role === 'assistant') {
      analysis.assistantMessages++;
      if (message.content?.metadata) {
        analysis.lastAssistantMetadata = message.content.metadata;
      }
    } else if (message.role === 'user') {
      analysis.userMessages++;
    }
  });
  
  return analysis;
}

/**
 * Hook for managing session ID state in React components
 */
export function useSessionManagement(initialSessionId?: string) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [sessionHistory, setSessionHistory] = useState<string[]>([]);
  
  const updateSession = (newSessionId: string | null) => {
    if (newSessionId && newSessionId !== sessionId) {
      setSessionHistory(prev => [...prev, sessionId].filter(Boolean) as string[]);
    }
    setSessionId(newSessionId);
  };
  
  return {
    sessionId,
    setSessionId: updateSession,
    sessionHistory,
    isTemporary: isTemporarySessionId(sessionId),
    isValid: validateSessionId(sessionId)
  };
}

// For environments where React is not available
declare const React: any;