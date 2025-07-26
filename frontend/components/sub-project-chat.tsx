'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PaperPlaneIcon, PersonIcon, RocketIcon, UpdateIcon, ChevronRightIcon,
  CodeIcon, GearIcon, CheckCircledIcon, CrossCircledIcon, ClockIcon,
  FileTextIcon, CubeIcon, ChevronDownIcon, DotFilledIcon, CopyIcon
} from '@radix-ui/react-icons'
import { api, ChatHook } from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { cn } from '@/lib/utils'
import { AssistantMessage } from './assistant-message'

interface SubProjectChatProps {
  projectName: string
  taskName: string
  subProjectId: string
  initialSessionId?: string
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

export function SubProjectChat({ projectName, taskName, subProjectId, initialSessionId }: SubProjectChatProps) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatId, setChatId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set())
  // Collapse all hooks by default for cleaner UI
  const [showAllHooks, setShowAllHooks] = useState(false)
  const [autoContinuationEnabled, setAutoContinuationEnabled] = useState(true)
  const [bypassModeEnabled, setBypassModeEnabled] = useState(() => {
    // Load bypass mode preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bypassModeEnabled')
      return saved !== null ? saved === 'true' : true // Default to true if not set
    }
    return true
  })
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const cwd = `${projectName}/${taskName}`
  
  // Session state persistence key
  const sessionStorageKey = `chat-session-${cwd}-${subProjectId}`
  
  // Simple session state - use initialSessionId if provided, otherwise null
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null)

  // Check if this is a new chat (temporary ID)
  const isNewChat = subProjectId.startsWith('new-')
  
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
  
  // Save bypass mode preference to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bypassModeEnabled', bypassModeEnabled.toString())
    }
  }, [bypassModeEnabled])
  
  // Load initial session messages if provided
  useEffect(() => {
    if (initialSessionId && !messages.length) {
      console.log('📚 Loading initial chat history for session:', initialSessionId)
      loadChatHistory(initialSessionId)
    }
  }, [initialSessionId])
  
  // Load bypass mode preference from session metadata
  useEffect(() => {
    if (messages.length > 0) {
      // Find the last assistant message to get bypass mode preference
      const assistantMessages = messages.filter(m => m.role === 'assistant' && m.content?.metadata)
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
      
      if (lastAssistantMessage && lastAssistantMessage.content?.metadata?.bypass_mode_enabled !== undefined) {
        setBypassModeEnabled(lastAssistantMessage.content.metadata.bypass_mode_enabled)
      }
    }
  }, [messages])
  
  // Fetch sessions for this sub-project (only if it's not a new chat)
  const { data: sessionsData } = useQuery({
    queryKey: ['sub-project-sessions', subProjectId],
    queryFn: () => api.getSubProjectSessions(subProjectId),
    enabled: !!subProjectId && !isNewChat, // Skip for new chats
    refetchInterval: 10000, // Refresh every 10 seconds
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
        bypass_mode: bypassModeEnabled,
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
      console.log('✅ Query sent successfully:', {
        session_id: data.session_id,
        chat_id: data.chat_id,
        was_first_message: !sessionId
      })
      
      // Only update sessionId if this was the first message
      // Note: We already updated sessionId in handleSubmit if needed, so this is just for the first message
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id)
      }
      
      if (data.chat_id) {
        setChatId(data.chat_id)
      }
    },
  })

  // Poll for messages in the current session
  // Check if we're waiting for a response
  const isWaitingForResponse = messages.some(msg => 
    msg.role === 'assistant' && (msg.isProcessing || !msg.content?.text || msg.content?.text === '')
  ) || sendMutation.isPending
  
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
    refetchInterval: isWaitingForResponse ? 1000 : 2000, // Poll every 1s when waiting, 2s otherwise
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
    refetchInterval: isWaitingForResponse ? 1000 : 2000,
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
                continuationStatus: newMsg.continuationStatus
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Small delay to ensure DOM is updated before scrolling
    scrollToBottom()
  }, [messages])
  
  // Also scroll when hooks are expanded/collapsed or when waiting for response changes
  useEffect(() => {
    scrollToBottom()
  }, [expandedHooks, showAllHooks, isWaitingForResponse])
  
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
      setShowSessions(false)
      
      // Find the chat ID from the first message
      if (historyMessages.length > 0) {
        setChatId(historyMessages[0].id)
      }
      
      // Scroll to bottom after loading history
      scrollToBottom('auto')
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
    setShowSessions(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userInput = input
    setInput('')
    
    // Reset textarea height after clearing input
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = '24px' // Reset to min-height
    }
    
    // For user-initiated messages, we need to use the session ID from the last assistant message
    // This ensures proper conversation continuity
    let sessionIdToUse = sessionId
    
    // Find the last assistant message to get the correct session ID for the next message
    const assistantMessages = messages.filter(m => m.role === 'assistant' && m.content?.text)
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
    
    if (lastAssistantMessage && lastAssistantMessage.content?.metadata) {
      const metadata = lastAssistantMessage.content.metadata
      // Use next_session_id if available (from ResultMessage), otherwise use webhook_session_id
      const nextSessionId = metadata.next_session_id || metadata.webhook_session_id
      
      if (nextSessionId && nextSessionId !== sessionIdToUse) {
        console.log('📌 Using session ID from last assistant message:', {
          currentSessionId: sessionIdToUse,
          nextSessionId: nextSessionId,
          source: metadata.next_session_id ? 'next_session_id' : 'webhook_session_id'
        })
        sessionIdToUse = nextSessionId
        
        // Also update the UI session ID state to stay in sync
        setSessionId(nextSessionId)
      }
    }
    
    console.log('📨 Submitting message:', {
      session_id: sessionIdToUse || 'none (first message)',
      messageCount: messages.length,
      hasLastAssistant: !!lastAssistantMessage
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
    
    // Scroll to bottom after sending message with a slight delay
    setTimeout(() => {
      scrollToBottom()
    }, 100)
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

  // Scroll to bottom helper function
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
        // Also ensure the parent container scrolls to bottom as a fallback
        const messagesContainer = messagesEndRef.current.parentElement
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }
    }, 100)
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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)]">
      <div className="flex-1 overflow-hidden flex flex-col gradient-border-neon rounded-lg relative bg-black/30">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">developer-chat</span>
            {/* Bypass Mode Indicator */}
            <div className={cn(
              "flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full border",
              bypassModeEnabled 
                ? "bg-amber-500/20 border-amber-500/30" 
                : "bg-gray-500/20 border-gray-500/30"
            )}>
              <GearIcon className={cn(
                "h-3 w-3",
                bypassModeEnabled ? "text-amber-500" : "text-gray-500"
              )} />
              <span className={cn(
                "text-[10px] font-mono",
                bypassModeEnabled ? "text-amber-500" : "text-gray-500"
              )}>
                Bypass {bypassModeEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Bypass Mode toggle - Always visible */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const newState = !bypassModeEnabled
                setBypassModeEnabled(newState)
                // Only call API if we have an active session
                if (sessionId) {
                  try {
                    await api.toggleBypassMode(sessionId, newState)
                  } catch (error) {
                    console.error('Failed to toggle bypass mode:', error)
                    setBypassModeEnabled(!newState) // Revert on error
                  }
                }
              }}
              className="text-xs font-mono h-6 px-1 sm:px-2 flex items-center gap-1"
              title={bypassModeEnabled ? 'Bypass mode enabled' : 'Bypass mode disabled'}
            >
              <GearIcon className={cn(
                "h-3 w-3",
                bypassModeEnabled ? "text-amber-500" : "text-gray-500"
              )} />
              <span className="hidden sm:inline">Bypass</span>
            </Button>
            {/* Auto-continuation toggle */}
            {sessionId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const newState = !autoContinuationEnabled
                  setAutoContinuationEnabled(newState)
                  try {
                    await api.toggleAutoContinuation(sessionId, newState)
                  } catch (error) {
                    console.error('Failed to toggle auto-continuation:', error)
                    setAutoContinuationEnabled(!newState) // Revert on error
                  }
                }}
                className="text-xs font-mono h-6 px-1 sm:px-2 flex items-center gap-1"
                title={autoContinuationEnabled ? 'Auto-continuation enabled' : 'Auto-continuation disabled'}
              >
                <UpdateIcon className={cn(
                  "h-3 w-3",
                  autoContinuationEnabled ? "text-green-500" : "text-gray-500"
                )} />
                <span className="hidden sm:inline">Auto</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSessions(!showSessions)}
              className="text-xs font-mono h-6 px-1 sm:px-2"
            >
              <span className="hidden sm:inline">{sessions.length} sessions</span>
              <span className="sm:hidden">{sessions.length}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewSession}
              className="text-xs font-mono h-6 px-1 sm:px-2"
            >
              <span className="hidden sm:inline">+ New</span>
              <span className="sm:hidden">+</span>
            </Button>
            {sessionId && (
              <>
                <span className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  sessionError ? "bg-red-500" : "bg-green-500"
                )}></span>
                <span className={cn(
                  "text-xs font-mono hidden md:inline",
                  sessionError ? "text-red-500" : "text-green-500"
                )}>
                  session:{sessionId.slice(0, 8)}
                  {sessionError && " (error)"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Sessions Dropdown */}
        {showSessions && (
          <div className="absolute top-12 right-2 sm:right-4 z-50 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-2 max-h-64 overflow-y-auto min-w-[280px] sm:min-w-[300px] max-w-[calc(100vw-2rem)]">
            <div className="text-xs font-mono text-muted-foreground mb-2 px-2">Chat Sessions:</div>
            {sessions.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">No sessions yet</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.session_id}
                  onClick={() => loadChatHistory(session.session_id)}
                  className={cn(
                    "w-full text-left p-2 hover:bg-muted rounded text-xs font-mono mb-1 transition-colors",
                    session.session_id === sessionId && "bg-muted border border-cyan-500/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-cyan-400">{session.session_id.slice(0, 8)}...</div>
                    {session.session_id === sessionId && (
                      <span className="text-[10px] text-green-500">active</span>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate">{session.first_message || 'No messages'}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{session.message_count} messages</span>
                    <span>{new Date(session.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            )}
            {sessions.length > 0 && (
              <div className="border-t border-border mt-2 pt-2">
                <button
                  onClick={startNewSession}
                  className="w-full text-left p-2 hover:bg-muted rounded text-xs font-mono text-cyan-500"
                >
                  + Start New Session
                </button>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-card/30 p-2 sm:p-4 space-y-3 sm:space-y-4 font-mono text-xs sm:text-sm relative">
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
              
              {/* Bypass Mode Selection for New Conversations */}
              <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border/50 max-w-sm mx-auto">
                <div className="text-sm font-medium mb-3 text-foreground">Choose Approval Mode:</div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setBypassModeEnabled(false)}
                    className={cn(
                      "p-3 rounded-md border transition-all text-left",
                      !bypassModeEnabled 
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-500" 
                        : "border-border hover:border-cyan-500/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        !bypassModeEnabled ? "border-cyan-500 bg-cyan-500" : "border-gray-500"
                      )}>
                        {!bypassModeEnabled && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Approval Required</div>
                        <div className="text-xs text-muted-foreground">
                          Review and approve each tool use before execution
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setBypassModeEnabled(true)}
                    className={cn(
                      "p-3 rounded-md border transition-all text-left",
                      bypassModeEnabled 
                        ? "border-amber-500 bg-amber-500/10 text-amber-500" 
                        : "border-border hover:border-amber-500/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        bypassModeEnabled ? "border-amber-500 bg-amber-500" : "border-gray-500"
                      )}>
                        {bypassModeEnabled && (
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
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  You can change this anytime using the Bypass button above
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
                              <span className="text-xs text-cyan-500 flex items-center gap-1">
                                <UpdateIcon className="h-3 w-3 animate-spin" />
                                Processing
                              </span>
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
        </div>

        {/* Modern X-style Input Area */}
        <div className="border-t border-border/50 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="p-3 sm:p-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Auto-resize textarea
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto'
                    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
                  }
                }}
                onKeyDown={(e) => {
                  // Submit on Enter (without modifiers)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e as any)
                  }
                }}
                placeholder="What's happening with your code?"
                disabled={sendMutation.isPending}
                className="w-full bg-transparent border-0 focus:ring-0 resize-none 
                  placeholder:text-muted-foreground/50 text-base leading-relaxed
                  font-sans min-h-[24px] max-h-[200px] p-0 pr-12"
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
                  {input.length > 0 && (
                    <span className={cn(
                      "text-xs transition-colors",
                      input.length > 500 ? "text-orange-500" : "text-muted-foreground"
                    )}>
                      {input.length}
                    </span>
                  )}
                  
                  {/* Modern circular send button like X */}
                  <Button 
                    type="submit" 
                    disabled={sendMutation.isPending || !input.trim()}
                    className={cn(
                      "rounded-full h-8 w-8 sm:h-9 sm:w-auto sm:px-4 transition-all duration-200",
                      "font-medium text-sm",
                      input.trim() 
                        ? "bg-cyan-500 hover:bg-cyan-600 text-black" 
                        : "bg-cyan-500/20 text-cyan-500/50 cursor-not-allowed"
                    )}
                    size="sm"
                  >
                    {sendMutation.isPending ? (
                      <UpdateIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <PaperPlaneIcon className="h-4 w-4 sm:hidden" />
                        <span className="hidden sm:inline">Send</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Hint text */}
              <div className="mt-2 text-xs text-muted-foreground/50">
                Press Enter to send • Shift+Enter for new line
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Approval modals removed - approvals are now handled globally via ApprovalNotifications component */}
    </div>
  )
}