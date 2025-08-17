'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatBubbleIcon, PlusIcon, UpdateIcon, CheckCircledIcon, CrossCircledIcon, ChevronRightIcon, PersonIcon, RocketIcon } from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import { SubProjectChat } from './sub-project-chat'
import { useMobile } from '@/lib/hooks/useMobile'

interface ChatSessionsListProps {
  projectName: string
  taskName: string
  subProjectId: string
  taskId?: string
}

interface SessionPreview {
  session_id: string
  message_count: number
  first_message: string
  last_message: string
  created_at: string
  updated_at: string
  has_active_processing: boolean
  error_count: number
  hook_count: number
}

export function ChatSessionsList({ projectName, taskName, subProjectId, taskId }: ChatSessionsListProps) {
  const isMobile = useMobile()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)

  // Check if this is a new sub-project
  const isNewSubProject = subProjectId.startsWith('new-')

  // Only poll when viewing the sessions list
  const isViewingSessionsList = !selectedSessionId && !showNewChat
  
  // Fetch all sessions with their details
  const { data: sessionsData, isLoading, refetch } = useQuery({
    queryKey: ['chat-sessions-detailed', subProjectId],
    queryFn: async () => {
      if (isNewSubProject) return { sessions: [] }
      
      // First get all sessions
      const sessionsResponse = await api.getSubProjectSessions(subProjectId)
      const sessions = sessionsResponse.sessions || []
      
      // For each session, get additional details
      const detailedSessions = await Promise.all(
        sessions.map(async (session: any) => {
          try {
            // Get all messages for the session
            const messagesData = await api.getSessionChats(session.session_id)
            const messages = messagesData.messages || []
            
            // Get hooks for the last assistant message
            const lastAssistantMsg = messages.filter((m: any) => m.role === 'assistant').pop()
            let hookCount = 0
            let hasActiveProcessing = false
            let errorCount = 0
            
            if (lastAssistantMsg) {
              try {
                const hooksData = await api.getChatHooks(lastAssistantMsg.id)
                const hooks = hooksData.hooks || []
                hookCount = hooks.length
                hasActiveProcessing = hooks.some((h: any) => 
                  h.status === 'processing' && !h.is_complete
                )
                errorCount = hooks.filter((h: any) => 
                  h.status === 'failed' || h.status === 'error'
                ).length
              } catch (e) {
                console.error('Failed to fetch hooks:', e)
              }
            }
            
            return {
              session_id: session.session_id,
              message_count: messages.length,
              first_message: messages[0]?.content?.text || 'Empty conversation',
              last_message: messages[messages.length - 1]?.content?.text || '',
              created_at: messages[0]?.created_at || new Date().toISOString(),
              updated_at: messages[messages.length - 1]?.created_at || new Date().toISOString(),
              has_active_processing: hasActiveProcessing,
              error_count: errorCount,
              hook_count: hookCount,
            }
          } catch (error) {
            console.error('Failed to get session details:', error)
            return {
              ...session,
              has_active_processing: false,
              error_count: 0,
              hook_count: 0,
            }
          }
        })
      )
      
      return { sessions: detailedSessions }
    },
    enabled: !isNewSubProject && isViewingSessionsList,
    refetchInterval: isViewingSessionsList ? 5000 : false, // Only poll when viewing list
  })

  const sessions = sessionsData?.sessions || []

  // If a session is selected or new chat is requested, show the chat component
  if (selectedSessionId || showNewChat) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedSessionId(null)
            setShowNewChat(false)
            refetch() // Refresh sessions list when going back
          }}
          className="font-mono text-xs"
        >
          <ChevronRightIcon className="h-3 w-3 mr-1 rotate-180" />
          Back to sessions
        </Button>
        
        <SubProjectChat
          projectName={projectName}
          taskName={taskName}
          subProjectId={subProjectId}
          initialSessionId={selectedSessionId || undefined}
          taskId={taskId}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-lg font-mono font-semibold flex items-center space-x-1 sm:space-x-2">
          <ChatBubbleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
          <span className="hidden sm:inline">Chat Sessions</span>
          <span className="sm:hidden">Chats</span>
        </h3>
        <Button 
          onClick={() => setShowNewChat(true)}
          className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono hover:glow-cyan transition-all px-2 sm:px-3"
          size="sm"
        >
          <PlusIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">New Chat</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="terminal-bg rounded-lg border border-border p-4 sm:p-8 text-center">
          <UpdateIcon className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 sm:mb-4 text-cyan-500 animate-spin" />
          <div className="font-mono text-muted-foreground text-sm sm:text-base">Loading sessions...</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="terminal-bg rounded-lg border border-border p-4 sm:p-8 text-center">
          <ChatBubbleIcon className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 text-muted-foreground/50" />
          <div className="font-mono text-muted-foreground text-sm sm:text-base">No chat sessions yet</div>
          <div className="text-xs mt-1 sm:mt-2">{isMobile ? 'Tap "New" to start' : 'Click "New Chat" to start a conversation'}</div>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {sessions.map((session: SessionPreview, index: number) => (
            <motion.div
              key={session.session_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="gradient-border-subtle rounded-lg overflow-hidden touch-manipulation"
            >
              <button
                onClick={() => setSelectedSessionId(session.session_id)}
                className="w-full text-left p-3 sm:p-4 hover:bg-card/50 transition-colors active:bg-card/70"
              >
                <div className="space-y-2 sm:space-y-3">
                  {/* Session Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                        <span className="font-mono text-xs text-cyan-500">
                          session:{session.session_id.slice(0, 6)}
                        </span>
                        {session.has_active_processing && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            <UpdateIcon className="h-3 w-3 mr-1 animate-spin" />
                            <span className="hidden sm:inline">Processing</span>
                            <span className="sm:hidden">•</span>
                          </Badge>
                        )}
                        {session.error_count > 0 && (
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            <span className="hidden sm:inline">{session.error_count} error{session.error_count > 1 ? 's' : ''}</span>
                            <span className="sm:hidden">!</span>
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm font-medium mt-1 text-foreground line-clamp-2">
                        {isMobile 
                          ? `${session.first_message.slice(0, 40)}${session.first_message.length > 40 ? '...' : ''}`
                          : `${session.first_message.slice(0, 60)}${session.first_message.length > 60 ? '...' : ''}`
                        }
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>

                  {/* Session Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono flex-wrap gap-1">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <span className="flex items-center space-x-1">
                        <ChatBubbleIcon className="h-3 w-3" />
                        <span className="hidden sm:inline">{session.message_count} messages</span>
                        <span className="sm:hidden">{session.message_count}m</span>
                      </span>
                      {session.hook_count > 0 && (
                        <span className="flex items-center space-x-1">
                          <RocketIcon className="h-3 w-3" />
                          <span className="hidden sm:inline">{session.hook_count} steps</span>
                          <span className="sm:hidden">{session.hook_count}s</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-xs">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Last Message Preview - Mobile Optimized */}
                  {session.last_message && !isMobile && (
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                      <div className="flex items-center space-x-1 mb-1">
                        <PersonIcon className="h-3 w-3" />
                        <span>Last message:</span>
                      </div>
                      <div className="ml-4">
                        {session.last_message.slice(0, 120)}
                        {session.last_message.length > 120 && '...'}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}