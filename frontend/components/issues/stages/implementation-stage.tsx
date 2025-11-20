"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Code,
  GitCommit,
  GitBranch,
  Activity,
  Clock,
  CheckCircle,
  Loader2,
  FileEdit,
  Terminal,
  Eye,
  Sparkles,
  BarChart3
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import api from "@/lib/api"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  StageSummaryCard,
  StageHooksSection,
  StageMetadata
} from "./shared-stage-components"

interface ImplementationStageProps {
  taskId: string
  sessionId?: string
  chatId?: string
  stageData: any
}

export function ImplementationStage({ taskId, sessionId, chatId, stageData }: ImplementationStageProps) {
  // Fetch chat hooks for activity
  const { data: hooks, refetch: refetchHooks, isRefetching } = useQuery({
    queryKey: ['chat-hooks', chatId],
    queryFn: () => chatId ? api.getChatHooks(chatId) : Promise.resolve({ hooks: [] }),
    enabled: !!chatId,
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Extract activity metrics
  const metrics = useMemo(() => {
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
  }, [hooks])

  // Get implementation progress
  const progress = useMemo(() => {
    if (stageData?.complete) return 100
    if (!hooks?.hooks) return 0
    const totalExpected = 20
    const current = Math.min(hooks.hooks.length, totalExpected)
    return Math.round((current / totalExpected) * 100)
  }, [hooks, stageData])

  // Extract ONLY the final completed implementation result
  const finalResult = useMemo(() => {
    if (!hooks?.hooks) return null

    // Look for completed status hook with result
    const completedStatusHooks = hooks.hooks.filter(
      (hook: any) =>
        hook.hook_type === 'status' &&
        hook.status === 'completed' &&
        (hook.data?.result || hook.message)
    )

    if (completedStatusHooks.length > 0) {
      const latestHook = completedStatusHooks[completedStatusHooks.length - 1]
      const result = latestHook.data?.result || latestHook.message
      // Return result if it exists and has meaningful content
      if (result && typeof result === 'string' && result.trim().length > 0) {
        return result
      }
    }

    return null
  }, [hooks])

  // Transform all hooks for display
  const allHooks = useMemo(() => {
    if (!hooks?.hooks) return []

    return hooks.hooks.map((hook: any) => {
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
        const cmd = hook.tool_input?.command || ''
        if (cmd.includes('git commit')) {
          icon = GitCommit
          title = 'Git Commit'
        } else if (cmd.includes('git')) {
          icon = GitBranch
          title = 'Git Command'
        } else {
          title = 'Shell Command'
        }
        details = { command: cmd }
      } else if (hook.tool_name === 'Read') {
        icon = Eye
        iconColor = 'text-purple-600'
        bgColor = 'bg-purple-100 dark:bg-purple-900/30'
        title = `Read: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = { filePath: hook.tool_input?.file_path }
      } else if (hook.hook_type === 'status') {
        icon = Sparkles
        iconColor = 'text-emerald-600'
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30'
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
  }, [hooks])

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

    if (sessionId) {
      items.push({
        label: 'Session ID',
        value: sessionId.slice(0, 8)
      })
    }

    items.push({
      label: 'Files Modified',
      value: metrics.filesModified.toString(),
      icon: FileEdit
    })

    items.push({
      label: 'Commits',
      value: metrics.commits.toString(),
      icon: GitCommit
    })

    items.push({
      label: 'Tool Calls',
      value: metrics.toolCalls.toString(),
      icon: Terminal
    })

    return items
  }, [stageData, sessionId, metrics])

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {stageData?.complete ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="border-emerald-500/50 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/20 dark:via-green-950/20 dark:to-teal-950/20">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <AlertTitle className="text-lg font-bold">Implementation Complete</AlertTitle>
            <AlertDescription className="mt-3">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {stageData?.completed_at && (
                  <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                    <Clock className="h-4 w-4" />
                    {format(new Date(stageData.completed_at), 'MMM d, HH:mm')}
                  </span>
                )}
                <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                  <FileEdit className="h-4 w-4" />
                  {metrics.filesModified} files
                </span>
                <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                  <GitCommit className="h-4 w-4" />
                  {metrics.commits} commits
                </span>
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  <p className="font-semibold">Implementation in Progress</p>
                </div>
                <span className="text-sm font-mono text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2.5" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      {finalResult && (
        <StageSummaryCard
          title="Implementation Summary"
          description="Final result and changes made"
          content={finalResult}
          icon={Sparkles}
          accentColor="emerald"
          badge="Completed"
        />
      )}

      {/* Hooks Section */}
      {allHooks.length > 0 && (
        <StageHooksSection
          hooks={allHooks}
          accentColor="emerald"
          title="All Activity"
          description={`Complete execution log with ${allHooks.length} events`}
          onRefresh={refetchHooks}
          isRefreshing={isRefetching}
        />
      )}

      {/* Metadata Section */}
      {metadataItems.length > 0 && (
        <StageMetadata
          items={metadataItems}
          title="Stage Metadata"
          accentColor="emerald"
        />
      )}
    </div>
  )
}
