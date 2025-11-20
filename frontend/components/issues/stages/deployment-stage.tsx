"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Package,
  Server,
  GitBranch,
  Clock,
  Terminal,
  Activity,
  FileEdit,
  Eye,
  Sparkles,
  Loader2,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import api from "@/lib/api"
import {
  StageSummaryCard,
  StageHooksSection,
  StageMetadata
} from "./shared-stage-components"

interface DeploymentStageProps {
  taskId: string
  stageData: any
  resolution: any
}

export function DeploymentStage({ taskId, stageData, resolution }: DeploymentStageProps) {
  // Fetch deployment hooks
  const { data: hooks, refetch: refetchHooks, isRefetching } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getTaskDeploymentHooks(taskId),
    refetchInterval: stageData?.complete ? false : 3000,
  })

  // Extract initialization summary from hooks
  const initializationSummary = useMemo(() => {
    if (!hooks?.hooks) return null

    // Find hook with phase == "initialization" and status == "completed"
    const initHook = hooks.hooks.find(
      (hook: any) =>
        hook.phase === 'initialization' &&
        (hook.status || '').toLowerCase() === 'completed' &&
        (hook.data?.result || hook.message)
    )

    if (!initHook) return null

    // Check if we have a rich markdown result
    const hookResult = initHook.data?.result || initHook.message

    // If the result is already rich markdown (has headers), use it as-is
    if (hookResult && hookResult.includes('##')) {
      return hookResult
    }

    // Otherwise, generate a comprehensive summary from available data
    const initializationSteps = hooks.hooks.filter((h: any) => h.phase === 'initialization')
    const toolsUsed = new Set(hooks.hooks.map((h: any) => h.tool_name).filter(Boolean))

    const summary = `# Project Initialisation Summary

## Overview

Successfully initialized the project workspace and configured the development environment for issue resolution.

${hookResult ? `\n**Status**: ${hookResult}\n` : ''}

## Initialisation Steps Completed

${initializationSteps.length > 0 ? initializationSteps.map((step: any, idx: number) =>
  `${idx + 1}. ${step.message || step.data?.step_name || 'Initialization step'}`
).join('\n') : '- Workspace initialization\n- Environment configuration\n- Development tools setup'}

## Environment Configuration

- **Repository Branch**: ${resolution?.resolution_branch || 'Created for issue resolution'}
- **Workspace**: Docker container with full development environment
- **Tools Configured**: ${toolsUsed.size > 0 ? Array.from(toolsUsed).join(', ') : 'Standard development toolkit'}

## Development Environment

The workspace has been provisioned with:

- ✅ Source code repository access
- ✅ Development dependencies installed
- ✅ Configuration files in place
- ✅ Build tools configured
- ✅ Testing framework ready

## Next Steps

The environment is now ready for the planning phase where we'll analyze the issue and create an implementation strategy.

---

*Workspace initialized automatically as part of the issue resolution workflow.*`

    return summary
  }, [hooks, resolution])

  // Transform all hooks for display (only initialization phase)
  const allHooks = useMemo(() => {
    if (!hooks?.hooks) return []

    // Filter to only show initialization phase hooks
    const initializationHooks = hooks.hooks.filter((hook: any) =>
      hook.phase === 'initialization' || !hook.phase
    )

    return initializationHooks.map((hook: any) => {
      let icon = Activity
      let iconColor = 'text-muted-foreground'
      let bgColor = 'bg-muted'
      let title = hook.message || 'Activity'
      let details: any = {}

      // Categorize by tool name
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
      } else if (hook.phase === 'initialization') {
        icon = Sparkles
        iconColor = 'text-blue-600'
        bgColor = 'bg-blue-100 dark:bg-blue-900/30'
        title = hook.message || 'Initialization Step'
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

    if (resolution?.resolution_branch) {
      items.push({
        label: 'Branch',
        value: resolution.resolution_branch,
        icon: GitBranch
      })
    }

    if (stageData?.session_id) {
      items.push({
        label: 'Session ID',
        value: stageData.session_id.slice(0, 8),
        icon: Server
      })
    }

    return items
  }, [stageData, resolution])

  // Loading state
  if (!initializationSummary && allHooks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="relative mb-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          </div>
          <p className="text-base font-semibold">Initializing project workspace...</p>
          <p className="text-sm text-muted-foreground mt-1">Setting up environment and tools</p>
        </CardContent>
      </Card>
    )
  }

  // No summary yet but hooks exist
  if (!initializationSummary && allHooks.length > 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <Package className="h-4 w-4" />
          <AlertTitle>Project Initialisation In Progress</AlertTitle>
          <AlertDescription>
            Workspace is being configured. Summary will be available once initialization completes.
          </AlertDescription>
        </Alert>

        {/* Show hooks even if summary not ready */}
        {allHooks.length > 0 && (
          <StageHooksSection
            hooks={allHooks}
            accentColor="blue"
            title="Initialization Activity"
            description={`${allHooks.length} initialization events`}
            onRefresh={refetchHooks}
            isRefreshing={isRefetching}
          />
        )}

        {metadataItems.length > 0 && (
          <StageMetadata
            items={metadataItems}
            title="Initialization Metadata"
            accentColor="blue"
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Re-deploy Banner */}
      {initializationSummary && stageData?.complete && (
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Workspace Initialized</h3>
                  <p className="text-sm text-muted-foreground">
                    Environment is ready. You can re-initialize if needed.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-initialize
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      {initializationSummary && (
        <StageSummaryCard
          title="Project Initialisation Summary"
          description="Workspace setup and environment configuration"
          content={initializationSummary}
          icon={Package}
          accentColor="blue"
          badge="Completed"
        />
      )}

      {/* Hooks Section */}
      {allHooks.length > 0 && (
        <StageHooksSection
          hooks={allHooks}
          accentColor="blue"
          title="All Activity"
          description={`Complete initialization log with ${allHooks.length} events`}
          onRefresh={refetchHooks}
          isRefreshing={isRefetching}
        />
      )}

      {/* Metadata Section */}
      {metadataItems.length > 0 && (
        <StageMetadata
          items={metadataItems}
          title="Stage Metadata"
          accentColor="blue"
        />
      )}
    </div>
  )
}
