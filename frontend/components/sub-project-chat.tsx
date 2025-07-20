'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PaperPlaneIcon, PersonIcon, RocketIcon, UpdateIcon, ChevronRightIcon,
  CodeIcon, GearIcon, CheckCircledIcon, CrossCircledIcon, ClockIcon,
  FileTextIcon, CubeIcon, ChevronDownIcon, DotFilledIcon
} from '@radix-ui/react-icons'
import { api, ChatHook } from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
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
  role: 'user' | 'assistant' | 'hook'
  content: any
  timestamp: string
  sessionId?: string
  isProcessing?: boolean
  chatId?: string  // Server-provided chat ID
  hooks?: ChatHook[]  // Associated webhook logs
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
  
  // Load initial session messages if provided
  useEffect(() => {
    if (initialSessionId && !messages.length) {
      console.log('📚 Loading initial chat history for session:', initialSessionId)
      loadChatHistory(initialSessionId)
    }
  }, [initialSessionId])
  
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
          }))
          
          // Create a map of existing messages for quick lookup
          const existingMap = new Map(prevMessages.map(m => [m.id, m]))
          const updatedMap = new Map(existingMap)
          
          // Update or add messages
          newMessages.forEach(newMsg => {
            const existing = existingMap.get(newMsg.id)
            
            // Always update if content changed or if it's a new message
            if (!existing || 
                JSON.stringify(existing.content) !== JSON.stringify(newMsg.content) ||
                existing.isProcessing !== newMsg.isProcessing) {
              
              console.log(`🔄 ${existing ? 'Updating' : 'Adding'} message ${newMsg.id.slice(0, 8)}...`, {
                role: newMsg.role,
                wasProcessing: existing?.isProcessing,
                isProcessing: newMsg.isProcessing,
                hasText: !!newMsg.content?.text
              })
              
              updatedMap.set(newMsg.id, newMsg)
            }
          })
          
          // Convert back to array and sort by timestamp
          const finalMessages = Array.from(updatedMap.values())
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          
          // Check if all messages now have a different session_id (webhook updated them)
          const newSessionId = finalMessages[0]?.sessionId
          if (newSessionId && newSessionId !== sessionId && finalMessages.every(msg => msg.sessionId === newSessionId)) {
            console.log('🔄 SESSION ID CHANGE DETECTED - all messages moved to new session | ' +
              `current=${sessionId} → new=${newSessionId}`)
            setSessionId(newSessionId)
          }
          
          console.log('✅ Updated UI with', finalMessages.length, 'messages')
          return finalMessages
        })
      } else {
        console.log('⚠️ Received empty message array, keeping current messages')
      }
    } else if (sessionMessages === null) {
      console.log('📭 Session messages is null, keeping current state')
    }
  }, [sessionMessages, sessionId])
  

  // Removed EventSource - using polling instead for better control

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    
    console.log('📨 Submitting message:', {
      session_id: sessionId || 'none (first message)',
      messageCount: messages.length
    })
    
    // Send mutation with current sessionId (null for first message)
    sendMutation.mutate({
      prompt: userInput,
      session_id: sessionId || undefined,
    })
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
      if (toolName.includes('bash') || toolName.includes('shell')) return <CodeIcon className="h-3 w-3" />
      if (toolName.includes('read') || toolName.includes('write')) return <FileTextIcon className="h-3 w-3" />
      if (toolName.includes('search') || toolName.includes('grep')) return <CubeIcon className="h-3 w-3" />
      return <GearIcon className="h-3 w-3" />
    }
    
    if (hook.status === 'completed') return <CheckCircledIcon className="h-3 w-3 text-green-500" />
    if (hook.status === 'error' || hook.status === 'failed') return <CrossCircledIcon className="h-3 w-3 text-red-500" />
    if (hook.status === 'processing') return <UpdateIcon className="h-3 w-3 text-yellow-500 animate-spin" />
    return <DotFilledIcon className="h-3 w-3 text-gray-500" />
  }

  const formatHookMessage = (hook: ChatHook) => {
    if (hook.message) return hook.message
    if (hook.tool_name) return `Using tool: ${hook.tool_name}`
    if (hook.data?.result) return hook.data.result.substring(0, 100) + '...'
    return hook.status || 'Processing'
  }

  return (
    <div className="flex flex-col h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px]">
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
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
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
                {/* Message Header */}
                <div className="flex items-start justify-between flex-wrap gap-1 sm:gap-0 sm:flex-nowrap">
                  <div className="flex items-start space-x-1 sm:space-x-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      [{formatTimestamp(message.timestamp)}]
                    </span>
                    {message.role === 'user' && (
                      <>
                        <span className="text-green-400">➜</span>
                        <span className="text-cyan-500">user</span>
                      </>
                    )}
                    {message.role === 'assistant' && (
                      <>
                        <span className="text-purple-400">←</span>
                        <span className="text-purple-400">assistant</span>
                      </>
                    )}
                  </div>
                  
                  {/* Show hooks toggle for assistant messages */}
                  {message.role === 'assistant' && hasHooks && (
                    <button
                      onClick={() => setShowAllHooks(!showAllHooks)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <GearIcon className="h-3 w-3" />
                      <span className="hidden sm:inline">{showAllHooks ? 'Hide' : 'Show'} processing steps ({hooks.length})</span>
                      <span className="sm:hidden">({hooks.length})</span>
                    </button>
                  )}
                </div>
                
                <div className="ml-3 sm:ml-6">
                  {/* Message Content */}
                  <div className="space-y-2 sm:space-y-3">
                    {message.role === 'user' ? (
                      <div className="bg-cyan-500/10 rounded-lg p-2 sm:p-3 border border-cyan-500/30">
                        <div className="whitespace-pre-wrap text-foreground">
                          {message.content.text || message.content}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-purple-500/10 rounded-lg p-2 sm:p-3 border border-purple-500/30">
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
                    )}
                    
                    {/* Webhook Logs - moved to assistant messages */}
                    {message.role === 'assistant' && hasHooks && showAllHooks && (
                      <div className="space-y-2 ml-2 sm:ml-4 border-l-2 border-muted pl-2 sm:pl-4">
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
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-border bg-card/50 p-2 sm:p-3">
          <div className="flex items-center space-x-1 sm:space-x-2 font-mono">
            <span className="text-green-400">➜</span>
            <span className="text-cyan-500">msg</span>
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message..."
              disabled={sendMutation.isPending}
              className="flex-1 bg-transparent border-0 focus:ring-0 font-mono placeholder:text-muted-foreground/50 text-xs sm:text-sm"
            />
            <Button 
              type="submit" 
              disabled={sendMutation.isPending || !input.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono hover:glow-cyan transition-all h-8 px-2 sm:px-3 min-w-[40px] sm:min-w-[60px]"
              size="sm"
            >
              {sendMutation.isPending ? (
                <UpdateIcon className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">send</span>
                  <span className="sm:hidden">→</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Approval modals removed - approvals are now handled globally via ApprovalNotifications component */}
    </div>
  )
}