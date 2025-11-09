"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Server,
  Globe,
  Database,
  GitBranch,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
  Activity
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

interface DeploymentStageProps {
  taskId: string
  stageData: any
  resolution: any
}

export function DeploymentStage({ taskId, stageData, resolution }: DeploymentStageProps) {
  // Fetch deployment hooks for activity feed
  const { data: hooks } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getTaskDeploymentHooks(taskId),
    refetchInterval: stageData?.complete ? false : 3000,
  })

  const deploymentSteps = [
    {
      id: 'init_repo',
      label: 'Initialize Repository',
      icon: GitBranch,
      status: resolution?.resolution_branch ? 'completed' : 'pending'
    },
    {
      id: 'setup_env',
      label: 'Setup Environment',
      icon: Server,
      status: hooks?.deployment_completed ? 'completed' : hooks?.hooks?.length > 0 ? 'active' : 'pending'
    },
    {
      id: 'configure_tools',
      label: 'Configure Development Tools',
      icon: Terminal,
      status: hooks?.deployment_completed ? 'completed' : 'pending'
    },
    {
      id: 'verify',
      label: 'Verify Setup',
      icon: CheckCircle,
      status: hooks?.deployment_completed ? 'completed' : 'pending'
    }
  ]

  const getProgressPercentage = () => {
    const completed = deploymentSteps.filter(s => s.status === 'completed').length
    return (completed / deploymentSteps.length) * 100
  }

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
          <p className="text-xs text-muted-foreground">Branch</p>
          <p className="text-sm font-medium font-mono">
            {resolution?.resolution_branch || 'Creating...'}
          </p>
        </div>
      </div>

      <Separator />

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Deployment Progress</p>
          <span className="text-sm text-muted-foreground">
            {Math.round(getProgressPercentage())}%
          </span>
        </div>
        <Progress value={getProgressPercentage()} className="h-2" />
      </div>

      {/* Deployment Steps */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Deployment Steps</p>
        <div className="space-y-2">
          {deploymentSteps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  step.status === 'completed' && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                  step.status === 'active' && "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
                  step.status === 'pending' && "bg-muted/50 border-muted-foreground/20"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  step.status === 'completed' && "bg-green-500 text-white",
                  step.status === 'active' && "bg-blue-500 text-white",
                  step.status === 'pending' && "bg-muted-foreground/20 text-muted-foreground"
                )}>
                  {step.status === 'active' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    step.status === 'pending' && "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                </div>
                {step.status === 'completed' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {step.status === 'active' && (
                  <Badge variant="default" className="animate-pulse">
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
                {step.status === 'pending' && (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Activity Feed */}
      {hooks?.hooks && hooks.hooks.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Deployment Activity</p>
            <ScrollArea className="h-48 w-full rounded-md border p-3">
              <div className="space-y-2">
                {hooks.hooks.map((hook: any, index: number) => (
                  <div key={hook.id} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground font-mono">
                      [{format(new Date(hook.received_at), 'HH:mm:ss')}]
                    </span>
                    <span className={cn(
                      "flex-1",
                      hook.status === 'error' && "text-destructive"
                    )}>
                      {hook.message || hook.data?.message || `${hook.hook_type}: ${hook.status}`}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Environment Info */}
      {stageData?.complete && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Environment Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Server:</span>
                <span className="font-mono">Docker Container</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Database:</span>
                <span className="font-mono">PostgreSQL</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Port:</span>
                <span className="font-mono">8000</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-mono">{resolution?.resolution_branch}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}