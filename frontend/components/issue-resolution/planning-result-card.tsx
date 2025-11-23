'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircledIcon, FileTextIcon, ReloadIcon } from '@radix-ui/react-icons'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface PlanningResultCardProps {
  planContent: string
  isApproved: boolean
  canApprove: boolean
  onApprove: (notes: string) => Promise<void>
  isLoading?: boolean
}

export function PlanningResultCard({
  planContent,
  isApproved,
  canApprove,
  onApprove,
  isLoading = false,
}: PlanningResultCardProps) {
  const [approvalNotes, setApprovalNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await onApprove(approvalNotes)
      setApprovalNotes('')
    } catch (error) {
      console.error('Failed to approve plan:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-8">
        <div className="flex items-center justify-center gap-3 text-violet-300">
          <ReloadIcon className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Generating comprehensive plan...</span>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border backdrop-blur-xl overflow-hidden',
        isApproved
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-violet-500/40 bg-violet-500/5'
      )}
    >
      {/* Header */}
      <div className={cn(
        'px-6 py-4 border-b flex items-center justify-between',
        isApproved
          ? 'border-green-500/30 bg-green-500/10'
          : 'border-violet-500/30 bg-violet-500/10'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center',
            isApproved
              ? 'bg-green-500/20 text-green-300'
              : 'bg-violet-500/20 text-violet-300'
          )}>
            {isApproved ? (
              <CheckCircledIcon className="h-5 w-5" />
            ) : (
              <FileTextIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className={cn(
              'text-lg font-semibold',
              isApproved ? 'text-green-200' : 'text-violet-200'
            )}>
              {isApproved ? 'Plan Approved' : 'Comprehensive Implementation Plan'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isApproved
                ? 'This plan has been approved and implementation has started'
                : 'Review the detailed analysis and solution approach below'}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-semibold',
            isApproved
              ? 'bg-green-500/20 text-green-200 border-green-500/40'
              : 'bg-violet-500/20 text-violet-200 border-violet-500/40'
          )}
        >
          {isApproved ? 'Approved' : 'Awaiting Review'}
        </Badge>
      </div>

      {/* Plan Content */}
      <div className="p-6">
        <div className="rounded-xl border border-border/50 bg-black/40 p-6 max-h-[600px] overflow-y-auto">
          <article className="prose prose-invert prose-violet max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-violet-200 mt-8 mb-4 pb-3 border-b border-violet-500/30 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-violet-300 mt-6 mb-3">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-violet-400 mt-4 mb-2">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold text-muted-foreground mt-3 mb-2">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-gray-300 leading-relaxed mb-3">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 mb-4 text-sm text-gray-300">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 mb-4 text-sm text-gray-300">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="ml-4 text-gray-300">
                    {children}
                  </li>
                ),
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg text-xs my-4"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-violet-500/20 text-violet-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  )
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-violet-500/50 pl-4 py-2 my-4 bg-violet-500/5 text-gray-300 italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border border-border/50 rounded-lg">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border/50 bg-violet-500/10 px-4 py-2 text-left text-sm font-semibold text-violet-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border/50 px-4 py-2 text-sm text-gray-300">
                    {children}
                  </td>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-violet-200">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-300">
                    {children}
                  </em>
                ),
                hr: () => (
                  <hr className="my-6 border-t border-violet-500/30" />
                ),
              }}
            >
              {planContent}
            </ReactMarkdown>
          </article>
        </div>

        {/* Approval Section - Only show if not approved and user can approve */}
        {!isApproved && canApprove && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 space-y-4"
          >
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircledIcon className="h-4 w-4 text-violet-300" />
                <h4 className="text-sm font-semibold text-violet-200">Ready to Approve?</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Once you approve this plan, the implementation phase will begin automatically.
                You can add optional notes or feedback for the implementation team below.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Approval Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="Add any additional context, concerns, or specific instructions for the implementation team..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={3}
                    className="bg-black/40 border-violet-500/30 focus:border-violet-500/50 text-sm resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 bg-violet-500 hover:bg-violet-600 text-white font-semibold shadow-lg shadow-violet-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                        Approving Plan...
                      </>
                    ) : (
                      <>
                        <CheckCircledIcon className="mr-2 h-4 w-4" />
                        Approve Plan & Start Implementation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Approved Status Message */}
        {isApproved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6"
          >
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
              <CheckCircledIcon className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-200">
                  Plan approved successfully
                </p>
                <p className="text-xs text-green-300/70 mt-1">
                  Implementation phase has been initiated based on this approved plan.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
