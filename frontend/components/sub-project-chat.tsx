'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneIcon, PersonIcon, RocketIcon, UpdateIcon, ChevronRightIcon,
  CodeIcon, GearIcon, CheckCircledIcon, CrossCircledIcon, ClockIcon,
  FileTextIcon, CubeIcon, ChevronDownIcon, DotFilledIcon, CopyIcon,
  ChatBubbleIcon, MixerHorizontalIcon, CircleIcon
} from '@radix-ui/react-icons'
import { api, ChatHook } from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { cn } from '@/lib/utils'
import { AssistantMessage } from './assistant-message'
import { TestCaseGenerationModal } from './test-case-generation-modal'
import { useApiError } from '@/lib/hooks/useApiError'
import { toast } from 'sonner'
import { CreditCost } from './ui/credit-cost'
import { MobileWaitingResponse, MobileInputStatus, FloatingWaitingIndicator } from './mobile-waiting-response'
import { useMobile } from '@/lib/hooks/useMobile'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { BreakdownDetectionMessage } from './breakdown-detection-message'
import { TaskBreakdownTimeline } from './task-breakdown-timeline'
import { BreakdownAnalysis, getBreakdownStatus, startFirstSubTask, retrySubTask, retryChat, type SubTaskInfo } from '@/lib/api/task-breakdown'

interface SubProjectChatProps {
  projectName: string
  taskName: string
  subProjectId: string
  initialSessionId?: string
  taskId?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'hook' | 'auto'
  content: any
  timestamp: string
  sessionId?: string
  isProcessing?: boolean
  chatId?: string  // Server-provided chat ID
  hooks?: ChatHook[]  // Associated webhook logs
  continuationStatus?: 'none' | 'needed' | 'in_progress' | 'completed'
  parentMessageId?: string
}

// QueuedMessage interface removed - using blocking input instead

interface WebhookLog {
  id: string
  type: string
  status: string
  message: string
  tool_name?: string
  timestamp: string
  duration_ms?: number
  expanded?: boolean
}

// Available agents
const AVAILABLE_AGENTS = [
  { value: null, label: 'Default', description: 'Standard Claude assistant' },
  { value: '@agent-product-manager-planner', label: 'Product Manager', description: 'Gather requirements and plan development' },
  { value: '@agent-docs-generator', label: 'Docs Generator', description: 'Create technical documentation' },
  { value: '@agent-frontend-component-builder', label: 'Frontend Builder', description: 'Build frontend components' },
  { value: '@agent-code-review-tester', label: 'Code Reviewer', description: 'Review code and create tests' },
  { value: '@agent-backend-architect', label: 'Backend Architect', description: 'Design backend systems and APIs' },
]

const TAB_LABEL_MAX_CHARS = 32

const contentToText = (content: any): string => {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content.text === 'string') return content.text
  if (typeof content.message === 'string') return content.message
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part.text === 'string') return part.text
        return ''
      })
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

const truncateText = (text: string, maxLength: number = TAB_LABEL_MAX_CHARS) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export function SubProjectChat({ projectName, taskName, subProjectId, initialSessionId, taskId }: SubProjectChatProps) {
  const isMobile = useMobile()
  const queryClient = useQueryClient()
  const { handleApiError } = useApiError()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatId, setChatId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set())
  // Collapse all hooks by default for cleaner UI
  const [showAllHooks, setShowAllHooks] = useState(false)
  const [autoContinuationEnabled, setAutoContinuationEnabled] = useState(true)
  const [permissionMode, setPermissionMode] = useState<'interactive' | 'bypassPermissions' | 'plan'>('bypassPermissions')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  
  // Test case generation modal state
  const [showTestCaseModal, setShowTestCaseModal] = useState(false)
  
  // Task breakdown state
  const [breakdownInfo, setBreakdownInfo] = useState<BreakdownAnalysis | null>(null)
  const [showBreakdownTimeline, setShowBreakdownTimeline] = useState(false)
  const [expandedSubTaskId, setExpandedSubTaskId] = useState<string | null>(null)
  const [expandedSubTaskHookIds, setExpandedSubTaskHookIds] = useState<Set<string>>(new Set())

  // Planning state
  const [isPlanningExpanded, setIsPlanningExpanded] = useState(true)
  const [expandedPlanningHookIds, setExpandedPlanningHookIds] = useState<Set<string>>(new Set())

  // Auto-collapse planning when complete
  const hasPlanningInProgress = useMemo(() => {
    return messages.some(m => m.content?.metadata?.planning_in_progress)
  }, [messages])

  useEffect(() => {
    // Collapse planning section when planning completes
    if (!hasPlanningInProgress) {
      setIsPlanningExpanded(false)
    }
  }, [hasPlanningInProgress])

  // Message queue state removed - input is now blocked when waiting for response
  
  // Auto-scroll state management
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const agentDropdownRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const cwd = `${projectName}/${taskName}`
  
  // Session state persistence key
  const sessionStorageKey = `chat-session-${cwd}-${subProjectId}`
  
  // Simple session state - use initialSessionId if provided, otherwise null
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null)

  // Check if this is a new chat (temporary ID)
  const isNewChat = subProjectId.startsWith('new-')
  
  // Handle click outside to close agent dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false)
      }
    }
    
    if (showAgentDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showAgentDropdown])
  
  // Load preferences from localStorage after mount to avoid SSR hydration issues
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPermissionMode = localStorage.getItem('permissionMode')
      if (savedPermissionMode && (savedPermissionMode === 'interactive' || savedPermissionMode === 'bypassPermissions' || savedPermissionMode === 'plan')) {
        setPermissionMode(savedPermissionMode as 'interactive' | 'bypassPermissions' | 'plan')
      }

      const savedAutoScroll = localStorage.getItem('autoScrollEnabled')
      if (savedAutoScroll !== null) {
        setAutoScrollEnabled(savedAutoScroll === 'true')
      }
    }
  }, [])
  
  // Log prop changes for debugging
  useEffect(() => {
    console.log('🔍 SubProjectChat props:', {
      projectName,
      taskName,
      subProjectId,
      initialSessionId,
      currentSession: sessionId
    })
  }, [projectName, taskName, subProjectId, initialSessionId, sessionId])
  
  // Save permission mode preference to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('permissionMode', permissionMode)
    }
  }, [permissionMode])
  
  // Save auto-scroll preference to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoScrollEnabled', autoScrollEnabled.toString())
    }
  }, [autoScrollEnabled])
  
  // Load initial session messages if provided
  useEffect(() => {
    if (initialSessionId && !messages.length) {
      console.log('📚 Loading initial chat history for session:', initialSessionId)
      loadChatHistory(initialSessionId)
    }
  }, [initialSessionId])
  
  // Load permission mode preference from session metadata
  useEffect(() => {
    if (messages.length > 0) {
      // Find the last assistant message to get permission mode preference
      const assistantMessages = messages.filter(m => m.role === 'assistant' && m.content?.metadata)
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]

      if (lastAssistantMessage && lastAssistantMessage.content?.metadata?.permission_mode) {
        setPermissionMode(lastAssistantMessage.content.metadata.permission_mode)
      }
    }
  }, [messages])
  
  // Fetch sessions for this sub-project (only if it's not a new chat)
  const { data: sessionsData } = useQuery({
    queryKey: ['sub-project-sessions', subProjectId],
    queryFn: () => api.getSubProjectSessions(subProjectId),
    enabled: !!subProjectId && !isNewChat, // Skip for new chats
    refetchInterval: 15000, // Refresh every 15 seconds
  })

  useEffect(() => {
    if (sessionsData?.sessions) {
      setSessions(sessionsData.sessions)
    }
  }, [sessionsData])

  // New chat mutation using the hook-enabled endpoint
  const sendMutation = useMutation({
    mutationFn: async (data: { prompt: string; session_id?: string }) => {
      console.log('📤 Sending query with session_id:', data.session_id || 'none')
      // Always use the query endpoint for now
      const response = await api.sendQuery({
        ...data,
        org_name: 'default',
        cwd,
        permission_mode: permissionMode,
        agent_name: selectedAgent,
      })
      
      console.log('📥 Query response:', {
        session_id: response.session_id,
        chat_id: response.chat_id
      })
      
      // Get the chat ID from the response if available
      if (response.chat_id) {
        setChatId(response.chat_id)
      }
      
      return response
    },
    onSuccess: (data) => {
      // CRITICAL FIX: Preserve conversation session ID continuity
      // Capture the current sessionId before any updates to detect if this is truly a first message
      const wasFirstMessage = !sessionId
      
      console.log('✅ Query sent successfully:', {
        session_id: data.session_id,
        chat_id: data.chat_id,
        was_first_message: wasFirstMessage,
        current_session_id: sessionId,
        response_session_id: data.session_id,
        is_breakdown: data.is_breakdown,
        breakdown_info: data.breakdown_info
      })
      
      // Check if this is a breakdown response
      if (data.is_breakdown && data.breakdown_info) {
        console.log('🎯 Breakdown detected:', data.breakdown_info)
        setBreakdownInfo(data.breakdown_info)
        // NOTE: Don't set showBreakdownTimeline to true here!
        // Let BreakdownDetectionMessage show first, then transition to timeline
        // after user clicks "Start Now" or auto-start timer fires
        setShowBreakdownTimeline(false)
      }
      
      // CRITICAL: Only update sessionId for the very first message of a conversation
      // Never change session ID for continuing conversations to maintain UI continuity
      if (wasFirstMessage && data.session_id) {
        console.log('🆕 Setting session ID for first message:', data.session_id)
        setSessionId(data.session_id)
      } else if (!wasFirstMessage) {
        console.log('🔒 Preserving existing session ID for conversation continuity:', sessionId)
        // Verify that the backend returned the same session_id for continuing conversations
        if (data.session_id !== sessionId) {
          console.warn(
            '⚠️ Session ID mismatch detected! This should not happen for continuing conversations.',
            'Frontend session:', sessionId,
            'Backend returned:', data.session_id
          )
        }
      }
      
      if (data.chat_id) {
        setChatId(data.chat_id)
      }
    },
    onError: (error) => {
      console.error('❌ Query failed:', error)

      // Handle rate limit errors with the banner
      const wasRateLimitError = handleApiError(error)

      if (wasRateLimitError) {
        // Also show a toast for immediate feedback
        toast.error('Rate Limit Exceeded', {
          description: 'You have exceeded the rate limit. Please check the banner at the top of the page for details.',
          duration: 5000,
        })
      } else {
        // Extract detailed error information
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        const errorData = (error as any)?.responseData?.detail

        // Check if it's a subscription/credits error
        if (errorData && typeof errorData === 'object' && errorData.error === 'insufficient_coins') {
          toast.error('Insufficient Credits', {
            description: `${errorMessage}. You need ${errorData.required} credit(s) but only have ${errorData.available}. Please upgrade your subscription or visit the pricing page.`,
            duration: 7000,
          })
        } else {
          // Handle other errors with a toast notification
          toast.error('Failed to send message', {
            description: errorMessage,
          })
        }
      }

      // Remove the processing message if there was an error
      setMessages(prev => prev.filter(msg => !msg.isProcessing))
    },
  })

  // Retry sub-task mutation
  const retrySubTaskMutation = useMutation({
    mutationFn: async ({ parentSessionId, subTaskSessionId }: { parentSessionId: string; subTaskSessionId: string }) => {
      console.log('🔄 Retrying sub-task:', subTaskSessionId)
      return retrySubTask(parentSessionId, subTaskSessionId)
    },
    onSuccess: (data) => {
      console.log('✅ Sub-task retry initiated:', data)
      toast.success('Sub-task retry started', {
        description: `Task ${data.session_id} has been queued for retry.`
      })
      // Refresh breakdown status to see the updated state
      refetchBreakdownStatus()
    },
    onError: (error) => {
      console.error('❌ Sub-task retry failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry sub-task'
      toast.error('Retry failed', {
        description: errorMessage
      })
    }
  })

  // Retry chat mutation
  const retryChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      console.log('🔄 Retrying chat:', chatId)
      return retryChat(chatId)
    },
    onSuccess: (data) => {
      console.log('✅ Chat retry initiated:', data)
      toast.success('Retry started', {
        description: 'The failed message has been queued for retry.'
      })
      // Refresh session messages
      queryClient.invalidateQueries({ queryKey: ['chats', 'session', sessionId] })
    },
    onError: (error) => {
      console.error('❌ Chat retry failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry message'
      toast.error('Retry failed', {
        description: errorMessage
      })
    }
  })

  // Poll for messages in the current session
  // Check if we're waiting for a response - more robust detection
  const isWaitingForResponse = useMemo(() => {
    // If mutation is pending, we're definitely waiting
    if (sendMutation.isPending) return true

    // Check if any assistant message is still processing or lacks actual content
    return messages.some(msg => {
      if (msg.role !== 'assistant') return false

      // Check explicit processing state
      if (msg.isProcessing) return true
      if (msg.content?.metadata?.status === 'processing') return true

      // Check if message lacks actual content (still waiting for response)
      const textContent = msg.content?.text || ''
      const hasActualContent = textContent &&
                               textContent !== '' &&
                               textContent !== 'Processing your request...' &&
                               textContent !== 'Waiting for response...'

      // If no actual content, we're still waiting
      if (!hasActualContent) return true

      return false
    })
  }, [messages, sendMutation.isPending])
  
  // Query for messages when sessionId is available
  const { data: sessionMessages, error: sessionError } = useQuery({
    queryKey: ['chats', 'session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null
      try {
        const data = await api.getSessionChats(sessionId)
        console.log('🔄 API returned', data.messages?.length || 0, 'messages for session:', sessionId)
        return data
      } catch (error: any) {
        if (error?.response?.status === 404) {
          console.log('❌ Session not found:', sessionId)
          return { messages: [] }
        }
        throw error
      }
    },
    enabled: !!sessionId,
    refetchInterval: isWaitingForResponse ? 3000 : 5000, // Poll every 3s when waiting, 5s otherwise
    // Important: Keep the data fresh
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
  
  // Query for message hooks with better caching
  const { data: messageHooks } = useQuery({
    queryKey: ['hooks', messages.map(m => m.id)],
    queryFn: async () => {
      const hooksMap = new Map<string, ChatHook[]>()
      
      // Fetch hooks for all messages in parallel
      await Promise.all(
        messages.map(async (message) => {
          try {
            const response = await api.getMessageHooks(message.id)
            if (response.hooks && response.hooks.length > 0) {
              hooksMap.set(message.id, response.hooks)
              console.log(`🪝 Fetched ${response.hooks.length} hooks for message ${message.id.slice(0, 8)}`)
            }
          } catch (error) {
            console.error(`Failed to fetch hooks for message ${message.id}:`, error)
          }
        })
      )
      
      console.log(`📊 Total hooks fetched: ${Array.from(hooksMap.values()).flat().length}`)
      return hooksMap
    },
    enabled: messages.length > 0,
    // Poll more frequently when planning or waiting for response
    refetchInterval: (() => {
      const hasPlanningInProgress = messages.some(m => m.content?.metadata?.planning_in_progress)
      if (hasPlanningInProgress || isWaitingForResponse) return 2000 // 2 seconds
      return 5000 // 5 seconds
    })(),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  })
  
  // Check if any message is a breakdown parent
  const hasBreakdownParent = useMemo(() => {
    return messages.some(msg => msg.content?.metadata?.is_breakdown_parent)
  }, [messages])

  // Query for breakdown status if we have a breakdown parent message
  const { data: breakdownStatus, refetch: refetchBreakdownStatus } = useQuery({
    queryKey: ['breakdown-status', sessionId],
    queryFn: () => getBreakdownStatus(sessionId!),
    enabled: !!sessionId && (hasBreakdownParent || !!breakdownInfo),
    refetchInterval: 5000, // Poll every 5 seconds for updates
    staleTime: 0,
  })

  // Query for hooks of expanded sub-task session
  const { data: expandedSubTaskHooks, refetch: refetchSubTaskHooks, isRefetching: isRefetchingHooks } = useQuery({
    queryKey: ['subtask-hooks', expandedSubTaskId],
    queryFn: async () => {
      if (!expandedSubTaskId) return { messages: [], hooks: [] }
      // Fetch messages for the sub-task session to get hooks
      const response = await api.request<{ messages: any[] }>(`/chats/session/${expandedSubTaskId}`)
      const messages = response.messages || []

      // Fetch hooks for each message in this session
      const hooksPromises = messages.map(async (msg: any) => {
        try {
          const response = await api.request<{ hooks: ChatHook[] }>(`/chats/${msg.id}/hooks`)
          return { messageId: msg.id, hooks: response.hooks || [] }
        } catch {
          return { messageId: msg.id, hooks: [] }
        }
      })

      const results = await Promise.all(hooksPromises)
      return {
        messages,
        hooks: results.flatMap(r => r.hooks)
      }
    },
    enabled: !!expandedSubTaskId,
    staleTime: 0,
  })

  // Update session_id when breakdown tasks complete
  // The session_id used to continue a chat should be the latest sub-task's session_id
  useEffect(() => {
    if (!breakdownStatus) return

    const { sub_task_sessions, completed_sub_tasks, total_sub_tasks } = breakdownStatus

    // Find the latest completed or processing sub-task with a session_id
    const lastActiveTask = [...sub_task_sessions]
      .reverse()
      .find(task => task.session_id && (task.status === 'completed' || task.status === 'processing'))

    if (lastActiveTask?.session_id) {
      console.log('🔄 Breakdown progress: Using session_id from sub-task', lastActiveTask.sequence, lastActiveTask.session_id)
      // Store the latest sub-task session_id for continuing chats
      // We don't update sessionId here as that would break the UI, but we can use it for future messages
    }

    // When all tasks complete, we can show completion state
    if (completed_sub_tasks >= total_sub_tasks && total_sub_tasks > 0) {
      console.log('🎉 All breakdown tasks completed!')
      // Optionally hide the timeline after completion
      // setShowBreakdownTimeline(false)
    }
  }, [breakdownStatus])

  // Update messages when session data changes - intelligent merge
  useEffect(() => {
    if (sessionMessages?.messages && Array.isArray(sessionMessages.messages)) {
      const messageCount = sessionMessages.messages.length
      console.log('📨 Processing', messageCount, 'messages for session:', sessionId)
      
      // Only update if we have messages, don't clear on empty arrays
      if (messageCount > 0) {
        setMessages(prevMessages => {
          const newMessages: Message[] = sessionMessages.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at,
            sessionId: msg.session_id,
            isProcessing: msg.role === 'assistant' &&
                          msg.content?.metadata?.status === 'processing',
            continuationStatus: msg.continuation_status,
            parentMessageId: msg.parent_message_id,
            chatId: msg.id, // Chat ID for retry functionality
          }))
          
          // Filter out temporary messages first
          const nonTempMessages = prevMessages.filter(m => !m.id.startsWith('temp-'))
          
          // Create a map of existing messages for quick lookup
          const existingMap = new Map(nonTempMessages.map(m => [m.id, m]))
          const updatedMap = new Map(existingMap)
          
          // Update or add messages
          newMessages.forEach(newMsg => {
            const existing = existingMap.get(newMsg.id)
            
            // CONVERSATION CONTINUITY: Ensure all messages use the current UI session ID for display
            // This prevents any messages from appearing in wrong sessions due to backend session evolution
            if (sessionId && newMsg.sessionId !== sessionId) {
              console.log(`🔧 Correcting message session ID for UI consistency | ${newMsg.id.slice(0, 8)}... | ${newMsg.sessionId} → ${sessionId}`)
              newMsg.sessionId = sessionId
            }
            
            // Always update if content changed or if it's a new message
            if (!existing || 
                JSON.stringify(existing.content) !== JSON.stringify(newMsg.content) ||
                existing.isProcessing !== newMsg.isProcessing ||
                existing.continuationStatus !== newMsg.continuationStatus) {
              
              console.log(`🔄 ${existing ? 'Updating' : 'Adding'} message ${newMsg.id.slice(0, 8)}...`, {
                role: newMsg.role,
                wasProcessing: existing?.isProcessing,
                isProcessing: newMsg.isProcessing,
                hasText: !!newMsg.content?.text,
                continuationStatus: newMsg.continuationStatus,
                sessionId: newMsg.sessionId
              })
              
              updatedMap.set(newMsg.id, newMsg)
            }
          })
          
          // Convert back to array and sort by timestamp
          const finalMessages = Array.from(updatedMap.values())
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          
          console.log('✅ Updated UI with', finalMessages.length, 'messages')
          return finalMessages
        })
      } else {
        console.log('⚠️ Received empty message array, keeping current messages')
      }
    } else if (sessionMessages === null) {
      console.log('📭 Session messages is null, keeping current state')
    }
  }, [sessionMessages])
  

  // Removed EventSource - using polling instead for better control

  // Smart auto-scroll when messages change
  useEffect(() => {
    // Only scroll if conditions are met
    scrollToBottom()
  }, [messages, autoScrollEnabled])
  
  // Smart scroll when hooks are expanded/collapsed or when waiting for response changes
  useEffect(() => {
    // Only auto-scroll for hook changes if user hasn't scrolled up
    if (!userScrolledUp) {
      scrollToBottom()
    }
  }, [expandedHooks, showAllHooks, isWaitingForResponse, userScrolledUp, autoScrollEnabled])
  
  // Add scroll event listener to detect user scroll behavior
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    
    let scrollTimeout: NodeJS.Timeout
    const debouncedHandleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(handleScroll, 50)
    }
    
    container.addEventListener('scroll', debouncedHandleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [userScrolledUp])
  
  // Add keyboard shortcut for manual scroll to bottom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + End to scroll to bottom and re-enable auto-scroll
      if ((event.ctrlKey || event.metaKey) && event.key === 'End') {
        event.preventDefault()
        scrollToBottomManually()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  
  // Auto-continuation logic
  useEffect(() => {
    if (!autoContinuationEnabled || !sessionId) return
    
    // Check if the last assistant message needs continuation
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const lastAssistant = assistantMessages[assistantMessages.length - 1]
    
    if (lastAssistant && 
        lastAssistant.continuationStatus === 'needed' && 
        !lastAssistant.isProcessing &&
        lastAssistant.content?.text) {
      
      // Check if we already have an auto message for this assistant message
      const hasAutoChild = messages.some(m => 
        m.role === 'auto' && m.parentMessageId === lastAssistant.id
      )
      
      if (!hasAutoChild) {
        console.log('🤖 Triggering auto-continuation for message:', lastAssistant.id)
        
        // Get the session ID to use for continuation
        // Priority: next_session_id (from ResultMessage) > webhook_session_id > current session_id
        const metadata = lastAssistant.content?.metadata || {}
        const nextSessionId = metadata.next_session_id
        const webhookSessionId = metadata.webhook_session_id
        const sessionIdToUse = nextSessionId || webhookSessionId || sessionId
        
        console.log('🔄 Auto-continuation session resolution:', {
          nextSessionId,
          webhookSessionId,
          currentSessionId: sessionId,
          using: sessionIdToUse
        })
        
        // Add a temporary auto message to show processing state immediately
        // Use the current UI session ID for display consistency
        const tempAutoMessage: Message = {
          id: `temp-auto-${Date.now()}`,
          role: 'auto',
          content: { 
            text: 'Continue',
            metadata: {
              webhook_session_id: sessionIdToUse  // Store the webhook session ID in metadata
            }
          },
          timestamp: new Date().toISOString(),
          sessionId: sessionId,  // Use UI session ID for display
          parentMessageId: lastAssistant.id
        }
        
        // Add temporary auto message
        setMessages(prev => [...prev, tempAutoMessage])
        
        // Add a temporary processing assistant message
        const tempAssistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          role: 'assistant',
          content: { text: '', metadata: { status: 'processing' } },
          timestamp: new Date().toISOString(),
          sessionId: sessionId,  // Use UI session ID for display
          isProcessing: true,
          parentMessageId: tempAutoMessage.id
        }
        
        setMessages(prev => [...prev, tempAssistantMessage])
        
        // Trigger continuation
        api.continueChat(lastAssistant.id)
          .then(result => {
            if (result.needs_continuation) {
              console.log('✅ Auto-continuation triggered:', result)
              // The polling will pick up the new messages and replace our temp messages
            } else {
              // Remove temporary messages if continuation not needed
              setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')))
            }
          })
          .catch(error => {
            console.error('❌ Failed to trigger auto-continuation:', error)
            // Remove temporary messages on error
            setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')))
          })
      }
    }
  }, [messages, autoContinuationEnabled, sessionId])

  // Queue functionality removed - using blocking input instead

  const loadChatHistory = async (loadSessionId: string) => {
    setLoadingHistory(true)
    try {
      const data = await api.getSessionChats(loadSessionId)
      const historyMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        sessionId: loadSessionId,
        chatId: msg.id, // Chat ID for retry functionality
      }))
      setMessages(historyMessages)
      setSessionId(loadSessionId)
      
      // Find the chat ID from the first message
      if (historyMessages.length > 0) {
        setChatId(historyMessages[0].id)
      }
      
      // Always scroll to bottom after loading history (this is user-initiated)
      setUserScrolledUp(false)
      scrollToBottom('auto', true)
    } catch (error) {
      console.error('Failed to load chat history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const startNewSession = () => {
    setMessages([])
    setSessionId(null)
    setChatId(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Block submission if waiting for a response
    if (isWaitingForResponse) {
      console.log('⚠️ Submission blocked: waiting for response')
      return
    }

    const userInput = input
    const agentToUse = selectedAgent
    setInput('')

    // Reset textarea height after clearing input
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = '24px' // Reset to min-height
    }

    // Process the message
    processMessage(userInput, agentToUse)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    })
  }
  
  // Handle starting breakdown execution
  const handleStartBreakdown = async () => {
    if (!sessionId) return

    // Allow starting if we have breakdownInfo OR a breakdown parent message
    if (!breakdownInfo && !hasBreakdownParent) return

    try {
      console.log('▶️ Starting breakdown execution for session:', sessionId)
      toast.info('Starting task breakdown execution...')

      const result = await startFirstSubTask(sessionId)

      console.log('✅ First sub-task started:', result)
      toast.success(`Started sub-task: ${result.title}`)

      // Refetch messages and breakdown status to show progress
      queryClient.invalidateQueries({ queryKey: ['chats', 'session', sessionId] })
      refetchBreakdownStatus()
    } catch (error) {
      console.error('❌ Failed to start breakdown:', error)
      toast.error('Failed to start breakdown execution')
      // Revert to detection message on error
      setShowBreakdownTimeline(false)
    }
  }

  const sessionTabs = useMemo(() => {
    const baseSessions = Array.isArray(sessions) ? [...sessions] : []

    // Filter out sub-task sessions (where parent_session_id != session_id)
    // Sub-tasks are shown inline within their parent message, not as separate tabs
    const filteredSessions = baseSessions.filter(session => {
      // Keep sessions that are NOT sub-tasks
      // A session is a sub-task if it has parent_session_id that differs from session_id
      if (session.parent_session_id && session.parent_session_id !== session.session_id) {
        return false // This is a sub-task, filter it out
      }
      // Also filter out if explicitly marked as breakdown subtask
      if (session.is_breakdown_subtask) {
        return false
      }
      return true
    })

    if (sessionId && !filteredSessions.some((session) => session.session_id === sessionId)) {
      // Check if the current session is a sub-task - if so, don't add it as a tab
      const currentIsSubtask = baseSessions.some(s =>
        s.session_id === sessionId &&
        s.parent_session_id &&
        s.parent_session_id !== sessionId
      )

      if (!currentIsSubtask) {
        const firstUserMessage = messages.find((msg) => msg.role === 'user')
        const messagePreview = firstUserMessage ? contentToText(firstUserMessage.content) : ''
        filteredSessions.unshift({
          session_id: sessionId,
          first_message: messagePreview || 'Active session',
          message_count: messages.length,
          created_at: firstUserMessage?.timestamp,
          isVirtual: true,
        })
      }
    }
    return filteredSessions
  }, [sessions, sessionId, messages])

  const getSessionTabLabel = (session: any, index: number) => {
    const previewSource = session.first_message ?? session.firstMessage ?? session.preview
    const previewText = previewSource ? contentToText(previewSource) : ''
    if (previewText.trim()) {
      return truncateText(previewText.trim())
    }
    if (session.session_id) {
      return `Session ${session.session_id.slice(0, 6)}`
    }
    return `Session ${index + 1}`
  }

  const getSessionTabTooltip = (session: any) => {
    const previewSource = session.first_message ?? session.firstMessage ?? session.preview
    const previewText = previewSource ? contentToText(previewSource) : ''
    const idText = session.session_id ? ` (#${session.session_id.slice(0, 8)})` : ''
    const count = session.message_count ?? session.messageCount
    const countText = typeof count === 'number' ? ` · ${count} messages` : ''
    if (previewText.trim()) {
      return `${previewText.trim()}${idText}${countText}`
    }
    return `Session${idText}${countText}`
  }

  const getSessionTabMessageCount = (session: any) => {
    const count = session.message_count ?? session.messageCount
    if (typeof count === 'number') return count
    return 0
  }

  // Enhanced scroll detection and management
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true
    const container = messagesContainerRef.current
    const threshold = 100 // pixels from bottom
    return container.scrollTop >= container.scrollHeight - container.clientHeight - threshold
  }
  
  const handleScroll = () => {
    if (!messagesContainerRef.current) return
    
    const nearBottom = isNearBottom()
    
    // If user scrolled up manually, disable auto-scroll and show indicator
    if (!nearBottom && !userScrolledUp) {
      setUserScrolledUp(true)
      setShowNewMessageIndicator(false)
    }
    
    // If user scrolled back to bottom, re-enable auto-scroll behavior
    if (nearBottom && userScrolledUp) {
      setUserScrolledUp(false)
      setShowNewMessageIndicator(false)
    }
  }
  
  // Enhanced scroll to bottom helper function
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth', force: boolean = false) => {
    // Only scroll if auto-scroll is enabled or if it's forced (e.g., user action)
    if (!autoScrollEnabled && !force) {
      // Show new message indicator if user has scrolled up
      if (userScrolledUp) {
        setShowNewMessageIndicator(true)
      }
      return
    }
    
    // Don't auto-scroll if user has manually scrolled up (unless forced)
    if (userScrolledUp && !force) {
      setShowNewMessageIndicator(true)
      return
    }
    
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
        // Also ensure the parent container scrolls to bottom as a fallback
        const messagesContainer = messagesEndRef.current.parentElement
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
        // Clear the new message indicator
        setShowNewMessageIndicator(false)
      }
    }, 100)
  }
  
  // Manual scroll to bottom (always forces scroll and re-enables auto-scroll)
  const scrollToBottomManually = () => {
    setUserScrolledUp(false)
    scrollToBottom('smooth', true)
  }

  const toggleHookExpansion = (hookId: string) => {
    const newExpanded = new Set(expandedHooks)
    if (newExpanded.has(hookId)) {
      newExpanded.delete(hookId)
    } else {
      newExpanded.add(hookId)
    }
    setExpandedHooks(newExpanded)
  }

  const getHookIcon = (hook: ChatHook) => {
    if (hook.tool_name) {
      const toolName = hook.tool_name.toLowerCase()
      const baseClass = "h-3 w-3"
      const colorClass = hook.status === 'processing' ? "text-purple-400" : 
                        hook.status === 'completed' ? "text-green-400" : 
                        hook.status === 'error' || hook.status === 'failed' ? "text-red-400" : 
                        "text-gray-400"
      
      if (toolName.includes('bash') || toolName.includes('shell')) return <CodeIcon className={`${baseClass} ${colorClass}`} />
      if (toolName.includes('read') || toolName.includes('write')) return <FileTextIcon className={`${baseClass} ${colorClass}`} />
      if (toolName.includes('search') || toolName.includes('grep')) return <CubeIcon className={`${baseClass} ${colorClass}`} />
      return <GearIcon className={`${baseClass} ${colorClass}`} />
    }
    
    if (hook.status === 'completed') return <CheckCircledIcon className="h-3 w-3 text-green-500" />
    if (hook.status === 'error' || hook.status === 'failed') return <CrossCircledIcon className="h-3 w-3 text-red-500" />
    if (hook.status === 'processing') return <UpdateIcon className="h-3 w-3 text-purple-400 animate-spin" />
    return <DotFilledIcon className="h-3 w-3 text-gray-500" />
  }

  const formatHookMessage = (hook: ChatHook) => {
    if (hook.message) return hook.message
    if (hook.tool_name) return `Using tool: ${hook.tool_name}`
    if (hook.data?.result) return hook.data.result.substring(0, 100) + '...'
    return hook.status || 'Processing'
  }

  const copyMessageContent = async (message: Message) => {
    try {
      const textContent = message.role === 'assistant' 
        ? (message.content?.text || '')
        : (message.content?.text || message.content || '')
      
      await navigator.clipboard.writeText(textContent)
      setCopiedMessageId(message.id)
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  // Queue management functions removed - using blocking input instead

  const processMessage = useCallback(async (userInput: string, agent?: string | null) => {
    const resolveSessionId = () => {
      if (sessionId) {
        console.log('🔒 PRESERVING session ID for conversation continuity:', sessionId)
        return sessionId
      }
      console.log('🆕 No session_id available - this is the first message in a new conversation')
      return undefined
    }
    
    let sessionIdToUse = resolveSessionId()
    
    // Additional safety check: if we have messages but no sessionId, something is wrong
    if (!sessionIdToUse && messages.length > 0) {
      console.error('❌ CRITICAL: We have messages but no session ID! This should not happen.')
      console.log('Messages:', messages.map(m => ({ id: m.id, role: m.role, sessionId: m.sessionId })))
      
      // Try to recover by using the session ID from the last message
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.sessionId) {
        sessionIdToUse = lastMessage.sessionId
        setSessionId(sessionIdToUse)
        console.log('🔧 RECOVERED session ID from last message:', sessionIdToUse)
      }
    }
    
    console.log('📨 Processing message:', {
      session_id: sessionIdToUse || 'none (first message)',
      messageCount: messages.length,
      hasLastAssistant: !!messages.find(m => m.role === 'assistant'),
      agent: agent || 'default'
    })
    
    // Add temporary user message for immediate feedback
    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: { text: userInput },
      timestamp: new Date().toISOString(),
      sessionId: sessionIdToUse || 'temp',
    }
    
    setMessages(prev => [...prev, tempUserMessage])
    
    // Add temporary processing assistant message
    const tempAssistantMessage: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: { text: '', metadata: { status: 'processing' } },
      timestamp: new Date().toISOString(),
      sessionId: sessionIdToUse || 'temp',
      isProcessing: true,
    }
    
    setMessages(prev => [...prev, tempAssistantMessage])
    
    // Send mutation with current sessionId (null for first message)
    sendMutation.mutate({
      prompt: userInput,
      session_id: sessionIdToUse || undefined,
    })
    
    // Always scroll to bottom after sending message (force scroll and reset user scroll state)
    setUserScrolledUp(false)
    setTimeout(() => {
      scrollToBottom('smooth', true)
    }, 100)
  }, [sessionId, messages, sendMutation, setMessages, setSessionId, scrollToBottom])

  // Queue processing removed - using blocking input instead

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)]">
      <div className="flex-1 overflow-hidden flex flex-col gradient-border-neon rounded-lg relative bg-black/30">
        {/* Modern Chat Header - Clean & Minimal */}
        <div className="bg-card/80 backdrop-blur-xl border-b border-border/40">
          <div className="flex items-center h-9 sm:h-11 px-1.5 sm:px-3">
            {/* Session Tabs Container with scroll fade */}
            <div className="relative flex-1 min-w-0">
              {/* Scroll fade indicator - right side */}
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-card/80 to-transparent pointer-events-none z-10 sm:hidden" />
              <div className="flex items-center overflow-x-auto scrollbar-none">
                {/* New Session Tab */}
                <button
                  type="button"
                  onClick={startNewSession}
                  className="flex items-center gap-0.5 sm:gap-1 h-6 sm:h-7 px-1.5 sm:px-2.5 mr-0.5 sm:mr-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10 transition-all shrink-0"
                >
                  <span className="text-xs sm:text-sm">+</span>
                  <span className="hidden sm:inline">New</span>
                </button>

                {/* Divider */}
                {sessionTabs.length > 0 && (
                  <div className="w-px h-3 sm:h-4 bg-border/50 mx-0.5 sm:mx-1 shrink-0" />
                )}

                {/* Session Tabs */}
                <div className="flex items-center gap-0.5">
                  {sessionTabs.map((session, index) => {
                    const isActive = session.session_id === sessionId
                    const messageCount = getSessionTabMessageCount(session)
                    const label = getSessionTabLabel(session, index)
                    return (
                      <button
                        type="button"
                        key={session.session_id ?? `session-${index}`}
                        onClick={() => {
                          if (!session.session_id || session.session_id === sessionId) return
                          loadChatHistory(session.session_id)
                        }}
                        className={cn(
                          "group relative flex items-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md text-[10px] sm:text-xs transition-all duration-150 shrink-0 max-w-[100px] sm:max-w-[160px]",
                          isActive
                            ? "bg-muted/80 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                        title={getSessionTabTooltip(session)}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <span className="absolute bottom-0 left-1.5 sm:left-2 right-1.5 sm:right-2 h-0.5 bg-cyan-500 rounded-full" />
                        )}
                        <span className="truncate">{label}</span>
                        <span className={cn(
                          "text-[9px] sm:text-[10px] tabular-nums",
                          isActive ? "text-cyan-400" : "text-muted-foreground/60"
                        )}>
                          {messageCount}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2 shrink-0">
              {/* Connection Status */}
              {sessionId && (
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  sessionError ? "bg-red-500 animate-pulse" : "bg-green-500"
                )} title={sessionError ? 'Connection error' : 'Connected'} />
              )}

              {/* Test Generation - hidden on very small screens */}
              {sessionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTestCaseModal(true)}
                  className="hidden xs:flex h-6 sm:h-7 w-6 sm:w-7 p-0 rounded-md text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10"
                  title="Generate test cases"
                >
                  <MixerHorizontalIcon className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                </Button>
              )}

              {/* Mode Indicator */}
              <span className={cn(
                "hidden sm:inline-flex items-center gap-1 h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-medium",
                permissionMode === 'bypassPermissions'
                  ? "bg-amber-500/15 text-amber-400"
                  : permissionMode === 'plan'
                    ? "bg-purple-500/15 text-purple-400"
                    : "bg-muted/50 text-muted-foreground"
              )}>
                {permissionMode === 'bypassPermissions' ? 'Bypass' : permissionMode === 'plan' ? 'Plan' : 'Ask'}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto bg-card/30 p-2 sm:p-4 space-y-3 sm:space-y-4 font-mono text-xs sm:text-sm relative"
        >
          {loadingHistory && (
            <div className="absolute inset-0 bg-card/80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <UpdateIcon className="h-6 w-6 animate-spin text-cyan-500" />
                <span className="text-sm text-muted-foreground">Loading chat history...</span>
              </div>
            </div>
          )}
          
          {messages.length === 0 && !loadingHistory && (
            <div className="text-center text-muted-foreground py-8">
              <RocketIcon className="h-8 w-8 mx-auto mb-4 text-cyan-500/50" />
              <div className="mb-2 text-lg font-semibold">Welcome to developer chat</div>
              <div className="text-sm max-w-md mx-auto">
                Ask questions about your project, request code changes, or get help with debugging.
                All processing steps and tool usage will be shown in real-time.
              </div>
              
              {/* Permission Mode Selection for New Conversations */}
              <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border/50 max-w-sm mx-auto">
                <div className="text-sm font-medium mb-3 text-foreground">Choose Permission Mode:</div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setPermissionMode('interactive')}
                    className={cn(
                      "p-3 rounded-md border transition-all text-left",
                      permissionMode === 'interactive'
                        ? "border-gray-500 bg-gray-500/10 text-gray-300"
                        : "border-border hover:border-gray-500/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        permissionMode === 'interactive' ? "border-gray-500 bg-gray-500" : "border-gray-500"
                      )}>
                        {permissionMode === 'interactive' && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Interactive Mode</div>
                        <div className="text-xs text-muted-foreground">
                          Review and approve each tool use before execution
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setPermissionMode('bypassPermissions')}
                    className={cn(
                      "p-3 rounded-md border transition-all text-left",
                      permissionMode === 'bypassPermissions'
                        ? "border-amber-500 bg-amber-500/10 text-amber-500"
                        : "border-border hover:border-amber-500/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        permissionMode === 'bypassPermissions' ? "border-amber-500 bg-amber-500" : "border-gray-500"
                      )}>
                        {permissionMode === 'bypassPermissions' && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Bypass Mode</div>
                        <div className="text-xs text-muted-foreground">
                          Execute tools automatically without approval
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setPermissionMode('plan')}
                    className={cn(
                      "p-3 rounded-md border transition-all text-left",
                      permissionMode === 'plan'
                        ? "border-purple-500 bg-purple-500/10 text-purple-500"
                        : "border-border hover:border-purple-500/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        permissionMode === 'plan' ? "border-purple-500 bg-purple-500" : "border-gray-500"
                      )}>
                        {permissionMode === 'plan' && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Plan Mode</div>
                        <div className="text-xs text-muted-foreground">
                          Planning mode for architectural decisions
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  You can change this anytime using the Mode button above
                </div>
              </div>
              
              {sessionId && (
                <div className="mt-4 text-xs text-muted-foreground/70">
                  Session: {sessionId.slice(0, 8)}
                </div>
              )}
            </div>
          )}
          
          {/* Breakdown timeline is now shown inline within the parent message */}
          
          <AnimatePresence>
            {messages.filter(msg => msg.role !== 'hook').map((message) => {
              const hooks = messageHooks?.get(message.id) || []
              const hasHooks = hooks.length > 0
              
              return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 sm:space-y-3"
              >
                <div className="ml-0">
                  {/* Message Content - Modern X-style */}
                  <div className="space-y-2 sm:space-y-3">
                    {(message.role === 'user' || message.role === 'auto') ? (
                      <div className="group">
                        {/* Skip rendering sub-task messages - they're shown in the parent's timeline */}
                        {message.content?.metadata?.is_breakdown_subtask ? null : (
                          <>
                            {/* Main User Message Card */}
                            <div className={cn(
                              "rounded-xl border p-4 transition-all",
                              message.content?.metadata?.is_breakdown_parent
                                ? "bg-gradient-to-br from-slate-900/50 via-purple-900/20 to-slate-900/50 border-purple-500/30"
                                : "bg-gradient-to-br from-slate-900/30 to-slate-800/30 border-border/50 hover:border-cyan-500/30"
                            )}>
                              {/* Header */}
                              <div className="flex items-start gap-3 mb-3">
                                {/* Avatar */}
                                <div className={cn(
                                  "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
                                  "shadow-lg border border-white/10",
                                  message.role === 'auto'
                                    ? "bg-gradient-to-br from-amber-500 to-orange-600"
                                    : "bg-gradient-to-br from-cyan-500 to-blue-600"
                                )}>
                                  {message.role === 'auto' ? (
                                    <UpdateIcon className="h-4 w-4 text-white" />
                                  ) : (
                                    <PersonIcon className="h-4 w-4 text-white" />
                                  )}
                                </div>
                                {/* Name and time */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm text-foreground">
                                      {message.role === 'auto' ? 'Auto-continuation' : 'You'}
                                    </span>
                                    <span className="text-xs text-muted-foreground/60">
                                      {new Date(message.timestamp).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </span>
                                    {message.role === 'auto' && (
                                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                                        AI Generated
                                      </span>
                                    )}
                                    {message.content?.metadata?.is_breakdown_parent && (
                                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                        Task Breakdown
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Copy button */}
                                <button
                                  onClick={() => copyMessageContent(message)}
                                  className={cn(
                                    "opacity-0 group-hover:opacity-100 transition-opacity",
                                    "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  )}
                                >
                                  {copiedMessageId === message.id ? (
                                    <CheckCircledIcon className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <CopyIcon className="h-4 w-4" />
                                  )}
                                </button>
                              </div>

                              {/* Message Content */}
                              <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                {message.content?.text || (typeof message.content === 'string' ? message.content : '')}
                              </div>

                              {/* Planning Progress - Show when planning is/was in progress */}
                              {(() => {
                                const planningHooks = hooks?.filter((h: ChatHook) => h.hook_type === 'planning') || []
                                const isPlanningInProgress = message.content?.metadata?.planning_in_progress
                                const hadPlanning = message.content?.metadata?.planning_complete || planningHooks.length > 0

                                // Don't show if no planning happened
                                if (!isPlanningInProgress && !hadPlanning) return null

                                const totalHooks = planningHooks.length

                                return (
                                  <div className={cn(
                                    "mt-4 pt-4 border-t",
                                    isPlanningInProgress ? "border-cyan-500/20" : "border-green-500/20"
                                  )}>
                                    {/* Planning Header - Clickable */}
                                    <button
                                      onClick={() => setIsPlanningExpanded(!isPlanningExpanded)}
                                      className="w-full flex items-center justify-between mb-4 group"
                                    >
                                      <div className="flex items-center gap-2">
                                        {isPlanningInProgress ? (
                                          <>
                                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                            <span className="text-sm font-semibold text-cyan-400">
                                              📋 Planning Phase
                                            </span>
                                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                                              Analyzing codebase
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircledIcon className="w-4 h-4 text-green-500" />
                                            <span className="text-sm font-semibold text-green-400">
                                              📋 Planning Complete
                                            </span>
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                              {totalHooks} steps
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {totalHooks} steps
                                        </span>
                                        <ChevronDownIcon className={cn(
                                          "h-4 w-4 text-muted-foreground transition-transform",
                                          isPlanningExpanded && "rotate-180"
                                        )} />
                                      </div>
                                    </button>

                                    {/* Collapsible Planning Steps - Same style as sub-task hooks */}
                                    <AnimatePresence>
                                      {isPlanningExpanded && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="space-y-2"
                                        >
                                          {planningHooks.length > 0 ? (
                                            planningHooks.map((hook: ChatHook, hookIdx: number) => {
                                              const hookId = hook.id || `planning-hook-${hookIdx}`
                                              const isHookExpanded = expandedPlanningHookIds.has(hookId)
                                              const hookData = hook.data || {}
                                              const dataStatus = hookData.status || hook.status

                                              // Get preview text from data.result
                                              const preview = hookData.result || hookData.error || hook.message || ''
                                              const previewText = typeof preview === 'string' ? preview.substring(0, 60) : ''

                                              return (
                                                <div
                                                  key={hookId}
                                                  className={cn(
                                                    "rounded-md border text-xs overflow-hidden transition-all",
                                                    dataStatus === 'completed' && "border-green-500/20",
                                                    dataStatus === 'processing' && "border-cyan-500/20",
                                                    dataStatus === 'pending' && "border-border/30",
                                                    dataStatus === 'failed' && "border-red-500/20"
                                                  )}
                                                >
                                                  {/* Hook Header - Clickable */}
                                                  <button
                                                    onClick={() => {
                                                      const newSet = new Set(expandedPlanningHookIds)
                                                      if (isHookExpanded) {
                                                        newSet.delete(hookId)
                                                      } else {
                                                        newSet.add(hookId)
                                                      }
                                                      setExpandedPlanningHookIds(newSet)
                                                    }}
                                                    className={cn(
                                                      "w-full p-2 flex items-center gap-2 transition-colors",
                                                      dataStatus === 'completed' && "bg-green-500/10 hover:bg-green-500/15",
                                                      dataStatus === 'processing' && "bg-cyan-500/10 hover:bg-cyan-500/15",
                                                      dataStatus === 'pending' && "bg-muted/30 hover:bg-muted/40",
                                                      dataStatus === 'failed' && "bg-red-500/10 hover:bg-red-500/15"
                                                    )}
                                                  >
                                                    {/* Expand Icon */}
                                                    <motion.div
                                                      animate={{ rotate: isHookExpanded ? 90 : 0 }}
                                                      transition={{ duration: 0.15 }}
                                                      className="flex-shrink-0"
                                                    >
                                                      <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
                                                    </motion.div>

                                                    {/* Status Icon */}
                                                    {dataStatus === 'completed' ? (
                                                      <CheckCircledIcon className="h-3 w-3 text-green-400 flex-shrink-0" />
                                                    ) : dataStatus === 'processing' ? (
                                                      <UpdateIcon className="h-3 w-3 text-cyan-400 animate-spin flex-shrink-0" />
                                                    ) : dataStatus === 'failed' ? (
                                                      <CrossCircledIcon className="h-3 w-3 text-red-400 flex-shrink-0" />
                                                    ) : (
                                                      <ClockIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                    )}

                                                    {/* Hook Type */}
                                                    <span className="font-medium text-foreground truncate">
                                                      {hookData.type || hook.step_name || 'planning'}
                                                    </span>

                                                    {/* Tool Name Badge if available */}
                                                    {(hook.tool_name || hookData.tool_name) && (
                                                      <span className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground text-[10px] truncate max-w-[100px]">
                                                        {hook.tool_name || hookData.tool_name}
                                                      </span>
                                                    )}

                                                    {/* Preview when collapsed */}
                                                    {!isHookExpanded && previewText && (
                                                      <span className="text-muted-foreground text-[10px] truncate flex-1 text-left max-w-[200px]">
                                                        {previewText.length < (preview?.length || 0) ? `${previewText}...` : previewText}
                                                      </span>
                                                    )}

                                                    {/* Timestamp */}
                                                    {hookData.timestamp && (
                                                      <span className="text-muted-foreground/50 text-[10px] ml-auto flex-shrink-0">
                                                        {new Date(hookData.timestamp).toLocaleTimeString()}
                                                      </span>
                                                    )}
                                                  </button>

                                                  {/* Expanded Content */}
                                                  <AnimatePresence>
                                                    {isHookExpanded && (
                                                      <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="border-t border-border/30 bg-muted/20"
                                                      >
                                                        <div className="p-2 space-y-2">
                                                          {/* Result/Error content */}
                                                          {(hookData.result || hookData.error) && (
                                                            <div className="space-y-1">
                                                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                {hookData.error ? 'Error' : 'Result'}
                                                              </span>
                                                              <pre className={cn(
                                                                "text-[11px] font-mono whitespace-pre-wrap break-words p-2 rounded max-h-[500px] overflow-y-auto",
                                                                hookData.error ? "bg-red-500/10 text-red-300" : "bg-muted/30 text-foreground/80"
                                                              )}>
                                                                {typeof (hookData.result || hookData.error) === 'string'
                                                                  ? (hookData.result || hookData.error)
                                                                  : JSON.stringify(hookData.result || hookData.error, null, 2)}
                                                              </pre>
                                                            </div>
                                                          )}

                                                          {/* Message if no result */}
                                                          {!hookData.result && !hookData.error && hook.message && (
                                                            <div className="space-y-1">
                                                              <span className="text-[10px] font-medium text-muted-foreground uppercase">Message</span>
                                                              <p className="text-[11px] text-foreground/80">{hook.message}</p>
                                                            </div>
                                                          )}

                                                          {/* Additional metadata */}
                                                          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/60">
                                                            {hookData.message_type && (
                                                              <span className="px-1.5 py-0.5 bg-muted/30 rounded">{hookData.message_type}</span>
                                                            )}
                                                            {hookData.content_type && (
                                                              <span className="px-1.5 py-0.5 bg-muted/30 rounded">{hookData.content_type}</span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              )
                                            })
                                          ) : (
                                            /* Show loading if no hooks yet */
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-cyan-500/20 bg-cyan-500/10">
                                              <UpdateIcon className="h-3 w-3 text-cyan-400 animate-spin flex-shrink-0" />
                                              <span className="text-xs text-foreground">Starting analysis...</span>
                                            </div>
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )
                              })()}

                              {/* Breakdown Timeline - Inline under parent message */}
                              {message.content?.metadata?.is_breakdown_parent && breakdownStatus && (
                                <div className="mt-4 pt-4 border-t border-purple-500/20">
                                  {/* Timeline Header */}
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                      <span className="text-sm font-semibold text-purple-400">
                                        Sub-Tasks Pipeline
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {breakdownStatus.completed_sub_tasks} / {breakdownStatus.total_sub_tasks} completed
                                    </span>
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden mb-4">
                                    <motion.div
                                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(breakdownStatus.completed_sub_tasks / breakdownStatus.total_sub_tasks) * 100}%` }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>

                                  {/* Sub-tasks List */}
                                  <div className="space-y-2">
                                    {breakdownStatus.sub_task_sessions.map((subTask, idx) => {
                                      const isExpanded = expandedSubTaskId === subTask.session_id
                                      const canExpand = subTask.session_id && subTask.status !== 'pending'

                                      return (
                                        <motion.div
                                          key={subTask.session_id || idx}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: idx * 0.05 }}
                                          className="space-y-0"
                                        >
                                          {/* Clickable Sub-task Header */}
                                          <button
                                            onClick={() => {
                                              if (canExpand) {
                                                setExpandedSubTaskId(isExpanded ? null : subTask.session_id)
                                              }
                                            }}
                                            disabled={!canExpand}
                                            className={cn(
                                              "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                                              subTask.status === 'completed' && "bg-green-500/5 border-green-500/30",
                                              subTask.status === 'processing' && "bg-cyan-500/5 border-cyan-500/30",
                                              subTask.status === 'pending' && "bg-muted/20 border-border/30",
                                              subTask.status === 'failed' && "bg-red-500/5 border-red-500/30",
                                              canExpand && "cursor-pointer hover:bg-opacity-80",
                                              isExpanded && "rounded-b-none border-b-0"
                                            )}
                                          >
                                            {/* Status indicator */}
                                            <div className={cn(
                                              "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                                              subTask.status === 'completed' && "bg-green-500/20 text-green-400",
                                              subTask.status === 'processing' && "bg-cyan-500/20 text-cyan-400",
                                              subTask.status === 'pending' && "bg-muted/30 text-muted-foreground",
                                              subTask.status === 'failed' && "bg-red-500/20 text-red-400"
                                            )}>
                                              {subTask.status === 'completed' ? (
                                                <CheckCircledIcon className="h-4 w-4" />
                                              ) : subTask.status === 'processing' ? (
                                                <UpdateIcon className="h-4 w-4 animate-spin" />
                                              ) : subTask.status === 'failed' ? (
                                                <CrossCircledIcon className="h-4 w-4" />
                                              ) : (
                                                subTask.sequence
                                              )}
                                            </div>

                                            {/* Task info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-medium text-sm text-foreground truncate">
                                                  {subTask.title}
                                                </span>
                                                <span className={cn(
                                                  "text-xs px-1.5 py-0.5 rounded-full flex-shrink-0",
                                                  subTask.status === 'completed' && "bg-green-500/20 text-green-400",
                                                  subTask.status === 'processing' && "bg-cyan-500/20 text-cyan-400",
                                                  subTask.status === 'pending' && "bg-muted/30 text-muted-foreground",
                                                  subTask.status === 'failed' && "bg-red-500/20 text-red-400"
                                                )}>
                                                  {subTask.status}
                                                </span>
                                                {canExpand && (
                                                  <ChevronDownIcon className={cn(
                                                    "h-4 w-4 text-muted-foreground transition-transform ml-auto",
                                                    isExpanded && "rotate-180"
                                                  )} />
                                                )}
                                              </div>
                                              <p className="text-xs text-muted-foreground line-clamp-2">
                                                {subTask.description}
                                              </p>
                                              {subTask.started_at && (
                                                <div className="mt-1 text-xs text-muted-foreground/60">
                                                  Started: {new Date(subTask.started_at).toLocaleTimeString()}
                                                  {subTask.completed_at && (
                                                    <span className="ml-2">
                                                      • Completed: {new Date(subTask.completed_at).toLocaleTimeString()}
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </button>

                                          {/* Expanded Hooks View */}
                                          <AnimatePresence>
                                            {isExpanded && (
                                              <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className={cn(
                                                  "border border-t-0 rounded-b-lg overflow-hidden",
                                                  subTask.status === 'completed' && "border-green-500/30 bg-green-500/5",
                                                  subTask.status === 'processing' && "border-cyan-500/30 bg-cyan-500/5",
                                                  subTask.status === 'failed' && "border-red-500/30 bg-red-500/5"
                                                )}
                                              >
                                                <div className="p-3 space-y-3">
                                                  {/* Progress Header with Refresh Button */}
                                                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/30 pb-2">
                                                    <div className="flex items-center gap-2">
                                                      <CodeIcon className="h-3.5 w-3.5" />
                                                      <span>Execution Progress</span>
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        refetchSubTaskHooks()
                                                      }}
                                                      disabled={isRefetchingHooks}
                                                      className={cn(
                                                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all",
                                                        "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                                                        isRefetchingHooks && "opacity-50 cursor-not-allowed"
                                                      )}
                                                      title="Refresh progress"
                                                    >
                                                      <UpdateIcon className={cn("h-3 w-3", isRefetchingHooks && "animate-spin")} />
                                                      <span>{isRefetchingHooks ? 'Refreshing...' : 'Refresh'}</span>
                                                    </button>
                                                  </div>

                                                  {/* Success Summary for completed tasks */}
                                                  {subTask.status === 'completed' && subTask.result_summary && (
                                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                                      <div className="flex items-start gap-2">
                                                        <CheckCircledIcon className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                          <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium text-sm text-green-400">Task Completed</span>
                                                            {subTask.completed_at && (
                                                              <span className="text-xs text-muted-foreground">
                                                                {new Date(subTask.completed_at).toLocaleTimeString()}
                                                              </span>
                                                            )}
                                                          </div>
                                                          <p className="text-sm text-muted-foreground leading-relaxed">
                                                            {subTask.result_summary}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Success banner without summary */}
                                                  {subTask.status === 'completed' && !subTask.result_summary && (
                                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                                      <div className="flex items-center gap-2">
                                                        <CheckCircledIcon className="h-4 w-4 text-green-400" />
                                                        <span className="font-medium text-sm text-green-400">Task Completed Successfully</span>
                                                        {subTask.completed_at && (
                                                          <span className="text-xs text-muted-foreground ml-auto">
                                                            {new Date(subTask.completed_at).toLocaleTimeString()}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Failed banner */}
                                                  {subTask.status === 'failed' && (
                                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                      <div className="flex items-start gap-2">
                                                        <CrossCircledIcon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                          <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className="font-medium text-sm text-red-400">Task Failed</span>
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation()
                                                                if (sessionId && subTask.session_id) {
                                                                  retrySubTaskMutation.mutate({
                                                                    parentSessionId: sessionId,
                                                                    subTaskSessionId: subTask.session_id
                                                                  })
                                                                }
                                                              }}
                                                              disabled={retrySubTaskMutation.isPending}
                                                              className={cn(
                                                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                                                "bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200",
                                                                "border border-red-500/30 hover:border-red-500/40",
                                                                "disabled:opacity-50 disabled:cursor-not-allowed"
                                                              )}
                                                            >
                                                              {retrySubTaskMutation.isPending ? (
                                                                <span className="flex items-center gap-1.5">
                                                                  <UpdateIcon className="h-3 w-3 animate-spin" />
                                                                  Retrying...
                                                                </span>
                                                              ) : (
                                                                <span className="flex items-center gap-1.5">
                                                                  <UpdateIcon className="h-3 w-3" />
                                                                  Retry
                                                                </span>
                                                              )}
                                                            </button>
                                                          </div>
                                                          {subTask.result_summary && (
                                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                              {subTask.result_summary}
                                                            </p>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Hooks List */}
                                                  {expandedSubTaskHooks?.hooks && expandedSubTaskHooks.hooks.length > 0 ? (
                                                    <div className="space-y-2">
                                                      {expandedSubTaskHooks.hooks.map((hook: ChatHook, hookIdx: number) => {
                                                        const hookId = hook.id || `hook-${hookIdx}`
                                                        const isHookExpanded = expandedSubTaskHookIds.has(hookId)

                                                        return (
                                                          <div
                                                            key={hookId}
                                                            className={cn(
                                                              "rounded-md border text-xs overflow-hidden transition-all",
                                                              hook.status === 'completed' && "border-green-500/20",
                                                              hook.status === 'processing' && "border-cyan-500/20",
                                                              hook.status === 'pending' && "border-border/30",
                                                              hook.status === 'failed' && "border-red-500/20"
                                                            )}
                                                          >
                                                            {/* Hook Header - Clickable */}
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation()
                                                                setExpandedSubTaskHookIds(prev => {
                                                                  const next = new Set(prev)
                                                                  if (next.has(hookId)) {
                                                                    next.delete(hookId)
                                                                  } else {
                                                                    next.add(hookId)
                                                                  }
                                                                  return next
                                                                })
                                                              }}
                                                              className={cn(
                                                                "w-full p-2 flex items-center gap-2 transition-colors",
                                                                hook.status === 'completed' && "bg-green-500/10 hover:bg-green-500/15",
                                                                hook.status === 'processing' && "bg-cyan-500/10 hover:bg-cyan-500/15",
                                                                hook.status === 'pending' && "bg-muted/30 hover:bg-muted/40",
                                                                hook.status === 'failed' && "bg-red-500/10 hover:bg-red-500/15"
                                                              )}
                                                            >
                                                              {/* Expand Icon */}
                                                              <motion.div
                                                                animate={{ rotate: isHookExpanded ? 90 : 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex-shrink-0"
                                                              >
                                                                <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
                                                              </motion.div>

                                                              {/* Status Icon */}
                                                              {hook.status === 'completed' ? (
                                                                <CheckCircledIcon className="h-3 w-3 text-green-400 flex-shrink-0" />
                                                              ) : hook.status === 'processing' ? (
                                                                <UpdateIcon className="h-3 w-3 text-cyan-400 animate-spin flex-shrink-0" />
                                                              ) : hook.status === 'failed' ? (
                                                                <CrossCircledIcon className="h-3 w-3 text-red-400 flex-shrink-0" />
                                                              ) : (
                                                                <ClockIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                              )}

                                                              {/* Hook Type */}
                                                              <span className="font-medium text-foreground truncate">
                                                                {hook.hook_type || 'Hook'}
                                                              </span>

                                                              {/* Tool Name Badge if available */}
                                                              {(hook.tool_name || hook.data?.tool_name) && (
                                                                <span className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground text-[10px] truncate max-w-[100px]">
                                                                  {hook.tool_name || hook.data?.tool_name}
                                                                </span>
                                                              )}

                                                              {/* Preview when collapsed - prioritize data.result */}
                                                              {!isHookExpanded && (
                                                                <span className="text-muted-foreground text-[10px] truncate flex-1 text-left max-w-[200px]">
                                                                  {(() => {
                                                                    // Priority: data.result > data.error > message
                                                                    const preview = hook.data?.result || hook.data?.error || hook.message || ''
                                                                    if (!preview) return null
                                                                    const truncated = typeof preview === 'string' ? preview.substring(0, 60) : ''
                                                                    return truncated.length < (preview?.length || 0) ? `${truncated}...` : truncated
                                                                  })()}
                                                                </span>
                                                              )}

                                                              {/* Status Badge */}
                                                              <span className={cn(
                                                                "ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
                                                                hook.status === 'completed' && "bg-green-500/20 text-green-400",
                                                                hook.status === 'processing' && "bg-cyan-500/20 text-cyan-400",
                                                                hook.status === 'pending' && "bg-muted/50 text-muted-foreground",
                                                                hook.status === 'failed' && "bg-red-500/20 text-red-400",
                                                                hook.status === 'user_message' && "bg-purple-500/20 text-purple-400"
                                                              )}>
                                                                {hook.status}
                                                              </span>
                                                            </button>

                                                            {/* Expanded Content */}
                                                            <AnimatePresence>
                                                              {isHookExpanded && (
                                                                <motion.div
                                                                  initial={{ opacity: 0, height: 0 }}
                                                                  animate={{ opacity: 1, height: 'auto' }}
                                                                  exit={{ opacity: 0, height: 0 }}
                                                                  transition={{ duration: 0.15 }}
                                                                  className="overflow-hidden"
                                                                >
                                                                  <div className={cn(
                                                                    "p-3 border-t space-y-2",
                                                                    hook.status === 'completed' && "bg-green-500/5 border-green-500/20",
                                                                    hook.status === 'processing' && "bg-cyan-500/5 border-cyan-500/20",
                                                                    hook.status === 'pending' && "bg-muted/20 border-border/30",
                                                                    hook.status === 'failed' && "bg-red-500/5 border-red-500/20"
                                                                  )}>
                                                                    {/* Result/Message Content - Prioritize hook.data.result */}
                                                                    {(() => {
                                                                      // Priority: data.result > data.error > message
                                                                      const displayContent = hook.data?.result || hook.data?.error || hook.message
                                                                      if (!displayContent) return null
                                                                      return (
                                                                        <div>
                                                                          <div className="text-[10px] font-medium text-muted-foreground mb-1">
                                                                            {hook.data?.error ? 'Error:' : 'Result:'}
                                                                          </div>
                                                                          <div className={cn(
                                                                            "text-xs whitespace-pre-wrap break-words p-2 rounded",
                                                                            hook.data?.error
                                                                              ? "text-red-400 bg-red-500/10"
                                                                              : "text-foreground bg-muted/20"
                                                                          )}>
                                                                            {displayContent}
                                                                          </div>
                                                                        </div>
                                                                      )
                                                                    })()}

                                                                    {/* Tool Input if available */}
                                                                    {(hook.tool_input || hook.data?.tool_input) && (
                                                                      <div>
                                                                        <div className="text-[10px] font-medium text-muted-foreground mb-1">Tool Input:</div>
                                                                        <pre className="text-[10px] text-foreground bg-muted/30 p-2 rounded overflow-x-auto">
                                                                          {(() => {
                                                                            const toolInput = hook.tool_input || hook.data?.tool_input
                                                                            return typeof toolInput === 'string'
                                                                              ? toolInput
                                                                              : JSON.stringify(toolInput, null, 2)
                                                                          })()}
                                                                        </pre>
                                                                      </div>
                                                                    )}

                                                                    {/* Step Info if available */}
                                                                    {(hook.step_name || hook.step_index !== undefined) && (
                                                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                                        <span className="font-medium">Step:</span>
                                                                        {hook.step_name && <span>{hook.step_name}</span>}
                                                                        {hook.step_index !== undefined && hook.total_steps && (
                                                                          <span className="ml-auto">({hook.step_index + 1}/{hook.total_steps})</span>
                                                                        )}
                                                                      </div>
                                                                    )}

                                                                    {/* Task ID if available */}
                                                                    {hook.data?.task_id && (
                                                                      <div className="text-[10px] text-muted-foreground">
                                                                        <span className="font-medium">Task ID:</span> <code className="text-cyan-400">{hook.data.task_id.slice(0, 8)}...</code>
                                                                      </div>
                                                                    )}

                                                                    {/* Timestamp */}
                                                                    {hook.received_at && (
                                                                      <div className="text-[10px] text-muted-foreground">
                                                                        Received: {new Date(hook.received_at).toLocaleString()}
                                                                      </div>
                                                                    )}
                                                                  </div>
                                                                </motion.div>
                                                              )}
                                                            </AnimatePresence>
                                                          </div>
                                                        )
                                                      })}
                                                    </div>
                                                  ) : expandedSubTaskHooks?.messages && expandedSubTaskHooks.messages.length > 0 ? (
                                                    <div className="space-y-2">
                                                      {expandedSubTaskHooks.messages.map((msg: any, msgIdx: number) => {
                                                        const msgId = msg.id || `msg-${msgIdx}`
                                                        const isMsgExpanded = expandedSubTaskHookIds.has(msgId)

                                                        return (
                                                          <div
                                                            key={msgId}
                                                            className="rounded-md border border-border/30 text-xs overflow-hidden"
                                                          >
                                                            {/* Message Header - Clickable */}
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation()
                                                                setExpandedSubTaskHookIds(prev => {
                                                                  const next = new Set(prev)
                                                                  if (next.has(msgId)) {
                                                                    next.delete(msgId)
                                                                  } else {
                                                                    next.add(msgId)
                                                                  }
                                                                  return next
                                                                })
                                                              }}
                                                              className="w-full p-2 flex items-center gap-2 bg-muted/20 hover:bg-muted/30 transition-colors"
                                                            >
                                                              {/* Expand Icon */}
                                                              <motion.div
                                                                animate={{ rotate: isMsgExpanded ? 90 : 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex-shrink-0"
                                                              >
                                                                <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
                                                              </motion.div>

                                                              {/* Role Icon */}
                                                              {msg.role === 'user' ? (
                                                                <PersonIcon className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                                                              ) : (
                                                                <RocketIcon className="h-3 w-3 text-purple-400 flex-shrink-0" />
                                                              )}

                                                              {/* Role Label */}
                                                              <span className={cn(
                                                                "font-medium",
                                                                msg.role === 'user' ? "text-cyan-400" : "text-purple-400"
                                                              )}>
                                                                {msg.role === 'user' ? 'Request' : 'Response'}
                                                              </span>

                                                              {/* Preview */}
                                                              {!isMsgExpanded && (
                                                                <span className="text-muted-foreground truncate flex-1 text-left">
                                                                  {(msg.content?.text || (typeof msg.content === 'string' ? msg.content : 'Processing...')).substring(0, 50)}...
                                                                </span>
                                                              )}

                                                              {/* Timestamp */}
                                                              <span className="text-muted-foreground/60 ml-auto flex-shrink-0">
                                                                {new Date(msg.created_at).toLocaleTimeString()}
                                                              </span>
                                                            </button>

                                                            {/* Expanded Content */}
                                                            <AnimatePresence>
                                                              {isMsgExpanded && (
                                                                <motion.div
                                                                  initial={{ opacity: 0, height: 0 }}
                                                                  animate={{ opacity: 1, height: 'auto' }}
                                                                  exit={{ opacity: 0, height: 0 }}
                                                                  transition={{ duration: 0.15 }}
                                                                  className="overflow-hidden"
                                                                >
                                                                  <div className="p-3 border-t border-border/30 bg-muted/10">
                                                                    <p className="text-xs text-foreground whitespace-pre-wrap break-words">
                                                                      {msg.content?.text || (typeof msg.content === 'string' ? msg.content : 'Processing...')}
                                                                    </p>
                                                                  </div>
                                                                </motion.div>
                                                              )}
                                                            </AnimatePresence>
                                                          </div>
                                                        )
                                                      })}
                                                    </div>
                                                  ) : (
                                                    <div className="text-center py-4 text-xs text-muted-foreground">
                                                      {subTask.status === 'processing' ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                          <UpdateIcon className="h-4 w-4 animate-spin" />
                                                          <span>Processing...</span>
                                                        </div>
                                                      ) : (
                                                        'No execution details available'
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </motion.div>
                                      )
                                    })}
                                  </div>

                                  {/* Start button if not started */}
                                  {breakdownStatus.completed_sub_tasks === 0 &&
                                   !breakdownStatus.sub_task_sessions.some(t => t.status === 'processing') && (
                                    <button
                                      onClick={handleStartBreakdown}
                                      className="mt-4 w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
                                    >
                                      Start Processing Tasks
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        {/* Assistant Avatar */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                          <RocketIcon className="h-5 w-5 text-white" />
                        </div>
                        {/* Assistant Message */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">Assistant</span>
                            <span className="text-xs text-muted-foreground">
                              · {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                            {message.isProcessing && (
                              <MobileWaitingResponse
                                isWaiting={true}
                                isQueueProcessing={false}
                                queueLength={0}
                                className="ml-2"
                              />
                            )}
                            {/* Show if this is a response to an auto-continuation */}
                            {message.parentMessageId && messages.find(m => m.id === message.parentMessageId)?.role === 'auto' && (
                              <motion.span 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full flex items-center gap-1"
                              >
                                <UpdateIcon className="h-3 w-3" />
                                Auto-generated response
                              </motion.span>
                            )}
                          </div>
                          <div className="text-[15px] leading-relaxed">
                            <AssistantMessage
                              message={message}
                              hooks={messageHooks?.get(message.id) || []}
                              onToggleHook={toggleHookExpansion}
                              expandedHooks={expandedHooks}
                              getHookIcon={getHookIcon}
                              formatHookMessage={formatHookMessage}
                              isWaitingForResponse={isWaitingForResponse}
                              onRetry={(chatId) => retryChatMutation.mutate(chatId)}
                              isRetrying={retryChatMutation.isPending}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Webhook Logs - modern style */}
                    {message.role === 'assistant' && hasHooks && showAllHooks && (
                      <div className="ml-[52px] space-y-2 border-l-2 border-border/30 pl-4">
                        <div className="text-xs text-muted-foreground mb-2">Processing logs:</div>
                        {hooks.map((hook, hookIndex) => {
                          const isExpanded = expandedHooks.has(hook.id)
                          return (
                            <motion.div
                              key={hook.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: hookIndex * 0.05 }}
                              className="text-xs"
                            >
                              <button
                                onClick={() => toggleHookExpansion(hook.id)}
                                className="w-full text-left hover:bg-muted/20 rounded p-2 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  {getHookIcon(hook)}
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">
                                        {formatHookMessage(hook)}
                                      </span>
                                      {hook.data?.duration_ms && (
                                        <span className="text-[10px] text-muted-foreground/70">
                                          {hook.data.duration_ms}ms
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Tool input preview */}
                                    {hook.tool_name && hook.data?.tool_input && (
                                      <div className="text-[10px] text-muted-foreground/70 mt-1">
                                        {JSON.stringify(hook.data.tool_input).substring(0, 100)}...
                                      </div>
                                    )}
                                  </div>
                                  <ChevronDownIcon className={cn(
                                    "h-3 w-3 transition-transform",
                                    isExpanded && "rotate-180"
                                  )} />
                                </div>
                              </button>
                              
                              {/* Expanded details */}
                              {isExpanded && hook.data && (
                                <div className="mt-2 ml-5 space-y-2">
                                  {hook.data.tool_input && (
                                    <div>
                                      <div className="text-[10px] text-muted-foreground mb-1">Input:</div>
                                      <pre className="bg-black/30 p-2 rounded text-[10px] overflow-x-auto">
                                        <code>{JSON.stringify(hook.data.tool_input, null, 2)}</code>
                                      </pre>
                                    </div>
                                  )}
                                  {hook.data.result && (
                                    <div>
                                      <div className="text-[10px] text-muted-foreground mb-1">Result:</div>
                                      <pre className="bg-black/30 p-2 rounded text-[10px] overflow-x-auto max-h-40">
                                        <code>{typeof hook.data.result === 'string' ? hook.data.result : JSON.stringify(hook.data.result, null, 2)}</code>
                                      </pre>
                                    </div>
                                  )}
                                  {hook.data.error && (
                                    <div>
                                      <div className="text-[10px] text-red-400 mb-1">Error:</div>
                                      <pre className="bg-red-900/20 p-2 rounded text-[10px] overflow-x-auto border border-red-500/20">
                                        <code>{hook.data.error}</code>
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} style={{ height: '1px' }} />
          
          {/* New Message Indicator - appears when auto-scroll is disabled and there are new messages */}
          <AnimatePresence>
            {showNewMessageIndicator && !autoScrollEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10"
              >
                <button
                  onClick={scrollToBottomManually}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-cyan-400/30 text-sm font-medium group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>New messages below</span>
                    <ChevronDownIcon className="h-4 w-4 group-hover:translate-y-0.5 transition-transform duration-200" />
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Message Queue Display removed - input is now blocked when waiting for response */}

        {/* Beautiful Modern Input Area */}
        <div className={cn(
          "border-t transition-all duration-300",
          isWaitingForResponse 
            ? "border-border/30 bg-gradient-to-b from-black/60 to-black/80" 
            : "border-border/50 bg-gradient-to-b from-black/40 to-black/60 hover:from-black/50 hover:to-black/70",
          "backdrop-blur-md shadow-lg"
        )}>
          <form onSubmit={handleSubmit} className="p-4 sm:p-5">
            <div className="relative">
              {/* Main Input Container with Enhanced Styling */}
              <div className={cn(
                "relative rounded-2xl transition-all duration-300",
                input.trim() || isWaitingForResponse
                  ? "bg-card/40 ring-2 ring-cyan-500/30"
                  : "bg-card/20 ring-1 ring-border/50 hover:ring-border/80 hover:bg-card/30"
              )}>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    if (isWaitingForResponse) return
                    setInput(e.target.value)
                    // Auto-resize textarea
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto'
                      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
                    }
                  }}
                  onKeyDown={(e) => {
                    if (isWaitingForResponse) {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                      }
                      return
                    }
                    // Submit on Enter (without modifiers)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }
                  }}
                  placeholder={
                    isWaitingForResponse
                      ? "⏳ Processing your request..."
                      : "Describe what you'd like to build or fix..."
                  }
                  disabled={isWaitingForResponse}
                  className={cn(
                    "w-full bg-transparent border-0 focus:ring-0 resize-none",
                    "placeholder:text-muted-foreground/60 text-base leading-relaxed",
                    "font-sans min-h-[56px] max-h-[240px] px-4 pt-4 pb-3",
                    "transition-all duration-200",
                    isWaitingForResponse && "cursor-not-allowed opacity-60"
                  )}
                  rows={1}
                  style={{
                    outline: 'none',
                    boxShadow: 'none',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgb(6 182 212 / 0.3) transparent'
                  }}
                />
              </div>
              
              {/* Enhanced Controls Bar */}
              <div className="flex items-center justify-between mt-4 gap-3">
                <div className="flex items-center gap-2">
                  {/* Quick Action Buttons */}
                  <button
                    type="button"
                    disabled={isWaitingForResponse}
                    className={cn(
                      "group relative text-muted-foreground transition-all duration-200",
                      "p-2 rounded-xl hover:bg-cyan-500/10 hover:text-cyan-400",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    )}
                    title="Add code snippet"
                  >
                    <CodeIcon className="h-4 w-4" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 
                      text-xs bg-black/90 text-white rounded-lg opacity-0 group-hover:opacity-100 
                      transition-opacity whitespace-nowrap pointer-events-none">
                      Code snippet
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isWaitingForResponse}
                    className={cn(
                      "group relative text-muted-foreground transition-all duration-200",
                      "p-2 rounded-xl hover:bg-cyan-500/10 hover:text-cyan-400",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    )}
                    title="Add file reference"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 
                      text-xs bg-black/90 text-white rounded-lg opacity-0 group-hover:opacity-100 
                      transition-opacity whitespace-nowrap pointer-events-none">
                      File reference
                    </span>
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Character/status indicator */}
                  {input.length > 0 && !isWaitingForResponse && (
                    <span className={cn(
                      "text-xs transition-colors",
                      input.length > 500 ? "text-orange-500" : "text-muted-foreground"
                    )}>
                      {input.length}
                    </span>
                  )}

                  {/* Mode selector dropdown - disabled when waiting */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        disabled={isWaitingForResponse}
                        className={cn(
                          "h-8 sm:h-9 px-2 sm:px-3 rounded-full text-xs font-medium flex items-center gap-1 min-w-0",
                          isWaitingForResponse
                            ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                            : permissionMode === 'bypassPermissions'
                              ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                              : permissionMode === 'plan'
                                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                        )}
                        size="sm"
                      >
                        <GearIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[60px] sm:max-w-none">
                          {permissionMode === 'bypassPermissions' ? 'Bypass' : permissionMode === 'plan' ? 'Plan' : 'Interactive'}
                        </span>
                        <ChevronDownIcon className="h-3 w-3 flex-shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setPermissionMode('interactive')}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            permissionMode === 'interactive' ? "bg-gray-500" : "bg-transparent border border-gray-500"
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">Interactive</div>
                            <div className="text-xs text-muted-foreground">Approval required</div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPermissionMode('bypassPermissions')}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            permissionMode === 'bypassPermissions' ? "bg-amber-500" : "bg-transparent border border-amber-500"
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">Bypass</div>
                            <div className="text-xs text-muted-foreground">Auto-execute tools</div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPermissionMode('plan')}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            permissionMode === 'plan' ? "bg-purple-500" : "bg-transparent border border-purple-500"
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">Plan</div>
                            <div className="text-xs text-muted-foreground">Planning mode</div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Agent selector dropdown - disabled when waiting */}
                  <div className="relative" ref={agentDropdownRef}>
                    <Button
                      type="button"
                      onClick={() => !isWaitingForResponse && setShowAgentDropdown(!showAgentDropdown)}
                      disabled={isWaitingForResponse}
                      className={cn(
                        "h-8 sm:h-9 px-2 sm:px-3 rounded-full text-xs font-medium flex items-center gap-1 min-w-0",
                        isWaitingForResponse
                          ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                          : selectedAgent
                            ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                      size="sm"
                    >
                      <ChatBubbleIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[80px] sm:max-w-none">
                        {selectedAgent
                          ? AVAILABLE_AGENTS.find(a => a.value === selectedAgent)?.label
                          : 'Agent'}
                      </span>
                      <ChevronDownIcon className={cn(
                        "h-3 w-3 transition-transform flex-shrink-0",
                        showAgentDropdown && "rotate-180"
                      )} />
                    </Button>
                    
                    {/* Dropdown menu */}
                    {showAgentDropdown && (
                      <div className="fixed inset-x-4 bottom-20 sm:absolute sm:bottom-full sm:right-0 sm:left-auto sm:inset-x-auto mb-2 
                        w-auto sm:w-96 bg-card backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-3 z-50 
                        max-h-[75vh] sm:max-h-[70vh] overflow-y-auto">
                        
                        {/* Header */}
                        <div className="mb-3 px-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                                AI Agents
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">Choose your coding assistant</p>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/80 px-2 py-1 rounded-md">
                              {AVAILABLE_AGENTS.length} available
                            </div>
                          </div>
                        </div>

                        {/* Agent Grid */}
                        <div className="space-y-2">
                          {AVAILABLE_AGENTS.map((agent, index) => (
                            <button
                              key={agent.value || 'default'}
                              onClick={() => {
                                setSelectedAgent(agent.value)
                                setShowAgentDropdown(false)
                              }}
                              className={cn(
                                "w-full text-left p-4 rounded-xl transition-all duration-300 touch-manipulation group",
                                "border-2 border-transparent hover:border-cyan-500/20 hover:shadow-lg",
                                "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30",
                                selectedAgent === agent.value 
                                  ? "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-purple-500/40 shadow-md" 
                                  : "bg-muted/60 hover:bg-muted/80"
                              )}
                            >
                              <div className="flex items-start gap-4">
                                {/* Agent Icon */}
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                                  selectedAgent === agent.value 
                                    ? "bg-gradient-to-br from-purple-500/60 to-cyan-500/60 text-white shadow-lg" 
                                    : "bg-muted text-muted-foreground group-hover:bg-cyan-500/30 group-hover:text-cyan-300"
                                )}>
                                  <ChatBubbleIcon className="h-5 w-5" />
                                </div>
                                
                                {/* Agent Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-bold text-sm text-foreground truncate">{agent.label}</h4>
                                    {selectedAgent === agent.value && (
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center ml-2">
                                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed group-hover:text-muted-foreground/80">
                                    {agent.description}
                                  </p>
                                  {/* Quick tags for developer context */}
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {agent.value === null && (
                                      <span className="text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-md">General</span>
                                    )}
                                    {agent.value === '@agent-frontend-component-builder' && (
                                      <>
                                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md">React</span>
                                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-md">UI/UX</span>
                                      </>
                                    )}
                                    {agent.value === '@agent-backend-architect' && (
                                      <>
                                        <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-md">API</span>
                                        <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-md">Database</span>
                                      </>
                                    )}
                                    {agent.value === '@agent-code-review-tester' && (
                                      <>
                                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-md">Testing</span>
                                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md">Quality</span>
                                      </>
                                    )}
                                    {agent.value === '@agent-docs-generator' && (
                                      <span className="text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-md">Documentation</span>
                                    )}
                                    {agent.value === '@agent-product-manager-planner' && (
                                      <>
                                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md">Planning</span>
                                        <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-md">Strategy</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        
                        {/* Footer */}
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <p className="text-xs text-muted-foreground text-center">
                            💡 Each agent specializes in different aspects of development
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Send Button */}
                  <div className="flex items-center gap-1 relative group">
                    <Button
                      type="submit"
                      disabled={!input.trim() || isWaitingForResponse}
                      className={cn(
                        "rounded-full h-10 w-10 sm:h-10 sm:w-auto sm:px-5 transition-all duration-300",
                        "font-semibold text-sm gap-2 shadow-lg touch-manipulation",
                        "relative overflow-hidden",
                        isWaitingForResponse
                          ? "bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-500/30"
                          : input.trim()
                            ? "bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-black shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95"
                            : "bg-cyan-500/10 text-cyan-500/40 cursor-not-allowed border border-cyan-500/20"
                      )}
                      size="sm"
                      title={
                        isWaitingForResponse
                          ? "Processing your request..."
                          : input.trim()
                            ? "Send message (1 credit) • Press Enter"
                            : "Type a message to send"
                      }
                    >
                      {/* Button glow effect */}
                      {input.trim() && !isWaitingForResponse && (
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-500 opacity-0 group-hover:opacity-20 blur transition-opacity" />
                      )}
                      
                      {isWaitingForResponse ? (
                        <>
                          <UpdateIcon className="h-4 w-4 sm:hidden animate-spin" />
                          <span className="hidden sm:inline-flex items-center gap-2">
                            <UpdateIcon className="h-4 w-4 animate-spin" />
                            Processing
                          </span>
                        </>
                      ) : (
                        <>
                          <PaperPlaneIcon className={cn(
                            "h-4 w-4 sm:hidden transition-transform",
                            input.trim() && "group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          )} />
                          <span className="hidden sm:inline-flex items-center gap-2 relative z-10">
                            <PaperPlaneIcon className={cn(
                              "h-4 w-4 transition-transform",
                              input.trim() && "group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            )} />
                            Send
                            <CreditCost cost={1} variant="badge-subtle" />
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Enhanced Status Indicator */}
              <div className="mt-4">
                {isMobile ? (
                  <MobileInputStatus
                    isWaiting={isWaitingForResponse}
                    isQueueProcessing={false}
                    queueLength={0}
                    inputLength={input.length}
                    showHints={false}
                  />
                ) : (
                  <div className="text-xs transition-all duration-200">
                    {isWaitingForResponse ? (
                      <div className="flex items-center gap-2 text-amber-400/90 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/20">
                        <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
                        <span className="font-medium">Processing your request... Please wait for completion before sending another message.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-3 text-muted-foreground/60">
                          <span className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border/50">Enter</kbd>
                            to send
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border/50">Shift+Enter</kbd>
                            new line
                          </span>
                        </div>
                        <CreditCost cost={1} variant="context" showWarning={false} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Test Case Generation Modal */}
      {sessionId && (
        <TestCaseGenerationModal
          isOpen={showTestCaseModal}
          onClose={() => setShowTestCaseModal(false)}
          sessionId={sessionId}
          taskId={taskId}
        />
      )}

      {/* Floating waiting indicator for mobile */}
      <FloatingWaitingIndicator
        isVisible={isMobile && isWaitingForResponse}
        isQueueProcessing={false}
        queueLength={0}
      />

      {/* Approval modals removed - approvals are now handled globally via ApprovalNotifications component */}
    </div>
  )
}
