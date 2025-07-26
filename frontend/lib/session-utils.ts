/**
 * Session ID Management Utilities
 * 
 * Simplified session management utilities for conversation continuity
 */

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
 * Simple session ID resolution - just use the current session ID
 * The backend handles session continuity properly, so we don't need complex logic
 */
export function resolveNextSessionId(
  messages: Message[], 
  currentSessionId: string | null
): string | null {
  return currentSessionId;
}

/**
 * Extracts session ID from a message (simplified)
 */
export function extractSessionIdFromMessage(message: Message): string | null {
  return message.sessionId || null;
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
 * Simple session update function (simplified for basic continuity)
 */
export function updateSessionForContinuity(
  messages: Message[],
  currentSessionId: string | null,
  setSessionId: (sessionId: string | null) => void
): string | null {
  // With simplified session management, just return the current session ID
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
  const [sessionId, setSessionId] = React.useState<string | null>(initialSessionId || null);
  const [sessionHistory, setSessionHistory] = React.useState<string[]>([]);
  
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