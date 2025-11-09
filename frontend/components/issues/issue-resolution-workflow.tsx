"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Check,
  Clock,
  Code,
  FlaskConical,
  Package,
  FileText,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  GitBranch,
  Bot
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { DeploymentStage } from "./stages/deployment-stage"
import { PlanningStage } from "./stages/planning-stage"
import { ImplementationStage } from "./stages/implementation-stage"
import { TestingStage } from "./stages/testing-stage"
import { StageTimeline } from "./stage-timeline"
import { format } from "date-fns"
import { toast } from "sonner"

interface IssueResolutionWorkflowProps {
  taskId: string
  projectId: string
  issueNumber: number
  issueTitle: string
  issueBody?: string
  resolution: any // From parent component
}

const stageIcons = {
  deployment: Package,
  planning: FileText,
  implementation: Code,
  testing: FlaskConical,
}

const stageColors = {
  deployment: "text-blue-600 bg-blue-50 border-blue-200",
  planning: "text-purple-600 bg-purple-50 border-purple-200",
  implementation: "text-amber-600 bg-amber-50 border-amber-200",
  testing: "text-green-600 bg-green-50 border-green-200",
}

const stageDescriptions = {
  deployment: "Setting up the development environment and initializing the workspace",
  planning: "Analyzing the issue and creating a detailed implementation plan",
  implementation: "Writing code to resolve the issue according to the approved plan",
  testing: "Generating and running tests to verify the solution"
}

export function IssueResolutionWorkflow({
  taskId,
  projectId,
  issueNumber,
  issueTitle,
  issueBody,
  resolution
}: IssueResolutionWorkflowProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState("")
  const [isApproving, setIsApproving] = useState(false)

  // Fetch stage status
  const { data: stageStatus, isLoading, refetch } = useQuery({
    queryKey: ['issue-resolution-stage-status', projectId, issueNumber],
    queryFn: () => api.getIssueResolutionStageStatus(projectId, issueNumber),
    refetchInterval: 5000, // Poll every 5 seconds
  })

  // Auto-expand current active stage
  useEffect(() => {
    if (stageStatus?.current_stage && !expandedStage) {
      setExpandedStage(stageStatus.current_stage)
    }
  }, [stageStatus?.current_stage])

  const handleApprovePlan = async () => {
    setIsApproving(true)
    try {
      // Get the session_id from the planning stage
      const planningSessionId = stageStatus?.stages?.planning?.session_id
      if (!planningSessionId) {
        toast.error("Missing planning session information. Please try again.")
        setIsApproving(false)
        return
      }

      await api.approvePlanAndStartImplementation(projectId, issueNumber, planningSessionId, approvalNotes)
      toast.success("Plan approved! Implementation has started.")
      setShowApprovalDialog(false)
      setApprovalNotes("")
      refetch()
    } catch (error) {
      toast.error("Failed to approve plan. Please try again.")
      console.error("Failed to approve plan:", error)
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
      console.error("Failed to retry stage:", error)
    }
  }

  const getStageStatus = (stageName: string) => {
    if (!stageStatus) return 'pending'

    const stages = ['deployment', 'planning', 'implementation', 'testing']
    const currentIndex = stages.indexOf(stageStatus.current_stage)
    const stageIndex = stages.indexOf(stageName)

    if (stageIndex < currentIndex) return 'completed'
    if (stageIndex === currentIndex) {
      if (stageStatus.stages[stageName]?.complete) return 'completed'
      if (stageStatus.error_message) return 'failed'
      return 'active'
    }
    return 'pending'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Issue Info */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-xl">Issue #{issueNumber}: {issueTitle}</CardTitle>
              </div>
              {issueBody && (
                <CardDescription className="mt-2 text-sm line-clamp-2">
                  {issueBody}
                </CardDescription>
              )}
            </div>
            {stageStatus && (
              <Badge
                variant={stageStatus.error_message ? "destructive" : "default"}
                className="ml-4"
              >
                {stageStatus.resolution_state}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Visual Timeline */}
      {stageStatus && (
        <StageTimeline
          currentStage={stageStatus.current_stage}
          stages={stageStatus.stages}
        />
      )}

      {/* Error Alert */}
      {stageStatus?.error_message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error in {stageStatus.current_stage} stage</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{stageStatus.error_message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryStage}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Stage
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Next Action Card */}
      {stageStatus && stageStatus.next_action && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Next Action Required</CardTitle>
              </div>
              {stageStatus.current_stage === 'planning' && stageStatus.stages.planning?.complete && !stageStatus.stages.planning?.approved && (
                <Button
                  onClick={() => setShowApprovalDialog(true)}
                  className="ml-4"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve Plan
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{stageStatus.next_action}</p>
          </CardContent>
        </Card>
      )}

      {/* Stage Cards */}
      <div className="space-y-4">
        {['deployment', 'planning', 'implementation', 'testing'].map((stageName) => {
          const Icon = stageIcons[stageName as keyof typeof stageIcons]
          const status = getStageStatus(stageName)
          const stageData = stageStatus?.stages[stageName as keyof typeof stageStatus.stages]
          const isExpanded = expandedStage === stageName
          const isActive = status === 'active'
          const isCompleted = status === 'completed'
          const isFailed = status === 'failed'

          return (
            <motion.div
              key={stageName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className={cn(
                  "transition-all duration-300",
                  isActive && "ring-2 ring-primary ring-offset-2",
                  isCompleted && "border-green-500",
                  isFailed && "border-destructive"
                )}
              >
                <Collapsible
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedStage(open ? stageName : null)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg border",
                            stageColors[stageName as keyof typeof stageColors]
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <CardTitle className="text-base capitalize">
                              {stageName} Stage
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {stageDescriptions[stageName as keyof typeof stageDescriptions]}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Status Indicator */}
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <Badge variant="default" className="animate-pulse">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Active
                              </Badge>
                            )}
                            {isCompleted && (
                              <Badge variant="success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complete
                              </Badge>
                            )}
                            {isFailed && (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                            {status === 'pending' && (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          {/* Expand/Collapse Icon */}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <AnimatePresence mode="wait">
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {stageName === 'deployment' && (
                              <DeploymentStage
                                taskId={taskId}
                                stageData={stageData}
                                resolution={resolution}
                              />
                            )}
                            {stageName === 'planning' && (
                              <PlanningStage
                                taskId={taskId}
                                sessionId={stageData?.session_id}
                                chatId={stageData?.chat_id}
                                stageData={stageData}
                                onApprove={() => setShowApprovalDialog(true)}
                              />
                            )}
                            {stageName === 'implementation' && (
                              <ImplementationStage
                                taskId={taskId}
                                sessionId={stageData?.session_id}
                                chatId={stageData?.chat_id}
                                stageData={stageData}
                              />
                            )}
                            {stageName === 'testing' && (
                              <TestingStage
                                taskId={taskId}
                                stageData={stageData}
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Approve Planning Stage</DialogTitle>
            <DialogDescription>
              Review the plan and approve to start implementation. The implementation will run with automatic tool execution enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Approval Notes (Optional)
              </label>
              <Textarea
                id="notes"
                placeholder="Add any notes or instructions for the implementation..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprovePlan}
              disabled={isApproving}
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve & Start Implementation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}