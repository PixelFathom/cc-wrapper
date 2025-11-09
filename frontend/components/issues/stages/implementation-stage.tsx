"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Code,
  FileCode,
  GitCommit,
  GitBranch,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileEdit,
  Terminal,
  Zap,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { useMemo, useState } from "react"

interface ImplementationStageProps {
  taskId: string
  sessionId?: string
  chatId?: string
  stageData: any
}

export function ImplementationStage({ taskId, sessionId, chatId, stageData }: ImplementationStageProps) {
  const [isToolsExpanded, setIsToolsExpanded] = useState(false)

  // Fetch chat messages
  const { data: chats } = useQuery({
    queryKey: ['session-chats', sessionId],
    queryFn: () => sessionId ? api.getSessionChat(sessionId) : Promise.resolve({ chats: [] }),
    enabled: !!sessionId,
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Fetch chat hooks for activity
  const { data: hooks } = useQuery({
    queryKey: ['chat-hooks', chatId],
    queryFn: () => chatId ? api.getChatHooks(chatId) : Promise.resolve({ hooks: [] }),
    enabled: !!chatId,
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Extract activity metrics
  const getActivityMetrics = () => {
    if (!hooks?.hooks) return { filesModified: 0, commits: 0, toolCalls: 0 }

    const filesModified = new Set(
      hooks.hooks
        .filter((h: any) => h.tool_name === 'Edit' || h.tool_name === 'Write')
        .map((h: any) => h.tool_input?.file_path)
        .filter(Boolean)
    ).size

    const commits = hooks.hooks.filter((h: any) =>
      h.tool_name === 'Bash' && h.tool_input?.command?.includes('git commit')
    ).length

    const toolCalls = hooks.hooks.filter((h: any) => h.tool_name).length

    return { filesModified, commits, toolCalls }
  }

  const metrics = getActivityMetrics()

  // Get recent activity items
  const getRecentActivity = () => {
    if (!hooks?.hooks) return []

    return hooks.hooks
      .filter((h: any) => h.tool_name || h.message)
      .slice(-10)
      .reverse()
      .map((hook: any) => {
        let icon = Activity
        let color = 'text-muted-foreground'
        let description = hook.message || 'Activity'

        if (hook.tool_name === 'Edit' || hook.tool_name === 'Write') {
          icon = FileEdit
          color = 'text-blue-600'
          description = `Modified ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        } else if (hook.tool_name === 'Bash') {
          icon = Terminal
          color = 'text-green-600'
          const cmd = hook.tool_input?.command || ''
          if (cmd.includes('git commit')) {
            icon = GitCommit
            description = 'Created commit'
          } else if (cmd.includes('git')) {
            icon = GitBranch
            description = 'Git operation'
          } else {
            description = `Command: ${cmd.slice(0, 50)}...`
          }
        } else if (hook.tool_name === 'Read') {
          icon = FileCode
          color = 'text-purple-600'
          description = `Reading ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        }

        return {
          id: hook.id,
          icon,
          color,
          description,
          timestamp: hook.received_at
        }
      })
  }

  const recentActivity = getRecentActivity()

  // Get implementation progress
  const getProgress = () => {
    if (stageData?.complete) return 100
    if (!hooks?.hooks) return 0

    // Estimate based on activity
    const totalExpected = 20 // Expected number of operations
    const current = Math.min(hooks.hooks.length, totalExpected)
    return Math.round((current / totalExpected) * 100)
  }

  const progress = getProgress()

  // Extract the final completed implementation hook
  const completedImplementationHook = useMemo(() => {
    if (!hooks?.hooks || !stageData?.complete) return null

    // Find the last hook with completed status and significant content
    const completedHooks = hooks.hooks
      .filter((hook: any) => {
        const fullResult = hook.data?.result || hook.result
        const message = hook.message
        const isCompleted = hook.status === 'completed' || hook.hook_type === 'completed'

        // Check if it has substantial content
        const hasContent = (fullResult && fullResult.length >= 200) ||
                          (message && message.length >= 200)

        return isCompleted && hasContent
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.received_at || a.created_at).getTime()
        const timeB = new Date(b.received_at || b.created_at).getTime()
        return timeB - timeA // Most recent first
      })

    return completedHooks[0] || null
  }, [hooks, stageData])

  // Get the final result content
  const finalResultContent = useMemo(() => {
    if (!completedImplementationHook) return null

    const fullResult = completedImplementationHook.data?.result || completedImplementationHook.result
    const message = completedImplementationHook.message

    return fullResult || message
  }, [completedImplementationHook])

  return (
    <div className="space-y-4">
      {/* Stage Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge variant={stageData?.complete ? "success" : "default"}>
            {stageData?.complete ? 'Complete' : 'In Progress'}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Started</p>
          <p className="text-sm font-medium">
            {stageData?.started_at
              ? format(new Date(stageData.started_at), 'MMM d, HH:mm')
              : '-'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-sm font-medium">
            {stageData?.completed_at
              ? format(new Date(stageData.completed_at), 'MMM d, HH:mm')
              : '-'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Mode</p>
          <Badge variant="outline" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Auto-Execute
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Implementation Progress</p>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Activity Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileEdit className="h-4 w-4" />
              Files Modified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.filesModified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              Commits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.commits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Tool Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.toolCalls}</p>
          </CardContent>
        </Card>
      </div>

      {/* Final Implementation Result */}
      {finalResultContent && (
        <>
          <Separator />
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                Implementation Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-emerald max-w-none dark:prose-invert">
                <ReactMarkdown>{finalResultContent}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Collapsible Tool Executions */}
      <Collapsible open={isToolsExpanded} onOpenChange={setIsToolsExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Tool Executions
                  {hooks?.hooks && (
                    <Badge variant="secondary" className="ml-2">
                      {hooks.hooks.length} operations
                    </Badge>
                  )}
                </CardTitle>
                {isToolsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((item, index) => {
                      const Icon = item.icon
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start gap-3 pb-3 border-b last:border-0"
                        >
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full bg-muted",
                            item.color
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.timestamp), 'HH:mm:ss')}
                            </p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Waiting for activity...</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

    </div>
  )
}