"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  GitBranch,
  Github,
  GitPullRequest,
  Loader2,
  Lock,
  Package,
  FileText,
  Code,
  FlaskConical,
  Rocket,
  RefreshCw,
  ChevronRight,
  Info,
  Calendar,
  MessageSquare
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { DeploymentStage } from "./stages/deployment-stage"
import { PlanningStage } from "./stages/planning-stage"
import { ImplementationStage } from "./stages/implementation-stage"
import { TestingStage } from "./stages/testing-stage"
import { DeployStage } from "./stages/deploy-stage"
import { PRStage } from "./stages/pr-stage"
import { StageKey } from "./stage-progress-rail"
import { format } from "date-fns"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"

interface IssueResolutionWorkflowProps {
  taskId: string
  projectId: string
  issueNumber: number
  issueTitle: string
  issueBody?: string
  issueUrl?: string
  resolution: any
}

const stageMeta: Record<StageKey, {
  title: string
  description: string
  icon: any
  color: string
  lightBg: string
}> = {
  deployment: {
    title: 'Deployment',
    description: 'Setting up workspace and initializing environment',
    icon: Package,
    color: 'text-blue-600',
    lightBg: 'bg-blue-50 dark:bg-blue-950/20'
  },
  planning: {
    title: 'Planning',
    description: 'Analyzing requirements and creating implementation strategy',
    icon: FileText,
    color: 'text-purple-600',
    lightBg: 'bg-purple-50 dark:bg-purple-950/20'
  },
  implementation: {
    title: 'Implementation',
    description: 'Executing the plan and making code changes',
    icon: Code,
    color: 'text-emerald-600',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/20'
  },
  deploy: {
    title: 'Deploy',
    description: 'Building and deploying the application',
    icon: Rocket,
    color: 'text-orange-600',
    lightBg: 'bg-orange-50 dark:bg-orange-950/20'
  },
  testing: {
    title: 'Testing',
    description: 'Running tests and verifying changes',
    icon: FlaskConical,
    color: 'text-green-600',
    lightBg: 'bg-green-50 dark:bg-green-950/20'
  },
  pr: {
    title: 'Pull Request',
    description: 'Package your work and share it on GitHub',
    icon: GitPullRequest,
    color: 'text-sky-600',
    lightBg: 'bg-sky-50 dark:bg-sky-950/20'
  }
}

const stageOrder: StageKey[] = ['deployment', 'planning', 'implementation', 'deploy', 'testing', 'pr']

export function IssueResolutionWorkflow({
  taskId,
  projectId,
  issueNumber,
  issueTitle,
  issueBody,
  issueUrl,
  resolution
}: IssueResolutionWorkflowProps) {
  const [focusedStage, setFocusedStage] = useState<StageKey>('deployment')
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [showIssueDetails, setShowIssueDetails] = useState(false)

  const { data: stageStatus, isLoading, refetch } = useQuery({
    queryKey: ['issue-resolution-stage-status', projectId, issueNumber],
    queryFn: () => api.getIssueResolutionStageStatus(projectId, issueNumber),
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (stageStatus?.current_stage) {
      // If resolution is ready for PR, show testing stage
      if (stageStatus.resolution_state === 'ready_for_pr') {
        setFocusedStage('testing')
      }
      // If current_stage is "completed", show the last completed stage or testing
      else if (stageStatus.current_stage === 'completed') {
        // Show testing if available, otherwise show deploy
        setFocusedStage(stageStatus.stages?.testing ? 'testing' : 'deploy')
      }
      // Otherwise use the current_stage if it's a valid stage
      else if (stageOrder.includes(stageStatus.current_stage as StageKey)) {
        setFocusedStage(stageStatus.current_stage as StageKey)
      }
    }
  }, [stageStatus?.current_stage, stageStatus?.resolution_state])

  const mergedStages = useMemo(() => {
    if (!stageStatus?.stages) return undefined

    const planningStage = stageStatus.stages.planning || {}
    const implementationStage = stageStatus.stages.implementation || {}
    const deployStage = stageStatus.stages.deploy || {}
    const prStage = stageStatus.stages.pr || {}

    return {
      ...stageStatus.stages,
      planning: {
        ...planningStage,
        session_id: planningStage.session_id || resolution?.planning_session_id,
        chat_id: planningStage.chat_id || resolution?.planning_chat_id,
      },
      implementation: {
        ...implementationStage,
        session_id: implementationStage.session_id || resolution?.implementation_session_id,
        chat_id: implementationStage.chat_id || resolution?.implementation_chat_id,
      },
      deploy: {
        ...deployStage,
        session_id: deployStage.session_id || resolution?.deploy_session_id || implementationStage.session_id || resolution?.implementation_session_id || resolution?.session_id || taskId,
        chat_id: deployStage.chat_id || resolution?.deploy_chat_id || implementationStage.chat_id || resolution?.implementation_chat_id || resolution?.chat_id || taskId,
      },
      pr: {
        ...prStage,
        complete: prStage.complete ?? Boolean(resolution?.pr_number),
        pr_number: prStage.pr_number || resolution?.pr_number,
        pr_url: prStage.pr_url || resolution?.pr_url,
        pr_state: prStage.pr_state || resolution?.pr_state,
        started_at: prStage.started_at || resolution?.pr_created_at || deployStage.completed_at || null,
        completed_at: prStage.completed_at || resolution?.pr_created_at || null,
      }
    }
  }, [stageStatus, resolution, taskId])

  const prStageData = mergedStages?.pr || stageStatus?.stages?.pr
  const prUnlocked = Boolean(
    mergedStages?.deployment?.complete &&
    mergedStages?.planning?.approved &&
    mergedStages?.implementation?.complete
  )

  const handleShowIssueDetails = () => {
    if (issueBody) {
      setShowIssueDetails(true)
    }
  }

  const activeStage: StageKey = focusedStage
  const activeStageData = mergedStages?.[activeStage] || stageStatus?.stages?.[activeStage]
  const activeMeta = stageMeta[activeStage]
  const ActiveIcon = activeMeta?.icon

  const getStageStatus = (stageName: StageKey) => {
    if (!stageStatus) return 'pending'

    // Use mergedStages first, fallback to stageStatus.stages
    const stages = mergedStages || stageStatus.stages
    if (!stages) return 'pending'

    // Check if this specific stage is complete (highest priority)
    if (stages[stageName]?.complete) return 'completed'

    const currentIndex = stageOrder.indexOf(stageStatus.current_stage)
    const stageIndex = stageOrder.indexOf(stageName)

    // If current_stage is not in stageOrder (e.g., "completed"), use fallback logic
    if (currentIndex === -1) {
      // Check if stage has started but not completed
      if (stages[stageName]?.started_at) return 'active'
      return 'pending'
    }

    if (stageIndex < currentIndex) return 'completed'
    if (stageIndex === currentIndex) {
      if (stageStatus.error_message) return 'failed'
      return 'active'
    }
    return 'pending'
  }

  const canApprovePlan = stageStatus?.current_stage === 'planning'
    && mergedStages?.planning?.complete
    && !mergedStages?.planning?.approved
    && !!mergedStages?.planning?.session_id

  const handleApprovePlan = async () => {
    setIsApproving(true)
    try {
      const planningSessionId = mergedStages?.planning?.session_id
      if (!planningSessionId) {
        toast.error("Missing planning session information")
        return
      }

      await api.approvePlanAndStartImplementation(projectId, issueNumber, planningSessionId, approvalNotes)
      toast.success("Plan approved! Implementation starting...")
      setShowApprovalDialog(false)
      setApprovalNotes("")
      refetch()
    } catch (error) {
      toast.error("Failed to approve plan")
    } finally {
      setIsApproving(false)
    }
  }

  const handleRetryStage = async () => {
    try {
      await api.retryIssueResolutionStage(projectId, issueNumber)
      toast.success("Stage retry initiated")
      refetch()
    } catch (error) {
      toast.error("Failed to retry stage")
    }
  }

  const handleTriggerDeploy = async () => {
    try {
      await api.triggerDeployStage(projectId, issueNumber)
      toast.success("Deploy stage started")
      refetch()
    } catch (error) {
      toast.error("Failed to start deploy stage")
    }
  }

  const currentStageIndex = stageOrder.indexOf(stageStatus?.current_stage || 'deployment')
  const progressPercentage = ((currentStageIndex + 1) / stageOrder.length) * 100

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Beautiful Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-muted/30 dark:from-card dark:to-muted/10 border border-border/40 shadow-xl"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />

          <div className="relative p-8">
            <div className="flex items-start justify-between gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                    <GitBranch className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">#{issueNumber}</span>
                      {stageStatus && (
                        <Badge className={cn(
                          "px-3 py-1",
                          stageStatus.error_message ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full mr-2",
                            stageStatus.error_message ? "bg-red-500 animate-pulse" : "bg-primary animate-pulse"
                          )} />
                          {stageStatus.resolution_state}
                        </Badge>
                      )}
                      {issueUrl && (
                        <Button variant="outline" size="sm" asChild className="h-7 px-3 text-xs gap-1">
                          <Link href={issueUrl} target="_blank" rel="noopener noreferrer">
                            <Github className="h-3.5 w-3.5" />
                            View on GitHub
                          </Link>
                        </Button>
                      )}
                    </div>
                    <h1
                      className={cn(
                        "text-2xl font-bold tracking-tight",
                        issueBody && "cursor-pointer hover:text-primary transition-colors"
                      )}
                      onClick={handleShowIssueDetails}
                      onKeyDown={(e) => {
                        if (!issueBody) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleShowIssueDetails()
                        }
                      }}
                      role={issueBody ? 'button' : undefined}
                      tabIndex={issueBody ? 0 : -1}
                    >
                      {issueTitle}
                    </h1>
                  </div>
                </div>
                {issueBody && (
                  <button
                    type="button"
                    onClick={handleShowIssueDetails}
                    className="text-left text-sm text-muted-foreground leading-relaxed line-clamp-2 pl-18 hover:text-foreground"
                  >
                    {issueBody}
                    <span className="mt-1 block text-xs text-primary font-semibold">Click to view full description</span>
                  </button>
                )}
              </div>

              {stageStatus && (
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-4xl font-bold">{stageStatus.retry_count}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Retries</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Professional Stage Progress */}
        {stageStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-2xl bg-card/50 backdrop-blur-sm border border-border/40 p-8">
              <div className="relative">
                {/* Progress Bar */}
                <div className="absolute left-0 right-0 top-6 h-1 bg-border/30 rounded-full" />
                <motion.div
                  className="absolute left-0 top-6 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-emerald-500 via-orange-500 to-green-500 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />

                {/* Stages */}
                <div className="relative flex items-start justify-between">
                  {stageOrder.map((stageKey, index) => {
                    const status = getStageStatus(stageKey)
                    const meta = stageMeta[stageKey]
                    const Icon = meta.icon
                    const isActive = stageKey === stageStatus.current_stage
                    const isCompleted = status === 'completed'
                    const isSelected = stageKey === activeStage
                    const isLocked = stageKey === 'pr' && !prUnlocked

                    return (
                      <motion.button
                        key={stageKey}
                        onClick={() => setFocusedStage(stageKey)}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          "relative flex flex-col items-center gap-3 group flex-1",
                          isLocked && "opacity-60"
                        )}
                      >
                        {/* Icon Circle */}
                        <div className="relative">
                          <motion.div
                            className={cn(
                              "flex h-14 w-14 items-center justify-center rounded-full border-2 bg-background shadow-lg transition-all",
                              isCompleted && "border-green-500 shadow-green-500/20",
                              isActive && !isCompleted && "border-primary shadow-primary/20",
                              !isActive && !isCompleted && "border-border/40",
                              isLocked && !isCompleted && "opacity-70"
                            )}
                            whileHover={{ scale: 1.1 }}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-6 w-6 text-green-500" />
                            ) : isLocked ? (
                              <Lock className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Icon className={cn(
                                "h-6 w-6",
                                isActive && meta.color,
                                !isActive && "text-muted-foreground"
                              )} />
                            )}
                          </motion.div>

                          {/* Pulse Animation */}
                          {isActive && !isCompleted && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-2 border-primary"
                              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                        </div>

                        {/* Label */}
                        <div className="space-y-1 text-center">
                          <p className={cn(
                            "text-sm font-semibold transition-colors",
                            isCompleted && "text-green-600",
                            isActive && !isCompleted && "text-foreground",
                            !isActive && !isCompleted && "text-muted-foreground"
                          )}>
                            {meta.title}
                          </p>
                          {mergedStages?.[stageKey]?.completed_at && (
                            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(mergedStages[stageKey].completed_at), 'HH:mm')}
                            </p>
                          )}
                        </div>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <motion.div
                            layoutId="activeStage"
                            className="absolute -inset-3 rounded-2xl border-2 border-primary/40 bg-primary/5"
                            initial={false}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Content Area */}
        {stageStatus && activeMeta && (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Left: Stage Content */}
            <div className="space-y-6">
              {/* Stage Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-card/50 backdrop-blur-sm border border-border/40 p-6"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", activeMeta.lightBg)}>
                      {ActiveIcon && <ActiveIcon className={cn("h-6 w-6", activeMeta.color)} />}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold mb-1">{activeMeta.title}</h2>
                      <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
                    </div>
                  </div>
                  <Badge className={cn(
                    "px-3 py-1",
                    getStageStatus(activeStage) === 'completed' && "bg-green-500/10 text-green-600 border-green-500/20",
                    getStageStatus(activeStage) === 'active' && "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {getStageStatus(activeStage)}
                  </Badge>
                </div>

                {(activeStageData?.session_id || activeStageData?.started_at || activeStageData?.completed_at) && (
                  <div className="flex items-center gap-4 pb-6 border-b border-border/40">
                    {activeStageData?.session_id && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-primary/60" />
                        <code className="font-mono text-muted-foreground">{activeStageData.session_id.slice(0, 8)}</code>
                      </div>
                    )}
                    {activeStageData?.started_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Started {format(new Date(activeStageData.started_at), 'HH:mm')}
                      </div>
                    )}
                    {activeStageData?.completed_at && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Done {format(new Date(activeStageData.completed_at), 'HH:mm')}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Stage Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStage}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {activeStage === 'deployment' && (
                    <DeploymentStage taskId={taskId} stageData={activeStageData} resolution={resolution} />
                  )}
                  {activeStage === 'planning' && (
                    <PlanningStage
                      taskId={taskId}
                      sessionId={mergedStages?.planning?.session_id}
                      chatId={mergedStages?.planning?.chat_id}
                      stageData={mergedStages?.planning}
                      onApprove={() => setShowApprovalDialog(true)}
                      canApprove={Boolean(mergedStages?.planning?.session_id)}
                    />
                  )}
                  {activeStage === 'implementation' && (
                    <ImplementationStage
                      taskId={taskId}
                      sessionId={mergedStages?.implementation?.session_id}
                      chatId={mergedStages?.implementation?.chat_id}
                      stageData={mergedStages?.implementation}
                    />
                  )}
                  {activeStage === 'testing' && (
                    <TestingStage taskId={taskId} stageData={activeStageData} />
                  )}
                  {activeStage === 'deploy' && (
                    <DeployStage
                      taskId={taskId}
                      projectId={projectId}
                      issueNumber={issueNumber}
                      stageData={activeStageData}
                      onTriggerDeploy={handleTriggerDeploy}
                    />
                  )}
                  {activeStage === 'pr' && (
                    <PRStage
                      projectId={projectId}
                      issueNumber={issueNumber}
                      issueTitle={issueTitle}
                      stageData={prStageData}
                      canCreate={prUnlocked}
                      onCreated={refetch}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right: Quick Actions */}
            <div className="space-y-6">
              {/* Error Alert */}
              {stageStatus?.error_message && (
                <Alert variant="destructive" className="border-2">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="mt-2">
                    <p className="font-semibold mb-2">Error in {stageStatus.current_stage}</p>
                    <p className="text-sm mb-3">{stageStatus.error_message}</p>
                    <Button variant="outline" size="sm" onClick={handleRetryStage}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Stage
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Next Action */}
              {stageStatus?.next_action && (
                <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Next Action</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Recommended step</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4">{stageStatus.next_action}</p>
                  {canApprovePlan && (
                    <Button onClick={() => setShowApprovalDialog(true)} className="w-full">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve Plan
                    </Button>
                  )}
                </div>
              )}

              {/* Task UI Links */}
              {activeStage === 'deploy' && (activeStageData?.started_at || activeStageData?.complete) && (
                <div className="space-y-4">
                  {/* Normal Chat Link */}
                  <Link href={`/p/${projectId}/t/${taskId}?tab=chat`}>
                    <div className="rounded-2xl border bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-6 hover:border-cyan-500/30 transition-all cursor-pointer group">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                          <MessageSquare className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold mb-1 group-hover:text-cyan-500 transition-colors">Normal Chat Mode</h3>
                          <p className="text-xs text-muted-foreground">Standard task chat interface</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-cyan-500 group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Open the regular chat interface for this task with full conversational AI support.
                      </p>
                    </div>
                  </Link>

                  {/* Full Task View Link */}
                  <Link href={`/p/${projectId}/t/${taskId}`}>
                    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-6 hover:border-primary/30 transition-all cursor-pointer group">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Rocket className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold mb-1 group-hover:text-primary transition-colors">Full Task View</h3>
                          <p className="text-xs text-muted-foreground">Complete task interface</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Access all task features: deployment logs, test cases, knowledge base, and more.
                      </p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      {issueBody && (
        <Dialog open={showIssueDetails} onOpenChange={setShowIssueDetails}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader className="flex flex-col gap-2">
              <DialogTitle className="text-2xl font-bold">Issue #{issueNumber}</DialogTitle>
              <DialogDescription>
                Full GitHub issue description rendered with formatting.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{issueBody}</ReactMarkdown>
              </div>
            </ScrollArea>
            {issueUrl && (
              <Button variant="outline" className="mt-4" asChild>
                <Link href={issueUrl} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4 mr-2" /> View on GitHub
                </Link>
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-green-100 dark:bg-green-900/30 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <DialogTitle className="text-xl">Approve Planning Stage</DialogTitle>
            </div>
            <DialogDescription>
              Review the plan and approve to start implementation. Implementation will run with automatic tool execution enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="notes" className="text-sm font-semibold mb-2 block">
                Approval Notes (Optional)
              </label>
              <Textarea
                id="notes"
                placeholder="Add any notes, guardrails, or specific instructions..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)} disabled={isApproving}>
              Cancel
            </Button>
            <Button onClick={handleApprovePlan} disabled={isApproving}>
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve & Start
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
