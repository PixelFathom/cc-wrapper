'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GitHubLogoIcon,
  ReloadIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
  RocketIcon,
  FileTextIcon,
  CodeIcon,
  ClipboardCopyIcon,
  Link2Icon,
  CommitIcon,
  TimerIcon,
  TargetIcon,
  BookmarkIcon,
  ChatBubbleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListBulletIcon,
} from '@radix-ui/react-icons'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { StageNav, StageNavItem } from './issue-resolution/stage-nav'
import { StagePanel } from './issue-resolution/stage-panel'
import { STAGE_CONFIG, StageId, ACCENT_CLASSES } from './issue-resolution/stage-config'
import { StageStatus } from './issue-resolution/stage-nav'
import { PlanningResultCard } from './issue-resolution/planning-result-card'
import { getIssueResolutionStatus, createPullRequest } from '@/lib/api/issue-resolution'
import { api } from '@/lib/api'
import { DeploymentLogs } from './deployment-logs'
import { AuthSetupHelper } from './auth-setup-helper'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { ConfirmationModal } from './ui/confirmation-modal'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface IssueResolutionViewProps {
  projectId: string
  taskId: string
}

interface StageStatusResponse {
  current_stage: 'deployment' | 'planning' | 'implementation' | 'testing'
  resolution_state: string
  stages: {
    deployment: {
      complete: boolean
      started_at?: string
      completed_at?: string
    }
    planning: {
      complete: boolean
      approved: boolean
      session_id?: string
      chat_id?: string
      started_at?: string
      completed_at?: string
    }
    implementation: {
      complete: boolean
      session_id?: string
      chat_id?: string
      started_at?: string
      completed_at?: string
    }
    testing: {
      complete: boolean
      tests_generated: number
      tests_passed: number
      started_at?: string
      completed_at?: string
    }
  }
  can_transition: boolean
  next_action: string
  retry_count: number
  error_message?: string
}

interface ActivityEntry {
  id: string
  timestamp: Date
  data: any
}

const STAGE_ORDER: StageId[] = ['deployment', 'planning', 'implementation', 'testing', 'handoff']
const WRAP_UP_READY_STATES = new Set(['ready_for_pr', 'pr_created', 'completed'])

export function IssueResolutionView({ projectId, taskId }: IssueResolutionViewProps) {
  const queryClient = useQueryClient()

  const [activeStage, setActiveStage] = useState<StageId>('deployment')
  const [prDialogOpen, setPrDialogOpen] = useState(false)
  const [prTitle, setPrTitle] = useState('')
  const [prBody, setPrBody] = useState('')
  const [prBranch, setPrBranch] = useState('')
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({})
  const [userSelectedStage, setUserSelectedStage] = useState(false)
  const [triggerPlanningModalOpen, setTriggerPlanningModalOpen] = useState(false)

  const activityEndRef = useRef<HTMLDivElement>(null)

  const {
    data: resolution,
    isLoading: isResolutionLoading,
    refetch: refetchResolution,
    error: resolutionError,
  } = useQuery({
    queryKey: ['issue-resolution', projectId, taskId],
    queryFn: () => getIssueResolutionStatus(projectId, taskId),
    refetchInterval: 5000,
  })

  const { data: stageStatus, refetch: refetchStageStatus } = useQuery({
    queryKey: ['issue-resolution-stage-status', projectId, resolution?.issue_number],
    queryFn: () => api.getIssueResolutionStageStatus(projectId, resolution!.issue_number),
    enabled: !!resolution?.issue_number,
    refetchInterval: 5000,
  })

  const { data: deploymentHooksData, error: deploymentHooksError } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getTaskDeploymentHooks(taskId, 100),
    enabled: !!resolution,
    refetchInterval: 5000,
  })

  // Debug logging
  useEffect(() => {
    if (deploymentHooksData) {
      console.log('Deployment hooks loaded:', deploymentHooksData.hooks?.length, 'hooks')
    }
    if (deploymentHooksError) {
      console.error('Deployment hooks error:', deploymentHooksError)
    }
  }, [deploymentHooksData, deploymentHooksError])

  const { data: taskData } = useQuery({
    queryKey: ['task-data', taskId],
    queryFn: () => api.getTask(taskId),
    enabled: !!resolution,
    refetchInterval: 5000,
  })

  // Get chat IDs for each stage
  const planningChatId = stageStatus?.stages?.planning?.chat_id
  const implementationChatId = stageStatus?.stages?.implementation?.chat_id
  const currentStage = stageStatus?.current_stage

  // Determine which chat_id to use based on current stage
  const activeChatId = useMemo(() => {
    if (currentStage === 'planning') return planningChatId
    if (currentStage === 'implementation') return implementationChatId
    return null
  }, [currentStage, planningChatId, implementationChatId])

  // Fetch chat hooks for planning or implementation stage
  const { data: chatHooksData } = useQuery({
    queryKey: ['issue-chat-hooks', currentStage, activeChatId],
    queryFn: () => api.getChatHooks(activeChatId!),
    enabled: !!activeChatId && (currentStage === 'planning' || currentStage === 'implementation'),
    refetchInterval: 2000,
  })

  // Process hooks based on current stage
  const hooks = useMemo<ActivityEntry[]>(() => {
    // For deployment stage, use deployment hooks
    if (currentStage === 'deployment') {
      const deploymentHistory = deploymentHooksData?.hooks ?? []
      return deploymentHistory
        .map((hook: any) => ({
          id: `hook-${hook.id}`,
          timestamp: new Date(hook.created_at || hook.received_at),
          data: hook,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }

    // For planning and implementation stages, use chat hooks
    const chatHistory = chatHooksData?.hooks ?? []
    return chatHistory
      .map((hook: any) => ({
        id: `hook-${hook.id}`,
        timestamp: new Date(hook.created_at || hook.received_at),
        data: hook,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [currentStage, deploymentHooksData, chatHooksData])

  // Extract the completed planning hook with the comprehensive plan
  const completedPlanningHook = useMemo(() => {
    // Find the hook with completed status and a long message (comprehensive plan)
    // The comprehensive plan is stored in data.data.result, not in message (which is truncated to 500)
    const foundHook = hooks.find((hook) => {
      const fullResult = hook.data.data?.result || hook.data.result
      const truncatedMessage = hook.data.message
      const isCompleted = hook.data.status === 'completed'

      // Check if either full result exists OR message is long (truncated plan)
      const hasLongContent = (fullResult && fullResult.length >= 400) ||
                             (truncatedMessage && truncatedMessage.length >= 400)

      return isCompleted && hasLongContent
    })

    return foundHook
  }, [hooks])

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [hooks])

  const stageNavData = useMemo<StageNavItem[]>(() => {
    if (!stageStatus || !resolution) {
      return STAGE_CONFIG.map((stage, index) => ({
        ...stage,
        status: index === 0 ? 'active' : 'upcoming',
        progress: index === 0 ? 35 : 0,
      }))
    }

    const currentIndex = STAGE_ORDER.indexOf(stageStatus.current_stage)

    return STAGE_CONFIG.map((stage) => {
      if (stage.id === 'handoff') {
        const testingComplete = stageStatus.stages.testing?.complete
        const wrapComplete =
          WRAP_UP_READY_STATES.has(resolution.resolution_state) || !!resolution.pr_number

        let status: StageStatus = 'blocked'
        if (wrapComplete) {
          status = 'complete'
        } else if (testingComplete) {
          status = 'active'
        } else {
          status = 'blocked'
        }

        return {
          ...stage,
          status,
          progress: wrapComplete ? 100 : testingComplete ? 50 : 0,
          disabled: status === 'blocked',
        }
      }

      const stageIdx = STAGE_ORDER.indexOf(stage.id)
      const stageInfo =
        stageStatus.stages[stage.id as keyof StageStatusResponse['stages']]
      const isComplete = stageInfo?.complete

      let status: StageStatus = 'upcoming'
      if (isComplete) {
        status = 'complete'
      } else if (stageIdx === currentIndex) {
        status = stageStatus.error_message ? 'blocked' : 'active'
      } else if (stageIdx < currentIndex) {
        status = 'complete'
      }

      return {
        ...stage,
        status,
        progress: isComplete ? 100 : stageIdx === currentIndex ? 55 : 0,
        startedAt: stageInfo?.started_at,
        completedAt: stageInfo?.completed_at,
      }
    })
  }, [stageStatus, resolution])

  useEffect(() => {
    // Only auto-switch to the active stage if user hasn't manually selected a stage
    if (userSelectedStage) return

    const nextActive =
      stageNavData.find((stage) => stage.status === 'active')?.id ??
      stageNavData.find((stage) => stage.status !== 'complete')?.id ??
      'handoff'

    if (nextActive && nextActive !== activeStage) {
      setActiveStage(nextActive)
    }
  }, [stageNavData, activeStage, userSelectedStage])

  const overallProgress = useMemo(() => {
    if (!stageNavData.length) return 0
    const completed = stageNavData.filter((stage) => stage.status === 'complete').length
    return Math.round((completed / stageNavData.length) * 100)
  }, [stageNavData])

  const createPRMutation = useMutation({
    mutationFn: () =>
      createPullRequest(projectId, taskId, {
        title: prTitle || undefined,
        body: prBody || undefined,
        branch: prBranch || undefined,
      }),
    onSuccess: (data) => {
      toast.success('Pull request created')
      queryClient.invalidateQueries({ queryKey: ['issue-resolution', projectId, taskId] })
      setPrDialogOpen(false)
      setPrTitle('')
      setPrBody('')
      setPrBranch('')
      if (data.pr_url) {
        window.open(data.pr_url, '_blank')
      }
    },
    onError: () => toast.error('Failed to create pull request'),
  })

  const triggerPlanningMutation = useMutation({
    mutationFn: () => {
      if (!resolution?.issue_number) throw new Error('No issue number')
      return api.triggerPlanningStage(projectId, resolution.issue_number)
    },
    onSuccess: () => {
      toast.success('Planning stage triggered successfully')
      queryClient.invalidateQueries({ queryKey: ['issue-resolution', projectId, taskId] })
      queryClient.invalidateQueries({ queryKey: ['issue-resolution-stage-status', projectId, resolution?.issue_number] })
      setTriggerPlanningModalOpen(false)
    },
    onError: (error) => {
      toast.error(`Failed to trigger planning: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })

  const canApprovePlan =
    stageStatus?.current_stage === 'planning' &&
    stageStatus.stages.planning?.complete &&
    !stageStatus.stages.planning?.approved


  const handleRetryStage = async () => {
    if (!resolution?.issue_number) return
    try {
      await api.retryIssueResolutionStage(projectId, resolution.issue_number)
      toast.success('Retry triggered for current stage')
      refetchStageStatus()
    } catch (error) {
      console.error('Failed to retry stage', error)
      toast.error('Unable to retry stage right now.')
    }
  }

  const handleCreatePRClick = () => {
    if (!resolution) return
    setPrTitle(`Fix: Resolve issue #${resolution.issue_number}`)
    setPrBody(
      `## Summary\nThis PR resolves issue #${resolution.issue_number}.\n\n${resolution.solution_approach || ''}`,
    )
    setPrBranch(resolution.resolution_branch || '')
    setPrDialogOpen(true)
  }

  const toggleActivityExpand = (id: string) => {
    setExpandedActivities((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleRefreshAll = () => {
    refetchResolution()
    refetchStageStatus()
    if (resolution?.chat_id) {
      queryClient.invalidateQueries({ queryKey: ['issue-chat-hooks', resolution.chat_id] })
    }
  }

  if (isResolutionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <ReloadIcon className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">Loading issue resolution…</p>
        </div>
      </div>
    )
  }

  if (resolutionError || !resolution) {
    return (
      <div className="py-12 text-center space-y-4">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto" />
        <p className="text-red-400 font-mono text-sm">Unable to load resolution details.</p>
        <Button onClick={() => refetchResolution()} variant="outline" className="font-mono">
          <ReloadIcon className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const renderActiveStage = () => {
    switch (activeStage) {
      case 'deployment':
        return (
          <StagePanel
            accent="cyan"
            title="Environment Deployment"
            description="We prepare the workspace, clone the repo, and hydrate context."
            icon={<RocketIcon className="h-6 w-6" />}
            statusBadge={
              <StatusBadge
                label={taskData?.deployment_status || 'pending'}
                accent="cyan"
                state={stageStatus?.stages.deployment.complete ? 'success' : 'active'}
              />
            }
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefreshAll}>
                  <ReloadIcon className="mr-2 h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleRetryStage}>
                  Retry Stage
                </Button>
              </div>
            }
          >
            <MetricGrid
              items={[
                {
                  label: 'Status',
                  value: taskData?.deployment_status || 'Not started',
                  icon: TargetIcon,
                },
                {
                  label: 'Started',
                  value: formatTimestamp(stageStatus?.stages.deployment.started_at),
                  icon: TimerIcon,
                },
                {
                  label: 'Completed',
                  value: formatTimestamp(stageStatus?.stages.deployment.completed_at),
                  icon: CheckCircledIcon,
                },
                {
                  label: 'Request ID',
                  value: taskData?.deployment_request_id || '—',
                  icon: CommitIcon,
                },
              ]}
            />
            <AuthSetupHelper />
            <div className="rounded-2xl border border-border/60 bg-black/30 p-4">
              {deploymentHooksError ? (
                <div className="text-center py-8 space-y-3">
                  <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Unable to load deployment hooks. Please ensure you're authenticated.
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {deploymentHooksError instanceof Error ? deploymentHooksError.message : 'Authentication error'}
                  </p>
                </div>
              ) : deploymentHooksData?.hooks?.length ? (
                <DeploymentLogs
                  hooks={deploymentHooksData.hooks}
                  status={taskData?.deployment_status}
                  isCompleted={taskData?.deployment_completed}
                />
              ) : (
                <EmptyState message="Deployment hooks have not started yet." />
              )}
            </div>
          </StagePanel>
        )
      case 'planning':
        return (
          <StagePanel
            accent="violet"
            title="Planning & Analysis"
            description="The assistant analyzes the issue, captures requirements, and drafts a plan."
            icon={<FileTextIcon className="h-6 w-6" />}
            statusBadge={
              <StatusBadge
                label={
                  stageStatus?.stages.planning.approved
                    ? 'Approved'
                    : stageStatus?.stages.planning.complete
                      ? 'Awaiting approval'
                      : 'In progress'
                }
                accent="violet"
                state={
                  stageStatus?.stages.planning.approved
                    ? 'success'
                    : stageStatus?.current_stage === 'planning'
                      ? 'active'
                      : 'muted'
                }
              />
            }
            actions={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTriggerPlanningModalOpen(true)}
                  disabled={triggerPlanningMutation.isPending}
                >
                  <ReloadIcon className="mr-2 h-3.5 w-3.5" />
                  Re-execute Planning
                </Button>
              </div>
            }
          >
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Issue Brief</h3>
              <div className="rounded-xl border border-border/70 bg-black/30 p-4 text-sm text-muted-foreground">
                {resolution.issue_body ? (
                  <div className="prose prose-invert max-w-none text-xs sm:text-sm">
                    <ReactMarkdown>
                      {resolution.issue_body}
                    </ReactMarkdown>
                  </div>
                ) : (
                  'No additional context provided on GitHub.'
                )}
              </div>
            </section>

            {/* Comprehensive Plan Display */}
            {completedPlanningHook ? (() => {
              // Extract the full plan from data.data.result (not message which is truncated)
              const planContent = completedPlanningHook.data.data?.result ||
                                  completedPlanningHook.data.result ||
                                  completedPlanningHook.data.data?.message ||
                                  completedPlanningHook.data.message ||
                                  'Plan content not available'

              // Get the session_id from the completed planning hook's data (nested in data.data)
              const planningSessionId = completedPlanningHook.data.data?.session_id ||
                                       completedPlanningHook.data.session_id ||
                                       hooksData?.session_id ||
                                       ''

              return (
                <section className="space-y-3">
                  <PlanningResultCard
                    planContent={planContent}
                    isApproved={stageStatus?.stages.planning.approved || false}
                    canApprove={canApprovePlan}
                    onApprove={async (notes: string) => {
                      if (!resolution?.issue_number || !planningSessionId) {
                        toast.error('Missing session information. Please try again.')
                        return
                      }
                      await api.approvePlanAndStartImplementation(
                        projectId,
                        resolution.issue_number,
                        planningSessionId,
                        notes
                      )
                      toast.success('Plan approved. Implementation started.')
                      refetchStageStatus()
                      refetchResolution()
                    }}
                  />
                </section>
              )
            })() : (
              stageStatus?.current_stage === 'planning' && !stageStatus.stages.planning?.complete && (
                <section className="space-y-3">
                  <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ReloadIcon className="h-8 w-8 animate-spin text-violet-400" />
                      <div>
                        <h4 className="text-sm font-semibold text-violet-200">
                          Generating Comprehensive Plan
                        </h4>
                        <p className="text-xs text-muted-foreground mt-2">
                          The assistant is analyzing the issue and creating a detailed implementation plan.
                          This may take a few moments...
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )
            )}

            {/* Planning Execution Logs - Only show non-completed hooks */}
            {planningChatId && hooks.length > 0 && (
              <section className="space-y-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group">
                      <ChevronRightIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                      Planning Execution Logs ({hooks.length} events)
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="rounded-2xl border border-border/60 bg-black/30 p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-2">
                        {hooks.map((hook) => (
                          <div key={hook.id} className="text-xs border-b border-border/30 pb-2 last:border-0">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {hook.data.status === 'processing' && <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />}
                                  {hook.data.status === 'completed' && <CheckCircledIcon className="h-3 w-3 text-green-500" />}
                                  {hook.data.status === 'ERROR' && <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />}
                                  <span className="font-mono text-violet-400">{hook.data.step_name || hook.data.hook_type}</span>
                                  <span className="text-[10px] text-muted-foreground ml-auto">
                                    {hook.timestamp.toLocaleTimeString()}
                                  </span>
                                </div>
                                {hook.data.message && hook.data.message.length <= 500 && (
                                  <p className="text-muted-foreground ml-4 whitespace-pre-wrap break-words">
                                    {hook.data.message.length > 200 ? hook.data.message.substring(0, 200) + '...' : hook.data.message}
                                  </p>
                                )}
                                {hook.data.tool_name && (
                                  <div className="ml-4 mt-1 text-cyan-400">
                                    Tool: {hook.data.tool_name}
                                    {hook.data.tool_input && (
                                      <pre className="text-xs bg-black/50 p-2 rounded mt-1 overflow-x-auto">
                                        {JSON.stringify(hook.data.tool_input, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}

            <section className="flex flex-wrap gap-2">
              {(resolution.issue_labels || []).map((label) => (
                <Badge key={label} variant="outline" className="border-violet-500/40 bg-violet-500/10 text-xs text-violet-200">
                  {label}
                </Badge>
              ))}
            </section>
          </StagePanel>
        )
      case 'implementation':
        // Extract completed hook for prominent display
        const completedImplementationHook = hooks.find((hook) =>
          hook.data.step_name === 'Completed response' &&
          hook.data.status === 'completed'
        )

        // Filter out the completed hook from the regular hooks list to avoid duplication
        const implementationHooks = completedImplementationHook
          ? hooks.filter((hook) => hook.id !== completedImplementationHook.id)
          : hooks

        return (
          <StagePanel
            accent="amber"
            title="Implementation"
            description="Code generation, branch updates, and tool executions live here."
            icon={<CodeIcon className="h-6 w-6" />}
            statusBadge={
              <StatusBadge
                label={stageStatus?.stages.implementation.complete ? 'Complete' : 'Running'}
                accent="amber"
                state={stageStatus?.stages.implementation.complete ? 'success' : 'active'}
              />
            }
            actions={
              <Button variant="outline" size="sm" onClick={handleRefreshAll}>
                <ReloadIcon className="mr-2 h-3.5 w-3.5" />
                Refresh Hooks
              </Button>
            }
          >
            <MetricGrid
              items={[
                {
                  label: 'Branch',
                  value: resolution.resolution_branch || 'N/A',
                  icon: GitHubLogoIcon,
                },
                {
                  label: 'Files changed',
                  value: resolution.files_changed?.length ? `${resolution.files_changed.length} files` : 'Pending',
                  icon: FileTextIcon,
                },
                {
                  label: 'Auto query',
                  value: resolution.auto_query_completed ? 'Completed' : resolution.auto_query_triggered ? 'Running' : 'Pending',
                  icon: BookmarkIcon,
                },
                {
                  label: 'Session',
                  value: stageStatus?.stages.implementation.session_id || '—',
                  icon: ChatBubbleIcon,
                },
              ]}
            />

            {/* Display completed implementation message prominently */}
            {completedImplementationHook && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                  <CheckCircledIcon className="h-4 w-4" />
                  Implementation Summary
                </h3>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="prose prose-invert max-w-none text-xs sm:text-sm">
                    <ReactMarkdown
                      components={{
                        code({ inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus as any}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-lg text-xs"
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
                      {completedImplementationHook.data.message}
                    </ReactMarkdown>
                  </div>
                </div>
              </section>
            )}

            {/* Tool Executions - Collapsible Section */}
            {implementationHooks.length > 0 && (
              <section className="space-y-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group">
                      <ChevronRightIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                      Tool Execution Logs ({implementationHooks.length} events)
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="rounded-2xl border border-border/60 bg-black/30 p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-2">
                        {implementationHooks.map((activity) => (
                          <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="rounded-xl border border-amber-500/30 bg-amber-500/5"
                          >
                            <button
                              onClick={() => toggleActivityExpand(activity.id)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left"
                            >
                              <span className="text-xs font-semibold text-amber-200">
                                {activity.data.step_name || activity.data.hook_type || 'Execution'}
                              </span>
                              <span className="text-[11px] text-muted-foreground ml-auto">
                                {activity.timestamp.toLocaleTimeString()}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {expandedActivities[activity.id] ? 'Hide' : 'Details'}
                              </Badge>
                              {expandedActivities[activity.id] ? (
                                <ChevronDownIcon className="h-4 w-4 text-amber-300" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-amber-300" />
                              )}
                            </button>
                            {expandedActivities[activity.id] && activity.data.message && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="border-t border-amber-500/20 bg-black/40 p-4 text-xs"
                              >
                                <ReactMarkdown
                                  components={{
                                    code({ inline, className, children, ...props }: any) {
                                      const match = /language-(\w+)/.exec(className || '')
                                      return !inline && match ? (
                                        <SyntaxHighlighter
                                          style={vscDarkPlus as any}
                                          language={match[1]}
                                          PreTag="div"
                                          className="rounded-lg text-xs"
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
                                  {activity.data.message}
                                </ReactMarkdown>
                              </motion.div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                      <div ref={activityEndRef} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}
          </StagePanel>
        )
      case 'testing':
        return (
          <StagePanel
            accent="emerald"
            title="Testing & Verification"
            description="Autogenerated tests, replayed suites, and pass/fail telemetry."
            icon={<ClipboardCopyIcon className="h-6 w-6" />}
            statusBadge={
              <StatusBadge
                label={stageStatus?.stages.testing.complete ? 'Complete' : 'Running'}
                accent="emerald"
                state={stageStatus?.stages.testing.complete ? 'success' : 'active'}
              />
            }
            actions={
              <Button variant="outline" size="sm" onClick={handleRefreshAll}>
                Refresh Tests
              </Button>
            }
          >
            <MetricGrid
              items={[
                {
                  label: 'Generated',
                  value: stageStatus?.stages.testing.tests_generated?.toString() ?? '0',
                  icon: ListBulletIcon,
                },
                {
                  label: 'Passed',
                  value: stageStatus?.stages.testing.tests_passed?.toString() ?? '0',
                  icon: CheckCircledIcon,
                },
                {
                  label: 'Success Rate',
                  value:
                    stageStatus?.stages.testing.tests_generated
                      ? `${Math.round(
                          (stageStatus.stages.testing.tests_passed /
                            stageStatus.stages.testing.tests_generated) *
                            100,
                        )}%`
                      : '—',
                  icon: TargetIcon,
                },
                {
                  label: 'Session',
                  value: stageStatus?.stages.testing.started_at
                    ? new Date(stageStatus.stages.testing.started_at).toLocaleTimeString()
                    : 'Pending',
                  icon: TimerIcon,
                },
              ]}
            />

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-100">
              {stageStatus?.stages.testing.complete
                ? 'All automated checks have passed. You can proceed to wrap-up.'
                : 'Automated test suites are running. You will see pass/fail details here.'}
            </div>
          </StagePanel>
        )
      case 'handoff':
      default:
        return (
          <StagePanel
            accent="slate"
            title="Wrap-Up & Delivery"
            description="Create the pull request, capture testing artifacts, and finalize."
            icon={<Link2Icon className="h-6 w-6" />}
            statusBadge={
              <StatusBadge
                label={resolution.pr_number ? `PR #${resolution.pr_number}` : 'Pending'}
                accent="slate"
                state={resolution.pr_number ? 'success' : 'muted'}
              />
            }
            actions={
              !resolution.pr_number && (
                <Button size="sm" className="bg-slate-200 text-black hover:bg-white" onClick={handleCreatePRClick}>
                  <GitHubLogoIcon className="mr-2 h-4 w-4" />
                  Create Pull Request
                </Button>
              )
            }
          >
            <MetricGrid
              items={[
                {
                  label: 'Branch',
                  value: resolution.resolution_branch || 'Not set',
                  icon: GitHubLogoIcon,
                },
                {
                  label: 'Status',
                  value: resolution.resolution_state,
                  icon: TargetIcon,
                },
                {
                  label: 'Tests Passed',
                  value: `${resolution.test_cases_passed}/${resolution.test_cases_generated}`,
                  icon: ClipboardCopyIcon,
                },
                {
                  label: 'PR URL',
                  value: resolution.pr_url ? (
                    <button
                      onClick={() => window.open(resolution.pr_url!, '_blank')}
                      className="text-cyan-300 underline underline-offset-4"
                    >
                      Open PR
                    </button>
                  ) : (
                    '—'
                  ),
                  icon: Link2Icon,
                },
              ]}
            />

            <div className="rounded-2xl border border-border/60 bg-black/30 p-4 text-sm text-muted-foreground">
              {WRAP_UP_READY_STATES.has(resolution.resolution_state) || resolution.pr_number
                ? 'Great! Wrap-up is ready. Review the diff one last time and ship the PR.'
                : 'Wrap-up becomes available after testing finishes successfully.'}
            </div>
          </StagePanel>
        )
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <header className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-lg shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitHubLogoIcon className="h-4 w-4" />
              Issue #{resolution.issue_number}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{resolution.issue_title}</h1>
            <p className="text-sm text-muted-foreground">{stageStatus?.next_action}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-cyan-400/40 bg-cyan-500/10 text-cyan-200">
              {resolution.resolution_state}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefreshAll}>
              <ReloadIcon className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Workflow Progress</p>
          <div className="h-3 rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {stageStatus?.error_message && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="flex items-center gap-2 font-semibold">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Stage Error
            </div>
            <p className="mt-2 font-mono text-xs">{stageStatus.error_message}</p>
          </div>
        )}
      </header>

      <StageNav
        stages={stageNavData}
        activeStage={activeStage}
        onStageChange={(stage) => {
          setActiveStage(stage)
          setUserSelectedStage(true)
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>{renderActiveStage()}</div>
        <aside className="space-y-4">
          <ContextCard title="Files Changed" icon={CodeIcon}>
            {resolution.files_changed?.length ? (
              <ul className="space-y-2 text-xs font-mono text-muted-foreground">
                {resolution.files_changed.map((file) => (
                  <li key={file} className="truncate rounded bg-black/30 px-2 py-1">
                    {file}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No files reported yet." />
            )}
          </ContextCard>

          <ContextCard title="Testing Snapshot" icon={ClipboardCopyIcon}>
            <div className="flex items-center justify-between text-sm">
              <span>Passed</span>
              <span className="font-semibold text-emerald-300">
                {resolution.test_cases_passed}/{resolution.test_cases_generated}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                style={{
                  width:
                    resolution.test_cases_generated === 0
                      ? '0%'
                      : `${(resolution.test_cases_passed / Math.max(resolution.test_cases_generated, 1)) * 100}%`,
                }}
              />
            </div>
          </ContextCard>

          <ContextCard title="Pull Request" icon={GitHubLogoIcon}>
            {resolution.pr_number ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>PR Number</span>
                  <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-200">
                    #{resolution.pr_number}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Status</span>
                  <span className="font-semibold text-green-200">{resolution.pr_state}</span>
                </div>
                {resolution.pr_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(resolution.pr_url!, '_blank')}
                  >
                    View on GitHub
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>No pull request yet. Create one once testing is green.</p>
                <Button size="sm" className="w-full" onClick={handleCreatePRClick}>
                  <GitHubLogoIcon className="mr-2 h-4 w-4" />
                  Create PR
                </Button>
              </div>
            )}
          </ContextCard>
        </aside>
      </div>

      <Dialog open={prDialogOpen} onOpenChange={setPrDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitHubLogoIcon className="h-5 w-5 text-cyan-400" />
              Create Pull Request
            </DialogTitle>
            <DialogDescription>Summarize the fix before shipping it to GitHub.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={prTitle} onChange={(event) => setPrTitle(event.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea
                value={prBody}
                onChange={(event) => setPrBody(event.target.value)}
                rows={6}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Branch</label>
              <Input value={prBranch} onChange={(event) => setPrBranch(event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createPRMutation.mutate()} disabled={createPRMutation.isPending}>
              {createPRMutation.isPending ? (
                <>
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create PR'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={triggerPlanningModalOpen}
        onClose={() => setTriggerPlanningModalOpen(false)}
        onConfirm={() => triggerPlanningMutation.mutate()}
        title="Re-execute Planning Stage"
        description="This will re-run the planning stage for this issue. Any existing plan will be replaced with a new analysis."
        confirmText="Re-execute"
        cancelText="Cancel"
        variant="warning"
        loading={triggerPlanningMutation.isPending}
      />
    </motion.div>
  )
}

function formatTimestamp(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString()
}

function StatusBadge({
  label,
  accent,
  state,
}: {
  label: string
  accent: keyof typeof ACCENT_CLASSES
  state: 'success' | 'active' | 'muted'
}) {
  const accentClasses = ACCENT_CLASSES[accent]
  const color =
    state === 'success'
      ? accentClasses.badge
      : state === 'active'
        ? accentClasses.text
        : 'text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
        state === 'success' && accentClasses.badge,
        state === 'active' && 'border-current',
        state === 'muted' && 'border-border/50',
        color,
      )}
    >
      {state === 'success' && <CheckCircledIcon className="mr-1 h-3.5 w-3.5" />}
      {label}
    </span>
  )
}

function MetricGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }[]
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground/80">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {item.label}
            </div>
            <div className="mt-2 text-foreground">{item.value}</div>
          </div>
        )
      })}
    </div>
  )
}

function ContextCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-black/20 px-4 py-6 text-center text-xs text-muted-foreground">
      {message}
    </div>
  )
}
