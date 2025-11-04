'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { PersonIcon, RocketIcon, ChatBubbleIcon, PaperPlaneIcon, ReloadIcon } from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { sendIssueResolutionMessage, getIssueResolutionStatus } from '@/lib/api/issue-resolution'

interface MessagesTabProps {
  projectId: string
  taskId: string
}

export function MessagesTab({ projectId, taskId }: MessagesTabProps) {
  // Fetch issue resolution to get session_id
  const { data: resolution } = useQuery({
    queryKey: ['issue-resolution', projectId, taskId],
    queryFn: () => getIssueResolutionStatus(projectId, taskId),
    refetchInterval: 5000,
  })

  // Fetch chat messages
  const { data: chatData } = useQuery({
    queryKey: ['session-chats', resolution?.session_id],
    queryFn: () => api.getSessionChats(resolution!.session_id!),
    enabled: !!resolution?.session_id,
    refetchInterval: 2000,
  })

  // Separate messages by role
  const { userMessages, assistantMessages } = useMemo(() => {
    const messages = chatData?.messages || []

    const userMsgs = messages
      .filter((msg: any) => msg.role === 'user' || msg.role === 'auto')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const assistantMsgs = messages
      .filter((msg: any) => msg.role === 'assistant')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    return {
      userMessages: userMsgs,
      assistantMessages: assistantMsgs,
    }
  }, [chatData])

  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) => sendIssueResolutionMessage(projectId, taskId, msg),
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['session-chats', resolution?.session_id] })
    },
  })

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

  return (
    <div className="space-y-8">
      {/* User Messages */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-lg border border-cyan-500/30 bg-card/50">
          <div className="p-6 border-b border-cyan-500/20">
            <div className="flex items-center gap-3">
              <PersonIcon className="h-5 w-5 text-cyan-500" />
              <h2 className="text-lg font-semibold text-cyan-400">User Messages</h2>
              <span className="text-sm text-muted-foreground">({userMessages.length})</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {userMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No user messages yet.</p>
            ) : (
              userMessages.map((msg: any) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <PersonIcon className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-mono text-cyan-400">User</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="prose prose-invert prose-cyan max-w-none">
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        },
                      }}
                    >
                      {typeof msg.content === 'string' ? msg.content : msg.content?.text || ''}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Assistant Messages */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="rounded-lg border border-purple-500/30 bg-card/50">
          <div className="p-6 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <RocketIcon className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-purple-400">Assistant Messages</h2>
              <span className="text-sm text-muted-foreground">({assistantMessages.length})</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {assistantMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assistant messages yet.</p>
            ) : (
              assistantMessages.map((msg: any) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <RocketIcon className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-mono text-purple-400">Assistant</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="prose prose-invert prose-purple max-w-none prose-lg">
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        },
                      }}
                    >
                      {typeof msg.content === 'string' ? msg.content : msg.content?.text || ''}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Follow-up Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="sticky bottom-0 p-6 rounded-lg border border-cyan-500/50 bg-card/90 backdrop-blur-sm space-y-3"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
          <ChatBubbleIcon className="h-4 w-4" />
          Send Follow-up Message
        </h3>
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question or provide additional context..."
            className="flex-1 min-h-[80px] max-h-[200px] bg-card/50 border-muted-foreground/30 focus:border-cyan-500 text-sm resize-none"
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
          <p className="text-xs text-red-400">
            Failed to send message. Please try again.
          </p>
        )}
      </motion.div>
    </div>
  )
}
