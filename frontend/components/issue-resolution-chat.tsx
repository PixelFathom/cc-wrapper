'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneIcon,
  ReloadIcon,
  ExclamationTriangleIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { sendIssueResolutionMessage } from '@/lib/api/issue-resolution'
import { getChatsBySession, getChatHooks } from '@/lib/api'

interface IssueResolutionChatProps {
  projectId: string
  taskId: string
  sessionId: string | null
  chatId: string | null
}

export function IssueResolutionChat({
  projectId,
  taskId,
  sessionId,
  chatId
}: IssueResolutionChatProps) {
  const [message, setMessage] = useState('')
  const [expandedHooks, setExpandedHooks] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch chat messages
  const { data: chatData, isLoading: messagesLoading } = useQuery({
    queryKey: ['issue-chat-messages', sessionId],
    queryFn: () => getChatsBySession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 2000, // Poll every 2 seconds
  })

  // Fetch hooks for the first chat
  const { data: hooksData } = useQuery({
    queryKey: ['issue-chat-hooks', chatId],
    queryFn: () => getChatHooks(chatId!),
    enabled: !!chatId,
    refetchInterval: 2000, // Poll every 2 seconds
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) => sendIssueResolutionMessage(projectId, taskId, msg),
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['issue-chat-messages', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['issue-chat-hooks', chatId] })
    },
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatData?.messages])

  const handleSendMessage = () => {
    if (!message.trim() || sendMessageMutation.isPending) return
    sendMessageMutation.mutate(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleHookExpand = (hookId: string) => {
    setExpandedHooks(prev => ({
      ...prev,
      [hookId]: !prev[hookId]
    }))
  }

  const getHookIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircledIcon className="h-3 w-3 text-green-400" />
      case 'processing':
        return <ReloadIcon className="h-3 w-3 animate-spin text-blue-400" />
      case 'failed':
        return <ExclamationTriangleIcon className="h-3 w-3 text-red-400" />
      default:
        return <ChatBubbleIcon className="h-3 w-3 text-gray-400" />
    }
  }

  if (!sessionId) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground font-mono text-sm">
          Initializing chat session...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-8">
            <ReloadIcon className="h-6 w-6 animate-spin text-cyan-500" />
          </div>
        ) : (
          <AnimatePresence>
            {chatData?.messages.map((msg: any) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${msg.role === 'user' || msg.role === 'auto' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user' || msg.role === 'auto'
                      ? 'bg-cyan-500/10 border border-cyan-500/50'
                      : 'bg-card border border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {msg.role === 'auto' ? 'Auto' : msg.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm font-mono whitespace-pre-wrap">
                    {msg.content?.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Hooks Display */}
      {hooksData?.hooks && hooksData.hooks.length > 0 && (
        <div className="border-t border-border p-4 max-h-64 overflow-y-auto">
          <h3 className="text-xs font-mono font-semibold mb-3 text-cyan-400">
            Execution Details ({hooksData.hooks.length})
          </h3>
          <div className="space-y-2">
            {hooksData.hooks.slice(0, 10).reverse().map((hook: any) => (
              <motion.div
                key={hook.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-2 rounded bg-card/50 border border-border/50"
              >
                <button
                  onClick={() => toggleHookExpand(hook.id)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  {getHookIcon(hook.status)}
                  <span className="text-xs font-mono flex-1 truncate">
                    {hook.step_name || hook.hook_type}
                  </span>
                  {hook.step_index !== null && hook.total_steps && (
                    <span className="text-xs text-muted-foreground">
                      {hook.step_index}/{hook.total_steps}
                    </span>
                  )}
                </button>

                {expandedHooks[hook.id] && hook.message && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 pl-5 text-xs text-muted-foreground font-mono"
                  >
                    <p className="whitespace-pre-wrap">{hook.message}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a follow-up message..."
            className="flex-1 min-h-[60px] max-h-[120px] bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono text-sm resize-none"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-cyan-500 hover:bg-cyan-600 text-black self-end"
          >
            {sendMessageMutation.isPending ? (
              <ReloadIcon className="h-4 w-4 animate-spin" />
            ) : (
              <PaperPlaneIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        {sendMessageMutation.isError && (
          <p className="text-xs text-red-400 mt-2 font-mono">
            Failed to send message. Please try again.
          </p>
        )}
      </div>
    </div>
  )
}
