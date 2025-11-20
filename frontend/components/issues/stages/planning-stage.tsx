"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  FileText,
  CheckCircle,
  Clock,
  Loader2,
  Terminal,
  FileEdit,
  Eye,
  Sparkles,
  ThumbsUp,
  Lightbulb,
  MessageCircle,
  Send,
  Activity
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  StageSummaryCard,
  StageHooksSection,
  StageMetadata
} from "./shared-stage-components"

interface PlanningStageProps {
  taskId: string
  sessionId?: string
  chatId?: string
  stageData: any
  onApprove: () => void
  canApprove?: boolean
}

export function PlanningStage({ taskId, sessionId, chatId, stageData, onApprove, canApprove = true }: PlanningStageProps) {
  const queryClient = useQueryClient()
  const [feedbackMessage, setFeedbackMessage] = useState("")

  // Fetch chat messages for the planning session
  const { data: chats } = useQuery({
    queryKey: ['session-chats', sessionId],
    queryFn: () => sessionId ? api.getSessionChat(sessionId) : Promise.resolve({ chats: [] }),
    enabled: !!sessionId,
    refetchInterval: !stageData?.complete ? 5000 : false,
  })

  const { data: planningHooksData, refetch: refetchPlanningHooks, isRefetching: isPlanningRefetching } = useQuery({
    queryKey: ['planning-chat-hooks', chatId],
    queryFn: () => chatId ? api.getChatHooks(chatId) : Promise.resolve({ hooks: [] }),
    enabled: !!chatId,
    refetchInterval: !stageData?.complete ? 4000 : false,
  })

  const planningHooks = planningHooksData?.hooks || []

  // Extract ONLY the final completed plan result
  const planContent = useMemo(() => {
    // First try to get from completed status hooks (final plan)
    if (planningHooks && planningHooks.length > 0) {
      const completedStatusHooks = planningHooks.filter(
        (hook: any) => hook.hook_type === 'status' && hook.status === 'completed' && (hook.data?.result || hook.message)
      )

      if (completedStatusHooks.length > 0) {
        const latestCompletedHook = completedStatusHooks[completedStatusHooks.length - 1]
        const result = latestCompletedHook.data?.result || latestCompletedHook.message
        if (result && result.length > 200) {
          return result
        }
      }
    }

    // Fallback to chat messages
    if (!chats?.chats) return null
    const assistantMessages = chats.chats.filter((chat: any) => chat.role === 'assistant')
    return assistantMessages[assistantMessages.length - 1]?.content?.text || null
  }, [planningHooks, chats])

  const isWaitingForPlan = !stageData?.complete && !planContent
  const isPlanReady = stageData?.complete && !stageData?.approved
  const isPlanApproved = stageData?.approved

  // Transform all hooks for display
  const allHooks = useMemo(() => {
    if (!planningHooks) return []

    return planningHooks.map((hook: any) => {
      let icon = Activity
      let iconColor = 'text-muted-foreground'
      let bgColor = 'bg-muted'
      let title = hook.message || 'Activity'
      let details: any = {}

      if (hook.tool_name === 'Edit' || hook.tool_name === 'Write') {
        icon = FileEdit
        iconColor = 'text-blue-600'
        bgColor = 'bg-blue-100 dark:bg-blue-900/30'
        title = `${hook.tool_name}: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = {
          filePath: hook.tool_input?.file_path,
          oldString: hook.tool_input?.old_string,
          newString: hook.tool_input?.new_string,
        }
      } else if (hook.tool_name === 'Bash') {
        icon = Terminal
        iconColor = 'text-green-600'
        bgColor = 'bg-green-100 dark:bg-green-900/30'
        title = 'Shell Command'
        details = { command: hook.tool_input?.command }
      } else if (hook.tool_name === 'Read') {
        icon = Eye
        iconColor = 'text-purple-600'
        bgColor = 'bg-purple-100 dark:bg-purple-900/30'
        title = `Read: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = { filePath: hook.tool_input?.file_path }
      } else if (hook.hook_type === 'status') {
        icon = Sparkles
        iconColor = 'text-purple-600'
        bgColor = 'bg-purple-100 dark:bg-purple-900/30'
        title = hook.message || 'Status Update'
        details = { result: hook.data?.result }
      }

      return {
        id: hook.id,
        icon,
        iconColor,
        bgColor,
        title,
        details,
        timestamp: hook.received_at || hook.created_at,
        status: hook.status,
        toolName: hook.tool_name,
        hookType: hook.hook_type,
        message: hook.message,
      }
    }).reverse()
  }, [planningHooks])

  // Metadata items
  const metadataItems = useMemo(() => {
    const items = []

    if (stageData?.started_at) {
      items.push({
        label: 'Started',
        value: format(new Date(stageData.started_at), 'MMM d, HH:mm'),
        icon: Clock
      })
    }

    if (stageData?.completed_at) {
      items.push({
        label: 'Completed',
        value: format(new Date(stageData.completed_at), 'MMM d, HH:mm'),
        icon: Clock
      })
    }

    if (stageData?.approved_at) {
      items.push({
        label: 'Approved',
        value: format(new Date(stageData.approved_at), 'MMM d, HH:mm'),
        icon: CheckCircle
      })
    }

    if (sessionId) {
      items.push({
        label: 'Session ID',
        value: sessionId.slice(0, 8)
      })
    }

    return items
  }, [stageData, sessionId])

  const feedbackMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!chatId || !sessionId) throw new Error('Missing session context')
      return api.sendChatQuery(chatId, { prompt: message, session_id: sessionId })
    },
    onSuccess: () => {
      toast.success('Feedback sent to planning session')
      setFeedbackMessage("")
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ['session-chats', sessionId] })
      }
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: ['planning-chat-hooks', chatId] })
      }
    },
    onError: () => {
      toast.error('Unable to send feedback. Please retry.')
    }
  })

  const handleSendFeedback = () => {
    if (!feedbackMessage.trim()) return
    feedbackMutation.mutate(feedbackMessage.trim())
  }

  return (
    <div className="space-y-6">
      {/* Approval Status Banner */}
      {isPlanReady && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="border-amber-500/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/20 dark:via-yellow-950/20 dark:to-orange-950/20">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-lg font-bold">Plan Ready for Review</AlertTitle>
            <AlertDescription className="mt-3">
              <p className="text-sm mb-4 font-medium">Review the implementation plan below and approve to begin implementation.</p>
              <Button onClick={onApprove} disabled={!canApprove} size="lg" className="font-semibold shadow-md">
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve & Start Implementation
              </Button>
              {!canApprove && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Awaiting planning session metadata…
                </p>
              )}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Approved Status Banner */}
      {isPlanApproved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="border-green-500/50 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-lg font-bold">Plan Approved</AlertTitle>
            <AlertDescription className="mt-3">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {stageData?.approved_at && (
                  <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                    <Clock className="h-4 w-4" />
                    {format(new Date(stageData.approved_at), 'MMM d, HH:mm')}
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Loading State */}
      {isWaitingForPlan && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-4">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
            </div>
            <p className="text-base font-semibold">Analyzing issue and creating plan...</p>
            <p className="text-sm text-muted-foreground mt-1">This may take a few moments</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      {planContent && (
        <StageSummaryCard
          title="Implementation Plan"
          description="AI-generated analysis and implementation strategy"
          content={planContent}
          icon={Sparkles}
          accentColor="purple"
          badge="AI Generated"
        />
      )}

      {/* Hooks Section */}
      {allHooks.length > 0 && (
        <StageHooksSection
          hooks={allHooks}
          accentColor="purple"
          title="All Activity"
          description={`Complete execution log with ${allHooks.length} events`}
          onRefresh={refetchPlanningHooks}
          isRefreshing={isPlanningRefetching}
        />
      )}

      {/* Metadata Section */}
      {metadataItems.length > 0 && (
        <StageMetadata
          items={metadataItems}
          title="Stage Metadata"
          accentColor="purple"
        />
      )}

      {/* Feedback Section */}
      {sessionId && chatId && !isPlanApproved && planContent && (
        <Card className="border-blue-200 dark:border-blue-800 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-full blur-2xl" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Provide Feedback
            </CardTitle>
            <CardDescription className="text-xs">
              Send feedback to refine the plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative">
            <Textarea
              placeholder="Request changes, ask for clarifications, or add missing context..."
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="default"
                onClick={handleSendFeedback}
                disabled={feedbackMutation.isPending || !feedbackMessage.trim()}
                className="font-semibold"
              >
                {feedbackMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
