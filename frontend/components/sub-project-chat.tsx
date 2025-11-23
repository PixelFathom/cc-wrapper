'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneIcon, PersonIcon, RocketIcon, UpdateIcon, ChevronRightIcon,
  CodeIcon, GearIcon, CheckCircledIcon, CrossCircledIcon, ClockIcon,
  FileTextIcon, CubeIcon, ChevronDownIcon, DotFilledIcon, CopyIcon,
  ChatBubbleIcon, MixerHorizontalIcon
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
        response_session_id: data.session_id
      })
      
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
    refetchInterval: isWaitingForResponse ? 3000 : 5000,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  })

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

  const sessionTabs = useMemo(() => {
    const baseSessions = Array.isArray(sessions) ? [...sessions] : []
    if (sessionId && !baseSessions.some((session) => session.session_id === sessionId)) {
      const firstUserMessage = messages.find((msg) => msg.role === 'user')
      const messagePreview = firstUserMessage ? contentToText(firstUserMessage.content) : ''
      baseSessions.unshift({
        session_id: sessionId,
        first_message: messagePreview || 'Active session',
        message_count: messages.length,
        created_at: firstUserMessage?.timestamp,
        isVirtual: true,
      })
    }
    return baseSessions
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
                      <div className="flex gap-3">
                        {/* User Avatar */}
                        <div className={cn(
                          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                          message.role === 'auto' 
                            ? "bg-gradient-to-br from-amber-500 to-orange-600"
                            : "bg-gradient-to-br from-cyan-500 to-blue-600"
                        )}>
                          {message.role === 'auto' ? (
                            <UpdateIcon className="h-5 w-5 text-white" />
                          ) : (
                            <PersonIcon className="h-5 w-5 text-white" />
                          )}
                        </div>
                        {/* User Message */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{message.role === 'auto' ? 'Auto-continuation' : 'You'}</span>
                            <span className="text-xs text-muted-foreground">
                              · {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </span>
                            {message.role === 'auto' && (
                              <motion.span 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full flex items-center gap-1"
                              >
                                <UpdateIcon className="h-3 w-3 animate-pulse" />
                                AI Generated
                              </motion.span>
                            )}
                          </div>
                          <div className="text-[15px] leading-relaxed text-foreground">
                            {message.content.text || message.content}
                          </div>
                          {/* Copy button */}
                          <div className="mt-2">
                            <button
                              onClick={() => copyMessageContent(message)}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                                "transition-all duration-200",
                                "border border-transparent",
                                copiedMessageId === message.id
                                  ? "bg-green-500/20 text-green-500 border-green-500/30"
                                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground hover:border-border/50"
                              )}
                            >
                              {copiedMessageId === message.id ? (
                                <>
                                  <CheckCircledIcon className="h-3 w-3" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <CopyIcon className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
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

        {/* Modern X-style Input Area */}
        <div className={cn(
          "border-t border-border/50 bg-black/40 backdrop-blur-sm transition-all duration-200",
          isWaitingForResponse && "opacity-60 bg-black/70"
        )}>
          {/* Pending Response Overlay */}
          <form onSubmit={handleSubmit} className="p-3 sm:p-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  // Block input changes when waiting for response
                  if (isWaitingForResponse) return
                  setInput(e.target.value)
                  // Auto-resize textarea
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto'
                    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
                  }
                }}
                onKeyDown={(e) => {
                  // Block all submissions when waiting for response
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
                    ? "⏳ Please wait for the current response to complete..."
                    : "What's happening with your code?"
                }
                disabled={isWaitingForResponse}
                className={cn(
                  "w-full bg-transparent border-0 focus:ring-0 resize-none",
                  "placeholder:text-muted-foreground/50 text-base leading-relaxed",
                  "font-sans min-h-[24px] max-h-[200px] p-0 pr-12",
                  isWaitingForResponse && "cursor-not-allowed opacity-50"
                )}
                rows={1}
                style={{
                  outline: 'none',
                  boxShadow: 'none',
                  scrollbarWidth: 'thin'
                }}
              />
              
              {/* Character count and send button area */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  {/* Add icons like X has for media, GIF, poll, etc - but for code context */}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-cyan-500 transition-colors p-1.5 rounded-full hover:bg-cyan-500/10"
                    title="Add code snippet"
                  >
                    <CodeIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-cyan-500 transition-colors p-1.5 rounded-full hover:bg-cyan-500/10"
                    title="Add file reference"
                  >
                    <FileTextIcon className="h-4 w-4" />
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
                  
                  {/* Send Button - disabled when waiting for response */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="submit"
                      disabled={!input.trim() || isWaitingForResponse}
                      className={cn(
                        "rounded-full h-9 w-9 sm:h-9 sm:w-auto sm:px-4 transition-all duration-200 touch-manipulation",
                        "font-medium text-sm gap-2",
                        isWaitingForResponse
                          ? "bg-gray-500/30 text-gray-500 cursor-not-allowed"
                          : input.trim()
                            ? "bg-cyan-500 hover:bg-cyan-600 text-black"
                            : "bg-cyan-500/20 text-cyan-500/50 cursor-not-allowed"
                      )}
                      size="sm"
                      title={
                        isWaitingForResponse
                          ? "Please wait for the current response to complete"
                          : "Send message (1 credit) - Press Enter"
                      }
                    >
                      {isWaitingForResponse ? (
                        <>
                          <ClockIcon className="h-4 w-4 sm:hidden" />
                          <span className="hidden sm:inline">Wait...</span>
                        </>
                      ) : (
                        <>
                          <PaperPlaneIcon className="h-4 w-4 sm:hidden" />
                          <span className="hidden sm:inline-flex items-center gap-1.5">
                            Send
                            <CreditCost cost={1} variant="badge-subtle" />
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Combined status indicator with mobile optimization and credit cost */}
              <div className="mt-2">
                {isMobile ? (
                  <MobileInputStatus
                    isWaiting={isWaitingForResponse}
                    isQueueProcessing={false}
                    queueLength={0}
                    inputLength={input.length}
                    showHints={false}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground/50">
                    {isWaitingForResponse ? (
                      <div className="flex items-center gap-2 text-amber-500">
                        <UpdateIcon className="h-3 w-3 animate-spin" />
                        <span>Processing... Please wait for the response to complete before sending another message.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span>Press Enter to send • Shift+Enter for new line</span>
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
