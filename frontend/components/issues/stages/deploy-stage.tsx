"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Rocket,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Server,
  Globe,
  Terminal,
  Clock,
  ExternalLink,
  Activity,
  FileEdit,
  Eye,
  Sparkles
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import api from "@/lib/api"
import { motion } from "framer-motion"
import {
  StageSummaryCard,
  StageHooksSection,
  StageMetadata
} from "./shared-stage-components"

interface DeployStageProps {
  taskId: string
  projectId: string
  issueNumber: number
  stageData: any
  onTriggerDeploy: () => void
}

export function DeployStage({ taskId, projectId, issueNumber, stageData, onTriggerDeploy }: DeployStageProps) {
  // Fetch deployment hooks/logs
  const { data: deploymentHooks, refetch: refetchDeploymentHooks, isRefetching: isDeploymentRefetching } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getDeploymentHooks(taskId, 'deployment'),
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Fetch task details to get port
  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId),
    enabled: !!taskId,
  })

  const deploymentPort = task?.deployment_port
  const deploymentUrl = deploymentPort ? `http://localhost:${deploymentPort}` : null

  const hasStarted = stageData?.started_at
  const isComplete = stageData?.complete
  const isActive = hasStarted && !isComplete

  // Convert to array
  const deploymentHookList = useMemo(() => {
    const raw = deploymentHooks as any
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (Array.isArray(raw?.hooks)) return raw.hooks
    if (typeof raw === 'object') {
      return Object.values(raw).filter((entry: any) => entry && typeof entry === 'object' && 'status' in entry && 'id' in entry)
    }
    return []
  }, [deploymentHooks])

  // Extract deployment summary from hooks with phase == "deployment" and status == "completed"
  const deploymentSummary = useMemo(() => {
    const summaryHook = deploymentHookList.find((hook: any) =>
      hook.phase === 'deployment' &&
      (hook.status || '').toLowerCase() === 'completed' &&
      (hook.data?.result || hook.message)
    )

    if (summaryHook) {
      return summaryHook.data?.result || summaryHook.message
    }

    return null
  }, [deploymentHookList])

  // Transform all hooks for display (only deployment phase)
  const allHooks = useMemo(() => {
    if (!deploymentHookList || deploymentHookList.length === 0) return []

    // Filter to only show deployment phase hooks
    const deploymentPhaseHooks = deploymentHookList.filter((hook: any) =>
      hook.phase === 'deployment' || !hook.phase
    )

    return deploymentPhaseHooks.map((hook: any) => {
      let icon = Activity
      let iconColor = 'text-muted-foreground'
      let bgColor = 'bg-muted'
      let title = hook.message || 'Activity'
      let details: any = {}

      // Categorize by tool name or deployment phase
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
      } else if (hook.phase === 'deployment') {
        icon = Sparkles
        iconColor = 'text-orange-600'
        bgColor = 'bg-orange-100 dark:bg-orange-900/30'
        title = hook.message || hook.data?.step_name || 'Deployment Step'
        details = {
          result: hook.data?.result,
          stepName: hook.data?.step_name
        }
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
  }, [deploymentHookList])

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

    if (deploymentPort) {
      items.push({
        label: 'Port',
        value: deploymentPort.toString(),
        icon: Server
      })
    }

    if (deploymentUrl) {
      items.push({
        label: 'URL',
        value: deploymentUrl,
        icon: Globe
      })
    }

    if (stageData?.session_id) {
      items.push({
        label: 'Session ID',
        value: stageData.session_id.slice(0, 8)
      })
    }

    return items
  }, [stageData, deploymentPort, deploymentUrl])

  return (
    <div className="space-y-6">
      {/* Deployment Complete Banner - shows when deployment summary is available */}
      {deploymentSummary && (
        <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/50 flex-shrink-0">
                  <Rocket className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Deployment Complete</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Application deployed successfully and ready to use.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {deploymentPort && (
                      <div className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                        <Server className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold">Port {deploymentPort}</span>
                      </div>
                    )}
                    {deploymentUrl && (
                      <a
                        href={deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-mono text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        {deploymentUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {deploymentUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(deploymentUrl, '_blank')}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Open Application
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={onTriggerDeploy}>
                      <Rocket className="h-4 w-4 mr-2" />
                      Re-deploy
                    </Button>
                  </div>
                </div>
              </div>
              <Badge variant="default" className="bg-green-500 flex-shrink-0">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Started State */}
      {!hasStarted && (
        <Alert>
          <Rocket className="h-4 w-4" />
          <AlertTitle>Ready to Deploy</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              The application is ready to be deployed. Click the button below to start the deployment process.
            </p>
            <Button onClick={onTriggerDeploy} size="sm">
              <Rocket className="h-4 w-4 mr-2" />
              Start Deployment
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* In Progress State - only show if no summary available yet */}
      {isActive && !deploymentSummary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="border-blue-500/50 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <AlertTitle className="text-lg font-bold">Deployment in Progress</AlertTitle>
            <AlertDescription className="mt-3">
              <p className="text-sm font-medium">
                {deploymentPort ? `Port ${deploymentPort} assigned` : 'Allocating port...'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Deploying application with Docker and verifying accessibility...
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Summary Section */}
      {deploymentSummary && (
        <StageSummaryCard
          title="Deployment Summary"
          description="Application deployment result and configuration"
          content={deploymentSummary}
          icon={Rocket}
          accentColor="orange"
          badge="Completed"
        />
      )}

      {/* Hooks Section */}
      {allHooks.length > 0 && (
        <StageHooksSection
          hooks={allHooks}
          accentColor="orange"
          title="Deployment Activity"
          description={`Complete deployment log with ${allHooks.length} events`}
          onRefresh={refetchDeploymentHooks}
          isRefreshing={isDeploymentRefetching}
        />
      )}

      {/* Metadata Section */}
      {metadataItems.length > 0 && (
        <StageMetadata
          items={metadataItems}
          title="Deployment Metadata"
          accentColor="orange"
        />
      )}
    </div>
  )
}
