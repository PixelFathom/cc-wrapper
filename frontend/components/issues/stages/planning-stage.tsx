"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  MessageSquare,
  Target,
  Shield,
  TestTube,
  ChevronRight,
  User,
  Calendar,
  ThumbsUp,
  Eye,
  Sparkles
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'
import { motion } from "framer-motion"

interface PlanningStageProps {
  taskId: string
  sessionId?: string
  chatId?: string
  stageData: any
  onApprove: () => void
}

export function PlanningStage({ taskId, sessionId, chatId, stageData, onApprove }: PlanningStageProps) {
  // Fetch chat messages for the planning session
  const { data: chats } = useQuery({
    queryKey: ['session-chats', sessionId],
    queryFn: () => sessionId ? api.getSessionChats(sessionId) : Promise.resolve({ chats: [] }),
    enabled: !!sessionId,
    refetchInterval: !stageData?.complete ? 5000 : false,
  })

  // Parse the plan from chat messages
  const getPlanContent = () => {
    if (!chats?.chats) return null
    const assistantMessages = chats.chats.filter((chat: any) => chat.role === 'assistant')
    return assistantMessages[assistantMessages.length - 1]?.content?.text || null
  }

  const planContent = getPlanContent()

  // Extract plan sections (if the AI response is structured)
  const extractPlanSections = (content: string) => {
    const sections = {
      analysis: '',
      approach: '',
      risks: '',
      testing: '',
      effort: ''
    }

    if (!content) return sections

    // Try to extract sections based on markdown headers
    const analysisMatch = content.match(/##?\s*(?:Issue\s*)?Analysis[\s\S]*?(?=##|$)/i)
    const approachMatch = content.match(/##?\s*(?:Proposed\s*)?Solution[\s\S]*?(?=##|$)/i)
    const risksMatch = content.match(/##?\s*Risk\s*Assessment[\s\S]*?(?=##|$)/i)
    const testingMatch = content.match(/##?\s*Testing\s*Strategy[\s\S]*?(?=##|$)/i)
    const effortMatch = content.match(/##?\s*Estimated\s*Effort[\s\S]*?(?=##|$)/i)

    sections.analysis = analysisMatch?.[0] || ''
    sections.approach = approachMatch?.[0] || ''
    sections.risks = risksMatch?.[0] || ''
    sections.testing = testingMatch?.[0] || ''
    sections.effort = effortMatch?.[0] || ''

    return sections
  }

  const planSections = planContent ? extractPlanSections(planContent) : null

  const isWaitingForPlan = !stageData?.complete && !planContent
  const isPlanReady = stageData?.complete && !stageData?.approved
  const isPlanApproved = stageData?.approved

  return (
    <div className="space-y-4">
      {/* Stage Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge
            variant={
              isPlanApproved ? "success" :
              isPlanReady ? "warning" :
              stageData?.complete ? "default" :
              "secondary"
            }
          >
            {isPlanApproved ? 'Approved' :
             isPlanReady ? 'Awaiting Approval' :
             stageData?.complete ? 'Complete' :
             'In Progress'}
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
          <p className="text-xs text-muted-foreground">Session</p>
          <p className="text-sm font-mono text-muted-foreground">
            {sessionId ? sessionId.slice(0, 8) : '-'}
          </p>
        </div>
      </div>

      <Separator />

      {/* Approval Status Card */}
      {isPlanReady && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Plan Ready for Review</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">The AI has completed the analysis and planning. Please review the plan below and approve to proceed with implementation.</p>
              <Button onClick={onApprove} className="w-full sm:w-auto">
                <ThumbsUp className="h-4 w-4 mr-2" />
                Review & Approve Plan
              </Button>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Approved Status */}
      {isPlanApproved && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Plan Approved</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {stageData?.approved_by && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3 w-3" />
                  <span>Approved by: User</span>
                </div>
              )}
              {stageData?.approved_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3 w-3" />
                  <span>Approved at: {format(new Date(stageData.approved_at), 'MMM d, HH:mm')}</span>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isWaitingForPlan && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Analyzing issue and creating plan...</p>
            <p className="text-xs text-muted-foreground mt-2">This may take a few moments</p>
          </CardContent>
        </Card>
      )}

      {/* Plan Content */}
      {planContent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Implementation Plan
            </h3>
            <Badge variant="outline">AI Generated</Badge>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Full Plan</TabsTrigger>
              <TabsTrigger value="chat">Chat History</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {planSections && (
                <>
                  {/* Analysis Section */}
                  {planSections.analysis && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Issue Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-32 w-full">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{planSections.analysis}</ReactMarkdown>
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Solution Approach */}
                  {planSections.approach && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Solution Approach
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-32 w-full">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{planSections.approach}</ReactMarkdown>
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Risk Assessment */}
                  {planSections.risks && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Risk Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-32 w-full">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{planSections.risks}</ReactMarkdown>
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Testing Strategy */}
                  {planSections.testing && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TestTube className="h-4 w-4" />
                          Testing Strategy
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-32 w-full">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{planSections.testing}</ReactMarkdown>
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Full Plan Tab */}
            <TabsContent value="details">
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-96 w-full">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{planContent}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chat History Tab */}
            <TabsContent value="chat">
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-96 w-full">
                    <div className="space-y-4">
                      {chats?.chats?.map((chat: any, index: number) => (
                        <div key={chat.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={chat.role === 'user' ? 'default' : 'secondary'}>
                              {chat.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(chat.created_at), 'HH:mm:ss')}
                            </span>
                          </div>
                          <div className="text-sm pl-4 border-l-2 border-muted">
                            <ReactMarkdown>
                              {chat.content?.text || JSON.stringify(chat.content)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}