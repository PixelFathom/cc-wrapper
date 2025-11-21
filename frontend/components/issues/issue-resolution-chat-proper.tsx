"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  Copy,
  Check,
  Terminal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { format } from "date-fns"
import ReactMarkdown from "react-markdown"

interface IssueResolutionChatProperProps {
  taskId: string
  projectId: string
  currentStage: string
  initialSessionId?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'hook' | 'auto'
  content: {
    text?: string
    metadata?: any
  }
  created_at: string
  session_id: string
  isProcessing?: boolean
  continuation_status?: 'none' | 'needed' | 'in_progress' | 'completed'
}

export function IssueResolutionChatProper({
  taskId,
  projectId,
  currentStage,
  initialSessionId
}: IssueResolutionChatProperProps) {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Construct cwd (required for backend) - use projectId for issue resolution workspace
  const cwd = `${projectId}/issue-resolution/${currentStage}`

  // Fetch messages for current session
  const { data: sessionMessages, isLoading } = useQuery({
    queryKey: ['chats', 'session', sessionId],
    queryFn: () => api.getSessionChats(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 3000,
    staleTime: 0,
  })

  // Update messages when session data arrives
  useEffect(() => {
    if (sessionMessages?.messages) {
      setMessages(sessionMessages.messages)
    }
  }, [sessionMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await api.sendQuery({
        prompt: messageText,
        session_id: sessionId || undefined,
        org_name: 'default',
        cwd,
        permission_mode: 'bypassPermissions',
      })
      return response
    },
    onSuccess: (data) => {
      setMessage("")
      setSessionId(data.session_id)
      toast.success('Message sent')

      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ['chats', 'session', data.session_id] })
    },
    onError: (error: any) => {
      // Extract detailed error information
      const errorMessage = error?.message || 'Failed to send message'
      const errorData = error?.responseData?.detail

      // Check if it's a subscription/credits error
      if (errorData && typeof errorData === 'object' && errorData.error === 'insufficient_coins') {
        toast.error('Insufficient Credits', {
          description: `${errorMessage}. You need ${errorData.required} credit(s) but only have ${errorData.available}. Please upgrade your subscription.`,
          duration: 7000,
        })
      } else {
        toast.error(errorMessage)
      }
    }
  })

  const handleSendMessage = () => {
    if (!message.trim() || sendMutation.isPending) return

    // Add optimistic user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: { text: message.trim() },
      created_at: new Date().toISOString(),
      session_id: sessionId || '',
      isProcessing: true,
    }
    setMessages(prev => [...prev, tempUserMessage])

    sendMutation.mutate(message.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyMessage = async (msg: Message) => {
    const text = msg.content?.text || ''
    await navigator.clipboard.writeText(text)
    setCopiedMessageId(msg.id)
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  const isWaitingForResponse = messages.some(msg =>
    msg.role === 'assistant' && msg.isProcessing
  ) || sendMutation.isPending

  return (
    <div className="flex flex-col h-full rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">AI Feedback</h3>
            <p className="text-xs text-muted-foreground">Stage: {currentStage}</p>
          </div>
        </div>
        {isWaitingForResponse && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !isWaitingForResponse ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <Terminal className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium mb-2">Start a conversation</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Request changes, run migrations, fix errors, or make adjustments to the deployment
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role !== 'user' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div className={cn(
                    "group relative rounded-2xl px-4 py-3 max-w-[85%]",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}>
                    {msg.role !== 'user' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2">
                        {msg.isProcessing ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing...
                          </div>
                        ) : (
                          <ReactMarkdown>{msg.content?.text || ''}</ReactMarkdown>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content?.text || ''}</p>
                    )}

                    <div className="flex items-center justify-between mt-2 gap-2">
                      <p className="text-xs opacity-60">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                      {!msg.isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyMessage(msg)}
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/20 flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-muted/20">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            className="min-h-[80px] resize-none"
            disabled={sendMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMutation.isPending}
            size="icon"
            className="h-[80px] w-[80px] flex-shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Permission mode: Bypass • Auto-execute tools without approval
        </p>
      </div>
    </div>
  )
}
