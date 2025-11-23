'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitHubLogoIcon,
  RocketIcon,
  ReloadIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
  ChatBubbleIcon,
  CalendarIcon,
  PersonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { motion } from 'framer-motion'
import { fetchProjectIssues, solveGitHubIssue, type GitHubIssue } from '@/lib/api/issue-resolution'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { useRouter } from 'next/navigation'
import { GitHubIssueDetailModal } from './github-issue-detail-modal'

interface GitHubIssuesListProps {
  projectId: string
}

export function GitHubIssuesList({ projectId }: GitHubIssuesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const perPage = 30
  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch issues with pagination
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['project-issues', projectId, stateFilter, currentPage],
    queryFn: () => fetchProjectIssues(projectId, {
      state: stateFilter,
      page: currentPage,
      per_page: perPage
    }),
  })

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: 'open' | 'closed' | 'all') => {
    setStateFilter(value)
    setCurrentPage(1)
  }

  // Solve issue mutation
  const solveMutation = useMutation({
    mutationFn: ({ issueNumber, issueTitle, issueBody }: { issueNumber: number; issueTitle: string; issueBody: string }) =>
      solveGitHubIssue(projectId, issueNumber, { issue_title: issueTitle, issue_body: issueBody }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-issues', projectId] })
      // Redirect to task page
      router.push(`/p/${data.project_id}/t/${data.task_id}`)
    },
  })

  // Filter issues based on search
  const filteredIssues = data?.issues.filter(issue =>
    issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.labels.some(label => label.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  const handleSolveIssue = (issueNumber: number, issueTitle: string, issueBody: string) => {
    if (confirm(`Create resolution task for issue #${issueNumber}?`)) {
      solveMutation.mutate({ issueNumber, issueTitle, issueBody })
    }
  }

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <GitHubLogoIcon className="h-6 w-6 text-cyan-500" />
          <h2 className="text-xl font-mono font-semibold">GitHub Issues</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="font-mono text-xs hover:text-cyan-500"
        >
          <ReloadIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Sync
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search issues..."
          className="flex-1 bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono"
        />
        <Select value={stateFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[140px] font-mono bg-card/50 border-muted-foreground/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>
          {filteredIssues.length} {filteredIssues.length === 1 ? 'issue' : 'issues'} found
        </span>
        {data && (
          <span className="flex items-center gap-2">
            <span className="text-green-400">
              {data.issues.filter(i => i.state === 'open').length} open
            </span>
            <span>•</span>
            <span className="text-purple-400">
              {data.issues.filter(i => i.state === 'closed').length} closed
            </span>
            <span>•</span>
            <span className="text-cyan-400">
              {data.issues.filter(i => i.has_resolution_task).length} with tasks
            </span>
          </span>
        )}
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <ReloadIcon className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
              <p className="text-sm font-mono text-muted-foreground">Loading issues...</p>
            </div>
          </div>
        ) : error ? (
          <div className="py-12 text-center space-y-4">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto" />
            <p className="text-red-400 font-mono text-sm">Failed to load issues</p>
            <Button onClick={() => refetch()} variant="outline" className="font-mono">
              <ReloadIcon className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <GitHubLogoIcon className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
            <div>
              <p className="text-muted-foreground font-mono text-sm">
                {searchQuery ? 'No issues match your search' : `No ${stateFilter} issues`}
              </p>
            </div>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <motion.div
              key={issue.number}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                setSelectedIssue(issue)
                setIsDetailModalOpen(true)
              }}
              className="p-4 rounded-lg border border-border bg-card/50 hover:border-cyan-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Title and Number */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground mt-1">#{issue.number}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-mono font-semibold text-cyan-400 mb-2 break-words">
                        {issue.title}
                      </h3>
                      {issue.body && (
                        <p className="text-xs text-muted-foreground font-mono line-clamp-2 mb-2">
                          {issue.body}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono flex-wrap">
                    <Badge variant="outline" className={getStateColor(issue.state)}>
                      {issue.state}
                    </Badge>

                    <span className="flex items-center gap-1">
                      <PersonIcon className="h-3 w-3" />
                      {issue.user}
                    </span>

                    <span className="flex items-center gap-1">
                      <ChatBubbleIcon className="h-3 w-3" />
                      {issue.comments_count}
                    </span>

                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {new Date(issue.updated_at).toLocaleDateString()}
                    </span>

                    {issue.has_resolution_task && (
                      <Badge variant="outline" className="text-green-400 border-green-500/50 bg-green-500/10">
                        <CheckCircledIcon className="h-3 w-3 mr-1" />
                        Task Created
                      </Badge>
                    )}
                  </div>

                  {/* Labels */}
                  {issue.labels.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {issue.labels.slice(0, 5).map(label => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/50"
                        >
                          {label}
                        </Badge>
                      ))}
                      {issue.labels.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{issue.labels.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {issue.has_resolution_task ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/p/${projectId}/t/${issue.resolution_task_id}`)}
                      className="font-mono text-xs hover:text-cyan-500 hover:border-cyan-500"
                    >
                      View Task
                    </Button>
                  ) : issue.state === 'open' ? (
                    <Button
                      size="sm"
                      onClick={() => handleSolveIssue(issue.number, issue.title, issue.body || '')}
                      disabled={solveMutation.isPending}
                      className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono text-xs"
                    >
                      {solveMutation.isPending ? (
                        <>
                          <ReloadIcon className="animate-spin h-3 w-3 mr-2" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <RocketIcon className="mr-2 h-3 w-3" />
                          Solve Issue
                        </>
                      )}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-purple-400">
                      Closed
                    </Badge>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(issue.html_url, '_blank')
                    }}
                    className="font-mono text-xs"
                  >
                    <GitHubLogoIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {data && !isLoading && filteredIssues.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
          <div className="text-xs font-mono text-muted-foreground">
            {data.total_pages ? (
              <span>
                Page {currentPage} of {data.total_pages} · {data.total} total issues
              </span>
            ) : (
              <span>
                Page {currentPage} · {filteredIssues.length} issues shown
                {data.has_next && ' · More available'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={!data.has_prev || isLoading}
              className="font-mono text-xs"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={!data.has_next || isLoading}
              className="font-mono text-xs"
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Issue Detail Modal */}
      <GitHubIssueDetailModal
        issue={selectedIssue}
        projectId={projectId}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        onSolveIssue={handleSolveIssue}
        solvingIssue={solveMutation.isPending}
      />
    </div>
  )
}
