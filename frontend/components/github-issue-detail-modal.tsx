'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GitHubLogoIcon,
  PersonIcon,
  ChatBubbleIcon,
  CalendarIcon,
  RocketIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons'
import { GitHubIssue } from '@/lib/api/issue-resolution'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

interface GitHubIssueDetailModalProps {
  issue: GitHubIssue | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSolveIssue?: (issueNumber: number) => void
  solvingIssue?: boolean
}

export function GitHubIssueDetailModal({
  issue,
  projectId,
  open,
  onOpenChange,
  onSolveIssue,
  solvingIssue = false,
}: GitHubIssueDetailModalProps) {
  const router = useRouter()

  if (!issue) return null

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'text-green-400 border-green-500/50 bg-green-500/10'
      case 'closed':
        return 'text-purple-400 border-purple-500/50 bg-purple-500/10'
      default:
        return 'text-gray-400 border-gray-500/50 bg-gray-500/10'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-mono text-2xl text-cyan-400 mb-3 break-words">
                {issue.title}
              </DialogTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                <span className="text-muted-foreground">#{issue.number}</span>
                <Badge variant="outline" className={getStateColor(issue.state)}>
                  {issue.state}
                </Badge>
                <span className="flex items-center gap-1">
                  <PersonIcon className="h-3 w-3" />
                  {issue.user}
                </span>
                <span className="flex items-center gap-1">
                  <ChatBubbleIcon className="h-3 w-3" />
                  {issue.comments_count} {issue.comments_count === 1 ? 'comment' : 'comments'}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" />
              <span>Created: {new Date(issue.created_at).toLocaleDateString()}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" />
              <span>Updated: {new Date(issue.updated_at).toLocaleDateString()}</span>
            </div>
            {issue.has_resolution_task && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-green-400 border-green-500/50 bg-green-500/10">
                  <CheckCircledIcon className="h-3 w-3 mr-1" />
                  Task Created
                </Badge>
              </>
            )}
          </div>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {issue.labels.map(label => (
                <Badge
                  key={label}
                  variant="outline"
                  className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/50"
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}

          {/* Description */}
          {issue.body && (
            <div className="border border-border rounded-lg p-4 bg-card/50">
              <h3 className="font-mono font-semibold text-sm mb-3">Description</h3>
              <div className="prose prose-sm prose-invert max-w-none font-mono text-xs">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    code: ({ node, inline, ...props }: any) =>
                      inline ? (
                        <code className="bg-muted px-1 py-0.5 rounded text-cyan-400" {...props} />
                      ) : (
                        <code className="block bg-muted p-2 rounded my-2 overflow-x-auto" {...props} />
                      ),
                    a: ({ node, ...props }) => (
                      <a className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                    ),
                  }}
                >
                  {issue.body}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => window.open(issue.html_url, '_blank')}
              className="font-mono text-xs"
            >
              <GitHubLogoIcon className="h-4 w-4 mr-2" />
              View on GitHub
            </Button>

            {issue.has_resolution_task ? (
              <Button
                onClick={() => {
                  router.push(`/p/${projectId}/t/${issue.resolution_task_id}`)
                  onOpenChange(false)
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono text-xs"
              >
                <RocketIcon className="h-4 w-4 mr-2" />
                View Task
              </Button>
            ) : issue.state === 'open' && onSolveIssue ? (
              <Button
                onClick={() => {
                  onSolveIssue(issue.number)
                  onOpenChange(false)
                }}
                disabled={solvingIssue}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono text-xs"
              >
                <RocketIcon className="h-4 w-4 mr-2" />
                Solve Issue
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
