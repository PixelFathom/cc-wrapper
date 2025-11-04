'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitHubLogoIcon,
  RocketIcon,
  ReloadIcon,
  StarIcon,
  CodeIcon,
  ExclamationTriangleIcon,
  ChatBubbleIcon,
  CalendarIcon,
  PersonIcon,
  Cross2Icon,
  CheckCircledIcon,
  Share2Icon,
  LockClosedIcon,
  LockOpen1Icon,
} from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { ConfirmationModal } from './ui/confirmation-modal'
import { fetchGitHubRepositories, type GitHubRepository } from '@/lib/api/github-repositories'
import { solveGitHubIssue, fetchProjectIssues } from '@/lib/api/issue-resolution'
import { api, type Project } from '@/lib/api'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  labels: string[]  // Backend returns string array, not objects
  html_url: string
  user: string  // Backend returns just the username
  created_at: string
  updated_at: string
  comments_count: number
  has_resolution_task: boolean
  resolution_task_id: string | null
}

interface IssueDetailModalProps {
  issue: GitHubIssue | null
  repo: GitHubRepository | null
  onClose: () => void
  onSolve: (issueNumber: number) => void
  solving: boolean
}

function IssueDetailModal({ issue, repo, onClose, onSolve, solving }: IssueDetailModalProps) {
  const [showSolveConfirmation, setShowSolveConfirmation] = useState(false)

  if (!issue || !repo) return null

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-cyan-500/50 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          >
          {/* Header */}
          <div className="border-b border-border bg-card/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitHubLogoIcon className="h-6 w-6 text-cyan-500" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {repo.full_name} #{issue.number}
                  </span>
                  <Badge variant="outline" className={
                    issue.state === 'open'
                      ? 'text-green-400 border-green-500/50 bg-green-500/10'
                      : 'text-purple-400 border-purple-500/50 bg-purple-500/10'
                  }>
                    {issue.state}
                  </Badge>
                </div>
                <h2 className="text-lg font-mono font-semibold text-cyan-400 mt-1">
                  {issue.title}
                </h2>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-red-500/10 hover:text-red-400"
            >
              <Cross2Icon className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
            {/* Author & Metadata */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
              <div className="w-10 h-10 rounded-full ring-2 ring-cyan-500/50 bg-cyan-500/20 flex items-center justify-center">
                <PersonIcon className="h-6 w-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-mono">
                  <PersonIcon className="h-4 w-4 text-cyan-500" />
                  <span className="text-cyan-400">@{issue.user}</span>
                  <span className="text-muted-foreground">opened this issue</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-mono">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {new Date(issue.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <ChatBubbleIcon className="h-3 w-3" />
                    {issue.comments_count} comments
                  </span>
                </div>
              </div>
            </div>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-6">
                {issue.labels.map((label) => (
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

            {/* Body */}
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-cyan-400 prose-headings:font-mono
              prose-p:text-foreground/90 prose-p:font-mono prose-p:leading-relaxed
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-cyan-400 prose-code:bg-cyan-500/10 prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-sm
              prose-pre:bg-card/50 prose-pre:border prose-pre:border-border/50 prose-pre:rounded
              prose-ul:list-disc prose-ul:pl-4
              prose-ol:list-decimal prose-ol:pl-4
              prose-li:text-foreground/90 prose-li:font-mono
              prose-blockquote:border-l-cyan-500 prose-blockquote:text-foreground/80
              prose-img:rounded-lg prose-img:border prose-img:border-border/50 prose-img:my-4
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="max-w-full h-auto rounded-lg border border-cyan-500/30 my-4 shadow-lg"
                      loading="lazy"
                      alt={props.alt || 'Issue image'}
                    />
                  ),
                  // Style tables nicely
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table {...props} className="min-w-full border border-border rounded-lg" />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th {...props} className="border border-border bg-cyan-500/10 px-3 py-2 text-left font-mono text-sm" />
                  ),
                  td: ({ node, ...props }) => (
                    <td {...props} className="border border-border px-3 py-2 font-mono text-sm" />
                  ),
                }}
              >
                {issue.body || '*No description provided*'}
              </ReactMarkdown>
            </div>
          </div>

          {/* Fork Notice */}
          {repo && !repo.can_push && !repo.is_fork && issue.state === 'open' && (
            <div className="border-t border-border bg-blue-500/5 p-4">
              <div className="flex items-start gap-2 text-xs font-mono">
                <Share2Icon className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-blue-300">
                  <p className="font-semibold mb-1">Fork will be created automatically</p>
                  <p className="text-blue-300/80">
                    You don't have write access to {repo.full_name}. We'll create a fork and submit a pull request from your fork when the issue is resolved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border bg-card/50 p-4 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => window.open(issue.html_url, '_blank')}
              className="font-mono hover:text-cyan-500 hover:border-cyan-500"
            >
              <GitHubLogoIcon className="mr-2 h-4 w-4" />
              View on GitHub
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="font-mono"
              >
                Close
              </Button>
              {issue.state === 'open' && (
                <Button
                  onClick={() => setShowSolveConfirmation(true)}
                  disabled={solving}
                  className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono"
                >
                  <RocketIcon className="mr-2 h-4 w-4" />
                  Solve This Issue
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

      {/* Solve Confirmation Modal */}
      <ConfirmationModal
        isOpen={showSolveConfirmation}
        onClose={() => setShowSolveConfirmation(false)}
        onConfirm={async () => {
          setShowSolveConfirmation(false)
          onSolve(issue.number)
        }}
        title="Start Issue Resolution"
        description={`Ready to solve issue #${issue.number}?`}
        confirmText="Start Solving"
        cancelText="Cancel"
        variant="info"
        icon={<RocketIcon className="h-6 w-6 text-cyan-500" />}
        loading={solving}
      >
        <div className="space-y-3">
          {/* Issue Summary */}
          <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div className="text-xs font-mono text-cyan-300">
              <div className="font-semibold mb-1">📋 Issue Details:</div>
              <div className="space-y-1 text-cyan-300/80">
                <div>
                  <span className="text-cyan-400">Title:</span> {issue.title}
                </div>
                <div>
                  <span className="text-cyan-400">Repository:</span> {repo.full_name}
                </div>
                {issue.labels && issue.labels.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400">Labels:</span>
                    <div className="flex gap-1 flex-wrap">
                      {issue.labels.map((label, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fork Notice */}
          {repo && !repo.can_push && !repo.is_fork && (
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <div className="text-xs font-mono text-blue-300">
                <div className="font-semibold mb-1">🔀 Fork Required:</div>
                <p className="text-blue-300/80">
                  A fork will be created automatically since you don't have write access to this repository.
                </p>
              </div>
            </div>
          )}

          {/* What will happen */}
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <div className="text-xs font-mono text-green-300">
              <div className="font-semibold mb-1">🚀 Next Steps:</div>
              <ol className="list-decimal list-inside space-y-1 text-green-300/80">
                <li>Create a dedicated task for this issue</li>
                <li>Initialize development environment</li>
                <li>Start automated resolution process</li>
                <li>You'll be redirected to the task page</li>
              </ol>
            </div>
          </div>
        </div>
      </ConfirmationModal>
    </>
  )
}

export function GitHubIssuesExplorer() {
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null)
  const [user, setUser] = useState<any>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const storedUser = localStorage.getItem('github_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error('Failed to parse stored user:', e)
      }
    }
  }, [])

  // Fetch repositories
  const { data: reposData, isLoading: loadingRepos, refetch: refetchRepos } = useQuery({
    queryKey: ['github-repositories'],
    queryFn: () => fetchGitHubRepositories({ per_page: 100 }),
    enabled: !!user,
  })

  // Fetch issues for selected repo - creates project if needed
  const fetchIssues = async (repo: GitHubRepository) => {
    setLoadingIssues(true)
    setSelectedRepo(repo)
    try {
      // Step 1: Check if project already exists for this repo
      const projects = await api.getProjects()
      let project = projects.find(p =>
        p.repo_url.includes(`${repo.owner}/${repo.name}`) ||
        (p.name === repo.name && p.repo_url.includes(repo.owner))
      )

      // Step 2: Create project if it doesn't exist
      if (!project) {
        project = await api.createProject({
          name: repo.name,
          repo_url: repo.clone_url || `https://github.com/${repo.owner}/${repo.name}.git`
        })
      }

      setCurrentProject(project)

      // Step 3: Fetch issues from backend API using project ID
      const issuesResponse = await fetchProjectIssues(project.id, {
        state: 'open',
        per_page: 30
      })

      setIssues(issuesResponse.issues)
    } catch (error) {
      console.error('Failed to fetch issues:', error)
      setIssues([])
    } finally {
      setLoadingIssues(false)
    }
  }

  // Solve issue mutation
  const solveMutation = useMutation({
    mutationFn: async ({ projectId, issueNumber }: {
      projectId: string;
      issueNumber: number;
    }) => {
      // Use the current project ID that was created when repo was clicked
      return solveGitHubIssue(projectId, issueNumber, {})
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setSelectedIssue(null)
      router.push(`/p/${data.project_id}/t/${data.task_id}`)
    },
  })

  const handleSolveIssue = (issueNumber: number) => {
    if (!currentProject) {
      console.error('No project selected')
      return
    }
    solveMutation.mutate({
      projectId: currentProject.id,
      issueNumber
    })
  }

  if (!user) {
    return null
  }

  return (
    <>
      <section className="container mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold font-mono mb-2">
                <span className="text-muted-foreground">{'<'}</span>
                <span className="text-cyan-500">Solve</span>
                <span className="text-purple-400">Issues</span>
                <span className="text-muted-foreground">{' />'}</span>
              </h2>
              <p className="text-muted-foreground font-mono text-sm">
                // Browse your repositories and solve issues instantly
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRepos()}
              disabled={loadingRepos}
              className="font-mono hover:text-cyan-500"
            >
              <ReloadIcon className={`h-4 w-4 mr-2 ${loadingRepos ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>

          {selectedRepo ? (
            /* Issues View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRepo(null)
                      setCurrentProject(null)
                      setIssues([])
                    }}
                    className="font-mono"
                  >
                    ← Back to Repos
                  </Button>
                  <div>
                    <h3 className="text-xl font-mono font-semibold text-cyan-400">
                      {selectedRepo.full_name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {issues.length} open {issues.length === 1 ? 'issue' : 'issues'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {loadingIssues ? (
                  <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card/50">
                    <div className="text-center space-y-4">
                      <ReloadIcon className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
                      <p className="text-sm font-mono text-muted-foreground">Loading issues...</p>
                    </div>
                  </div>
                ) : issues.length === 0 ? (
                  <div className="py-12 text-center rounded-lg border border-border bg-card/50">
                    <CheckCircledIcon className="h-12 w-12 text-green-400 mx-auto opacity-50 mb-4" />
                    <p className="text-muted-foreground font-mono text-sm">
                      No open issues - repository is clean! 🎉
                    </p>
                  </div>
                ) : (
                  issues.map((issue) => (
                    <motion.div
                      key={issue.number}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedIssue(issue)}
                      className="p-4 rounded-lg border border-border bg-card/50 hover:border-cyan-500/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-muted-foreground">#{issue.number}</span>
                            <h4 className="font-mono font-semibold text-foreground group-hover:text-cyan-400 transition-colors line-clamp-1">
                              {issue.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
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
                              <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/50">
                                Has Task
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedIssue(issue)
                          }}
                          className="bg-cyan-500/10 hover:bg-cyan-500 hover:text-black text-cyan-400 font-mono text-xs border border-cyan-500/50"
                        >
                          View
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Repositories Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingRepos ? (
                <div className="col-span-full flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <ReloadIcon className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
                    <p className="text-sm font-mono text-muted-foreground">Loading repositories...</p>
                  </div>
                </div>
              ) : reposData && reposData.repositories.length === 0 ? (
                <div className="col-span-full py-12 text-center">
                  <GitHubLogoIcon className="h-12 w-12 text-muted-foreground mx-auto opacity-50 mb-4" />
                  <p className="text-muted-foreground font-mono text-sm">
                    No repositories found
                  </p>
                </div>
              ) : (
                reposData?.repositories.map((repo) => (
                  <motion.button
                    key={repo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => fetchIssues(repo)}
                    className="p-4 rounded-lg border border-border bg-card/50 hover:border-cyan-500/50 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GitHubLogoIcon className="h-5 w-5 text-cyan-500 group-hover:text-cyan-400" />
                        {repo.is_fork && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/50">
                            <Share2Icon className="h-3 w-3 mr-1" />
                            Fork
                          </Badge>
                        )}
                        {!repo.can_push && !repo.is_fork && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/50" title="Read-only access">
                            <LockClosedIcon className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                      {repo.open_issues_count > 0 && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/50">
                          {repo.open_issues_count} issues
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-mono font-semibold text-foreground group-hover:text-cyan-400 transition-colors mb-1 truncate">
                      {repo.name}
                    </h3>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground font-mono line-clamp-2 mb-3">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <CodeIcon className="h-3 w-3" />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <StarIcon className="h-3 w-3" />
                        {repo.stars_count}
                      </span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          repo={selectedRepo}
          onClose={() => setSelectedIssue(null)}
          onSolve={handleSolveIssue}
          solving={solveMutation.isPending}
        />
      )}
    </>
  )
}
