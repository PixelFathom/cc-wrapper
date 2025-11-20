"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, GitBranch, RefreshCw, Settings } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { IssueResolutionWorkflow } from "@/components/issues/issue-resolution-workflow"
import api from "@/lib/api"
import { solveGitHubIssue } from "@/lib/api/issue-resolution"
import { toast } from "sonner"

export default function IssueResolutionPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const issueNumber = parseInt(params.issueNumber as string)

  // Fetch issue details
  const { data: issue, isLoading: isLoadingIssue } = useQuery({
    queryKey: ['github-issue', projectId, issueNumber],
    queryFn: () => api.getGithubIssue(projectId, issueNumber),
    retry: 1
  })

  // Fetch resolution status
  const { data: resolution, isLoading: isLoadingResolution, refetch: refetchResolution } = useQuery({
    queryKey: ['issue-resolution', projectId, issueNumber],
    queryFn: () => api.getIssueResolution(projectId, issueNumber),
    retry: 1
  })

  // Handle triggering resolution if not started
  const handleStartResolution = async () => {
    try {
      await solveGitHubIssue(projectId, issueNumber, {
        issue_title: issue?.title || `Issue #${issueNumber}`,
        issue_body: issue?.body || ''
      })
      toast.success("Issue resolution workflow started!")
      refetchResolution()
    } catch (error) {
      console.error("Failed to start resolution:", error)
      toast.error("Failed to start resolution workflow")
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    refetchResolution()
    toast.success("Refreshing resolution status...")
  }

  if (isLoadingIssue || isLoadingResolution) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/p/${projectId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-2xl font-bold">Issue Resolution</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Link href={`/p/${projectId}/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 max-w-6xl">
        {resolution ? (
          <IssueResolutionWorkflow
            taskId={resolution.task_id}
            projectId={projectId}
            issueNumber={issueNumber}
            issueTitle={issue?.title || resolution.issue_title || `Issue #${issueNumber}`}
            issueBody={issue?.body || resolution.issue_body}
            issueUrl={issue?.html_url}
            resolution={resolution}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Resolution Not Started</h2>
              <p className="text-muted-foreground max-w-md">
                This issue hasn't been queued for resolution yet. Start the automated workflow to analyze and fix the issue.
              </p>
            </div>
            <Button size="lg" onClick={handleStartResolution}>
              Start Resolution Workflow
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
