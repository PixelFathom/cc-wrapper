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
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { format } from "date-fns"
import ReactMarkdown from "react-markdown"

interface IssueResolutionChatProps {
  taskId: string
  currentStage: string
  sessionId?: string
  chatId?: string
}

export function IssueResolutionChat({ taskId, currentStage, sessionId, chatId }: IssueResolutionChatProps) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch chat messages
  const { data: chats, isLoading } = useQuery({
    queryKey: ['issue-resolution-chat', sessionId],
    queryFn: () => sessionId ? api.getSessionChat(sessionId) : Promise.resolve({ chats: [] }),
    enabled: !!sessionId,
    refetchInterval: 3000,
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!chatId || !sessionId) {
        throw new Error('No active chat session')
      }

      // Always send session_id to ensure messages are in the same session we're displaying
      // Set permission mode to bypass to skip approval workflows
      return api.sendChatQuery(chatId, {
        prompt: messageText,
        session_id: sessionId,
        permission_mode: 'bypassPermissions'
      })
    },
    onSuccess: () => {
      setMessage("")
      toast.success('Message sent to AI')
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ['issue-resolution-chat', sessionId] })
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to send message')
    }
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chats])

  const handleSendMessage = () => {
    if (!message.trim()) return
    if (!chatId || !sessionId) {
      toast.error('No active session for this stage')
      return
    }
    sendMessageMutation.mutate(message.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!sessionId || !chatId) {
    return (
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-bold mb-1">AI Feedback</h3>
            <p className="text-xs text-muted-foreground">Chat with AI about this issue</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Chat will be available once the stage starts
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold mb-1">AI Feedback</h3>
          <p className="text-xs text-muted-foreground">Request changes or additional work</p>
        </div>
        {sendMessageMutation.isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Chat Messages */}
      <ScrollArea className="h-[400px]" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chats?.messages && chats.messages.length > 0 ? (
            <AnimatePresence>
              {chats.messages.map((chat: any, index: number) => (
                <motion.div
                  key={chat.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex gap-3",
                    chat.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {chat.role === 'assistant' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 max-w-[85%]",
                      chat.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {chat.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2">
                        <ReactMarkdown>{chat.content?.text || chat.content || ''}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{chat.content?.text || chat.content || ''}</p>
                    )}
                    {chat.created_at && (
                      <p className="text-xs opacity-60 mt-1">
                        {format(new Date(chat.created_at), 'HH:mm')}
                      </p>
                    )}
                  </div>
                  {chat.role === 'user' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1">Start a conversation</p>
              <p className="text-xs text-muted-foreground">
                Ask the AI to make changes or run additional tasks
              </p>
            </div>
          )}
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
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="icon"
            className="h-[80px] w-[80px] flex-shrink-0"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Request changes like running migrations, fixing errors, or making adjustments
        </p>
      </div>
    </div>
  )
}
