'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ReloadIcon, CheckCircledIcon,
  CrossCircledIcon, UpdateIcon, GlobeIcon,
  LockClosedIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon
} from '@radix-ui/react-icons'
import { api, Task } from '@/lib/api'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { CreditCost } from './ui/credit-cost'

interface CustomDomainSectionProps {
  taskId: string
  task: Task
}

export function CustomDomainSection({ taskId, task }: CustomDomainSectionProps) {
  const queryClient = useQueryClient()
  const [isExpanded, setIsExpanded] = useState(false)
  const [hostingStatus, setHostingStatus] = useState<'idle' | 'provisioning' | 'success' | 'error'>('idle')
  const [hostingMessage, setHostingMessage] = useState<string>('')
  const [hostingDetails, setHostingDetails] = useState<{
    subdomain?: string
    fqdn?: string
    steps?: { dns?: { status: string; error?: string }; nginx?: { status: string; error?: string }; ssl?: { status: string; error?: string } }
  } | null>(null)
  const [retryingStep, setRetryingStep] = useState<string | null>(null)

  // Initialize hostingDetails from task data on load/refresh
  useEffect(() => {
    if (task.hosting_fqdn || task.hosting_subdomain) {
      const getStepStatuses = () => {
        switch (task.hosting_status) {
          case 'active':
            return { dns: { status: 'success' }, nginx: { status: 'success' }, ssl: { status: 'success' } }
          case 'active_no_ssl':
            return { dns: { status: 'success' }, nginx: { status: 'success' }, ssl: { status: 'failed' } }
          case 'dns_only':
            return { dns: { status: 'success' }, nginx: { status: 'failed' }, ssl: { status: 'failed' } }
          case 'failed':
            return { dns: { status: 'failed' }, nginx: { status: 'failed' }, ssl: { status: 'failed' } }
          default:
            return undefined
        }
      }

      setHostingDetails({
        subdomain: task.hosting_subdomain || undefined,
        fqdn: task.hosting_fqdn || undefined,
        steps: getStepStatuses()
      })
    }
  }, [task.hosting_fqdn, task.hosting_subdomain, task.hosting_status])

  // Provision hosting mutation
  const provisionHostingMutation = useMutation({
    mutationFn: () => {
      if (!task.deployment_port) {
        throw new Error('Deployment port is required')
      }
      return api.provisionHostingForTask(taskId, undefined, task.deployment_port)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setHostingStatus('success')
      setHostingDetails({ subdomain: data.subdomain, fqdn: data.fqdn, steps: data.steps })

      if (data.status === 'success') {
        setHostingMessage(`Domain ${data.fqdn} configured with SSL!`)
      } else if (data.status === 'partial') {
        setHostingMessage(data.warning || `Domain ${data.fqdn} configured (some steps need attention)`)
      }
    },
    onError: (error: Error) => {
      setHostingStatus('error')
      setHostingMessage(error.message || 'Failed to provision hosting')
      setHostingDetails(null)
    },
  })

  const handleProvisionHosting = () => {
    setHostingStatus('provisioning')
    setHostingMessage('Setting up DNS, Nginx & SSL...')
    setIsExpanded(true)
    provisionHostingMutation.mutate()
  }

  // Retry step mutation
  const retryStepMutation = useMutation({
    mutationFn: (step: 'dns' | 'nginx' | 'ssl') => api.retryHostingStep(taskId, step),
    onSuccess: (data, step) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      if (data.status === 'success') {
        setHostingDetails(prev => ({
          ...prev,
          steps: {
            ...prev?.steps,
            [step]: { status: 'success', message: data.message }
          }
        }))
        setHostingMessage(`${step.toUpperCase()} completed!`)
      } else {
        setHostingMessage(`${step} failed: ${data.error}`)
      }
      setRetryingStep(null)
    },
    onError: (error: Error, step) => {
      setHostingMessage(`${step} failed: ${error.message}`)
      setRetryingStep(null)
    },
  })

  // Retry all steps mutation
  const retryAllMutation = useMutation({
    mutationFn: () => api.retryAllHostingSteps(taskId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setHostingDetails({ subdomain: data.subdomain, fqdn: data.fqdn, steps: data.steps })
      if (data.status === 'success') {
        setHostingStatus('success')
        setHostingMessage(`All steps completed for ${data.fqdn}!`)
      } else if (data.status === 'partial') {
        setHostingStatus('success')
        setHostingMessage(data.warning || `Partially configured`)
      } else {
        setHostingStatus('error')
        setHostingMessage('Some steps failed')
      }
      setRetryingStep(null)
    },
    onError: (error: Error) => {
      setHostingStatus('error')
      setHostingMessage(error.message || 'Retry failed')
      setRetryingStep(null)
    },
  })

  const handleRetryStep = (step: 'dns' | 'nginx' | 'ssl') => {
    setRetryingStep(step)
    retryStepMutation.mutate(step)
  }

  const handleRetryAll = () => {
    setRetryingStep('all')
    setHostingStatus('provisioning')
    setHostingMessage('Retrying all steps...')
    retryAllMutation.mutate()
  }

  // Status checks
  const isHostingProvisioned = task.hosting_status === 'active' || task.hosting_status === 'active_no_ssl'
  const isHostingPartiallyProvisioned = task.hosting_status === 'dns_only' || task.hosting_status === 'failed'
  const hasHostingAttempted = isHostingProvisioned || isHostingPartiallyProvisioned || !!task.hosting_fqdn
  const hostingFqdn = task.hosting_fqdn || hostingDetails?.fqdn
  const hasFailedSteps = hostingDetails?.steps && (
    hostingDetails.steps.dns?.status !== 'success' ||
    hostingDetails.steps.nginx?.status !== 'success' ||
    hostingDetails.steps.ssl?.status !== 'success'
  )

  // Auto-expand if there are issues
  useEffect(() => {
    if (hasFailedSteps || isHostingPartiallyProvisioned) {
      setIsExpanded(true)
    }
  }, [hasFailedSteps, isHostingPartiallyProvisioned])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div className={cn(
        "bg-card/60 backdrop-blur-sm rounded-lg border transition-all duration-300",
        isHostingProvisioned
          ? "border-green-500/20"
          : hasFailedSteps
            ? "border-amber-500/20"
            : "border-border/50"
      )}>
        {/* Main Content - Compact */}
        <div className="px-4 py-3">
          {/* Single Row Layout */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Icon + Info */}
            <div className="flex items-center gap-3 min-w-0">
              <GlobeIcon className={cn(
                "h-4 w-4 shrink-0",
                isHostingProvisioned ? "text-green-400" : hasFailedSteps ? "text-amber-400" : "text-muted-foreground"
              )} />

              <div className="flex items-center gap-2 min-w-0">
                {hostingFqdn ? (
                  <>
                    <a
                      href={`https://${hostingFqdn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-cyan-400 hover:text-cyan-300 transition-colors truncate"
                    >
                      {hostingFqdn}
                    </a>
                    {isHostingProvisioned && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-400 shrink-0">
                        <LockClosedIcon className="h-2.5 w-2.5" />
                        SSL
                      </span>
                    )}
                    {isHostingPartiallyProvisioned && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 shrink-0">
                        Partial
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Custom subdomain with SSL
                  </span>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {!hasHostingAttempted && !hostingDetails?.subdomain ? (
                <Button
                  onClick={handleProvisionHosting}
                  disabled={provisionHostingMutation.isPending || !task.deployment_port}
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 px-3 text-xs font-medium",
                    "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                  )}
                >
                  {provisionHostingMutation.isPending ? (
                    <>
                      <UpdateIcon className="h-3 w-3 mr-1.5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Get Domain
                      <CreditCost cost={1} variant="badge-subtle" className="ml-1.5" />
                    </>
                  )}
                </Button>
              ) : hostingFqdn && (
                <a
                  href={`https://${hostingFqdn}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                  Visit
                </a>
              )}

              {/* Expand/Collapse for details */}
              {(hostingDetails?.steps || hasFailedSteps || hostingStatus !== 'idle') && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Deployment port warning - Inline */}
          {!task.deployment_port && !hasHostingAttempted && (
            <p className="text-[10px] text-amber-400/80 mt-2 flex items-center gap-1">
              <CrossCircledIcon className="h-3 w-3" />
              Deploy the task first to enable custom domain
            </p>
          )}

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                  {/* Status Message */}
                  {hostingStatus !== 'idle' && hostingMessage && (
                    <div className={cn(
                      "flex items-center gap-2 text-xs",
                      hostingStatus === 'success' && "text-green-400",
                      hostingStatus === 'error' && "text-red-400",
                      hostingStatus === 'provisioning' && "text-cyan-400"
                    )}>
                      {hostingStatus === 'provisioning' && <UpdateIcon className="h-3 w-3 animate-spin" />}
                      {hostingStatus === 'success' && <CheckCircledIcon className="h-3 w-3" />}
                      {hostingStatus === 'error' && <CrossCircledIcon className="h-3 w-3" />}
                      <span>{hostingMessage}</span>
                    </div>
                  )}

                  {/* Provisioning Steps - Inline */}
                  {hostingDetails?.steps && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {/* DNS */}
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-xs",
                          hostingDetails.steps.dns?.status === 'success'
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        )}>
                          {hostingDetails.steps.dns?.status === 'success'
                            ? <CheckCircledIcon className="h-3 w-3" />
                            : <CrossCircledIcon className="h-3 w-3" />
                          }
                          <span className="font-mono">DNS</span>
                          {hostingDetails.steps.dns?.status !== 'success' && (
                            <button
                              type="button"
                              onClick={() => handleRetryStep('dns')}
                              disabled={retryingStep !== null}
                              className="ml-1 hover:text-cyan-400"
                            >
                              {retryingStep === 'dns' ? <UpdateIcon className="h-3 w-3 animate-spin" /> : <ReloadIcon className="h-3 w-3" />}
                            </button>
                          )}
                        </div>

                        {/* Nginx */}
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-xs",
                          hostingDetails.steps.nginx?.status === 'success'
                            ? "bg-green-500/10 text-green-400"
                            : "bg-amber-500/10 text-amber-400"
                        )}>
                          {hostingDetails.steps.nginx?.status === 'success'
                            ? <CheckCircledIcon className="h-3 w-3" />
                            : <CrossCircledIcon className="h-3 w-3" />
                          }
                          <span className="font-mono">Nginx</span>
                          {hostingDetails.steps.nginx?.status !== 'success' && (
                            <button
                              type="button"
                              onClick={() => handleRetryStep('nginx')}
                              disabled={retryingStep !== null}
                              className="ml-1 hover:text-cyan-400"
                            >
                              {retryingStep === 'nginx' ? <UpdateIcon className="h-3 w-3 animate-spin" /> : <ReloadIcon className="h-3 w-3" />}
                            </button>
                          )}
                        </div>

                        {/* SSL */}
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-xs",
                          hostingDetails.steps.ssl?.status === 'success'
                            ? "bg-green-500/10 text-green-400"
                            : "bg-amber-500/10 text-amber-400"
                        )}>
                          {hostingDetails.steps.ssl?.status === 'success'
                            ? <CheckCircledIcon className="h-3 w-3" />
                            : <CrossCircledIcon className="h-3 w-3" />
                          }
                          <span className="font-mono">SSL</span>
                          {hostingDetails.steps.ssl?.status !== 'success' && (
                            <button
                              type="button"
                              onClick={() => handleRetryStep('ssl')}
                              disabled={retryingStep !== null}
                              className="ml-1 hover:text-cyan-400"
                            >
                              {retryingStep === 'ssl' ? <UpdateIcon className="h-3 w-3 animate-spin" /> : <ReloadIcon className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Retry All */}
                      {hasFailedSteps && (
                        <button
                          type="button"
                          onClick={handleRetryAll}
                          disabled={retryingStep !== null}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          {retryingStep === 'all' ? (
                            <UpdateIcon className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <ReloadIcon className="h-3 w-3" />
                              Retry all
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
