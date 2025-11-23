"use client"

import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Github, CheckCircle2, Loader2, Lock, ExternalLink } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PRStageProps {
  projectId: string
  issueNumber: number
  issueTitle: string
  stageData?: any
  canCreate: boolean
  onCreated: () => void
}

export function PRStage({
  projectId,
  issueNumber,
  issueTitle,
  stageData,
  canCreate,
  onCreated
}: PRStageProps) {
  const defaultTitle = useMemo(
    () => `Fix issue #${issueNumber}: ${issueTitle}`,
    [issueNumber, issueTitle]
  )
  const defaultBody = useMemo(() => (
    `Resolves #${issueNumber}\n\nGenerated via automated issue resolution workflow.`
  ), [issueNumber])

  const [title, setTitle] = useState(defaultTitle)
  const [body, setBody] = useState(defaultBody)

  const mutation = useMutation({
    mutationFn: () => api.createIssueResolutionPR(projectId, issueNumber, { title, body }),
    onSuccess: (resp) => {
      toast.success(`Pull request #${resp.pr_number} created`)
      onCreated()
    },
    onError: async (error: any) => {
      const message = error?.detail || error?.message || 'Failed to create pull request'
      toast.error(message)
    }
  })

  if (stageData?.pr_number && stageData?.pr_url) {
    return (
      <Card className="border-green-200 bg-green-50/80 dark:bg-green-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/60 dark:bg-green-900/40 p-2">
              <Github className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Pull Request Ready</CardTitle>
              <CardDescription>Share this PR for review.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pull Request</p>
              <p className="text-lg font-bold">#{stageData.pr_number}</p>
            </div>
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {stageData?.pr_state || 'open'}
            </Badge>
          </div>
          <Button asChild variant="outline" className="w-full">
            <a href={stageData.pr_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />View Pull Request
            </a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!canCreate) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex items-center gap-3">
          <div className="rounded-lg bg-muted/60 p-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Pull Request Locked</CardTitle>
            <CardDescription>Complete deployment, planning approval, and implementation to unlock PR creation.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Github className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Create Pull Request</CardTitle>
            <CardDescription>Provide a title and summary before sharing with reviewers.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PR Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter pull request title" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[160px]"
            placeholder="Describe the changes and testing results"
          />
        </div>
        <Separator />
        <Button className="w-full font-semibold" onClick={() => mutation.mutate()} disabled={mutation.isLoading}>
          {mutation.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating PR...
            </>
          ) : (
            <>
              <Github className="h-4 w-4 mr-2" />
              Create Pull Request
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
