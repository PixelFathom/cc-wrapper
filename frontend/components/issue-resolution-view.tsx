"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2, RefreshCw } from "lucide-react"
import { IssueResolutionWorkflow } from "@/components/issues/issue-resolution-workflow"
import { getIssueResolutionStatus } from "@/lib/api/issue-resolution"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface IssueResolutionViewProps {
  projectId: string
  taskId: string
}

export function IssueResolutionView({ projectId, taskId }: IssueResolutionViewProps) {
  const { data: resolution, isLoading, error, refetch } = useQuery({
    queryKey: ['task-issue-resolution', projectId, taskId],
    queryFn: () => getIssueResolutionStatus(projectId, taskId),
    retry: 1,
  })

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading issue resolution workflow…</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !resolution) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load workflow</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>We couldn’t retrieve the resolution details for this task.</p>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-2" />Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <IssueResolutionWorkflow
      taskId={taskId}
      projectId={projectId}
      issueNumber={resolution.issue_number}
      issueTitle={resolution.issue_title || `Issue #${resolution.issue_number}`}
      issueBody={resolution.issue_body || undefined}
      resolution={resolution}
    />
  )
}
