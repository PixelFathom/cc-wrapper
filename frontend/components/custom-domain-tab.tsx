'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ReloadIcon, CheckCircledIcon,
  CrossCircledIcon, UpdateIcon, CubeIcon,
  LockClosedIcon, ExternalLinkIcon
} from '@radix-ui/react-icons'
import { api, Task } from '@/lib/api'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { CreditCost } from './ui/credit-cost'

interface CustomDomainTabProps {
  taskId: string
  task: Task
}

export function CustomDomainTab({ taskId, task }: CustomDomainTabProps) {
  const queryClient = useQueryClient()
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
      // Determine step statuses based on hosting_status
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

  // Provision hosting mutation (DNS + Nginx + SSL in one call)
  // Backend auto-generates a unique subdomain
  const provisionHostingMutation = useMutation({
    mutationFn: () => {
      if (!task.deployment_port) {
        throw new Error('Deployment port is required')
      }
      // Don't pass subdomain - let backend generate a unique one
      return api.provisionHostingForTask(taskId, undefined, task.deployment_port)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setHostingStatus('success')
      setHostingDetails({ subdomain: data.subdomain, fqdn: data.fqdn, steps: data.steps })

      if (data.status === 'success') {
        setHostingMessage(`Custom domain ${data.fqdn} configured with SSL!`)
      } else if (data.status === 'partial') {
        setHostingMessage(data.warning || `Domain ${data.fqdn} configured (some steps may need attention)`)
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
    setHostingMessage('Generating subdomain and setting up DNS, Nginx, and SSL certificate...')
    provisionHostingMutation.mutate()
  }

  // Retry step mutation
  const retryStepMutation = useMutation({
    mutationFn: (step: 'dns' | 'nginx' | 'ssl') => api.retryHostingStep(taskId, step),
    onSuccess: (data, step) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      if (data.status === 'success') {
        // Update the local state with the successful step
        setHostingDetails(prev => ({
          ...prev,
          steps: {
            ...prev?.steps,
            [step]: { status: 'success', message: data.message }
          }
        }))
        setHostingMessage(`${step.toUpperCase()} step completed successfully!`)
      } else {
        setHostingMessage(`Failed to retry ${step}: ${data.error}`)
      }
      setRetryingStep(null)
    },
    onError: (error: Error, step) => {
      setHostingMessage(`Failed to retry ${step}: ${error.message}`)
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
        setHostingMessage(`All steps completed successfully for ${data.fqdn}!`)
      } else if (data.status === 'partial') {
        setHostingStatus('success')
        setHostingMessage(data.warning || `Domain ${data.fqdn} configured (some steps may need attention)`)
      } else {
        setHostingStatus('error')
        setHostingMessage('Some steps failed. Click retry on individual steps.')
      }
      setRetryingStep(null)
    },
    onError: (error: Error) => {
      setHostingStatus('error')
      setHostingMessage(error.message || 'Failed to retry hosting steps')
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
    setHostingMessage('Retrying all hosting steps...')
    retryAllMutation.mutate()
  }

  // Check if hosting is already provisioned (including partial states like dns_only)
  const isHostingProvisioned = task.hosting_status === 'active' || task.hosting_status === 'active_no_ssl'
  const isHostingPartiallyProvisioned = task.hosting_status === 'dns_only' || task.hosting_status === 'failed'
  const hasHostingAttempted = isHostingProvisioned || isHostingPartiallyProvisioned || !!task.hosting_fqdn
  const hostingFqdn = task.hosting_fqdn || (hostingDetails?.fqdn)

  return (
    <div className="space-y-6">
      {/* Custom Domain Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CubeIcon className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Custom Domain</h3>
              <p className="text-xs text-muted-foreground">Setup DNS, Nginx & SSL in one click</p>
            </div>
          </div>
          {isHostingProvisioned && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium font-mono bg-green-500/20 text-green-400">
              <CheckCircledIcon className="h-3 w-3" />
              Active
            </div>
          )}
          {isHostingPartiallyProvisioned && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium font-mono bg-yellow-500/20 text-yellow-400">
              <CrossCircledIcon className="h-3 w-3" />
              Partial
            </div>
          )}
        </div>

        {/* Status Message */}
        {hostingStatus !== 'idle' && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm font-mono mb-4",
            hostingStatus === 'success' && "bg-green-500/10 text-green-400",
            hostingStatus === 'error' && "bg-red-500/10 text-red-400",
            hostingStatus === 'provisioning' && "bg-cyan-500/10 text-cyan-400"
          )}>
            {hostingStatus === 'provisioning' && <UpdateIcon className="h-4 w-4 animate-spin" />}
            {hostingStatus === 'success' && <CheckCircledIcon className="h-4 w-4" />}
            {hostingStatus === 'error' && <CrossCircledIcon className="h-4 w-4" />}
            <span>{hostingMessage}</span>
          </div>
        )}

        {/* Provisioning Steps Progress */}
        {hostingDetails?.steps && (
          <div className="mb-4 p-3 bg-black/20 rounded-lg border border-border/50">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              {/* DNS Step */}
              <div className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1",
                  hostingDetails.steps.dns?.status === 'success' ? "text-green-400" : "text-red-400"
                )}>
                  {hostingDetails.steps.dns?.status === 'success' ? <CheckCircledIcon className="h-3 w-3" /> : <CrossCircledIcon className="h-3 w-3" />}
                  DNS
                </div>
                {hostingDetails.steps.dns?.status !== 'success' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                    onClick={() => handleRetryStep('dns')}
                    disabled={retryingStep !== null}
                  >
                    {retryingStep === 'dns' ? <UpdateIcon className="h-3 w-3 animate-spin" /> : <ReloadIcon className="h-3 w-3" />}
                  </Button>
                )}
              </div>

              {/* Nginx Step */}
              <div className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1",
                  hostingDetails.steps.nginx?.status === 'success' ? "text-green-400" : "text-yellow-400"
                )}>
                  {hostingDetails.steps.nginx?.status === 'success' ? <CheckCircledIcon className="h-3 w-3" /> : <CrossCircledIcon className="h-3 w-3" />}
                  Nginx
                </div>
                {hostingDetails.steps.nginx?.status !== 'success' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                    onClick={() => handleRetryStep('nginx')}
                    disabled={retryingStep !== null}
                  >
                    {retryingStep === 'nginx' ? <UpdateIcon className="h-3 w-3 animate-spin" /> : <ReloadIcon className="h-3 w-3" />}
                  </Button>
                )}
              </div>

              {/* SSL Step */}
              <div className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1",
                  hostingDetails.steps.ssl?.status === 'success' ? "text-green-400" : "text-yellow-400"
                )}>
                  {hostingDetails.steps.ssl?.status === 'success' ? <CheckCircledIcon className="h-3 w-3" /> : <CrossCircledIcon className="h-3 w-3" />}
                  SSL
                </div>
                {hostingDetails.steps.ssl?.status !== 'success' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                    onClick={() => handleRetryStep('ssl')}
                    disabled={retryingStep !== null}
                  >
                    {retryingStep === 'ssl' ? <UpdateIcon className="h-3 w-3 animate-spin" /> : <ReloadIcon className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Retry All Button - show if any step failed */}
            {(hostingDetails.steps.dns?.status !== 'success' ||
              hostingDetails.steps.nginx?.status !== 'success' ||
              hostingDetails.steps.ssl?.status !== 'success') && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-mono"
                  onClick={handleRetryAll}
                  disabled={retryingStep !== null}
                >
                  {retryingStep === 'all' ? (
                    <>
                      <UpdateIcon className="h-3 w-3 mr-1 animate-spin" />
                      Retrying all...
                    </>
                  ) : (
                    <>
                      <ReloadIcon className="h-3 w-3 mr-1" />
                      Retry All Failed Steps
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Generated Subdomain Display (after provisioning started) */}
        {hostingDetails?.subdomain && (
          <div className="mb-4 p-3 bg-black/20 rounded-lg border border-cyan-500/30">
            <p className="text-xs text-muted-foreground mb-1">Generated subdomain:</p>
            <p className="text-sm font-mono text-cyan-400">{hostingDetails.subdomain}.tediux.com</p>
          </div>
        )}

        {!hasHostingAttempted && !hostingDetails?.subdomain ? (
          <>
            <Button
              onClick={handleProvisionHosting}
              disabled={provisionHostingMutation.isPending || !task.deployment_port}
              className="font-mono w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {provisionHostingMutation.isPending ? (
                <>
                  <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                  Generating subdomain & setting up...
                </>
              ) : (
                <>
                  <LockClosedIcon className="h-4 w-4" />
                  Setup Custom Domain with SSL
                  <CreditCost cost={1} variant="badge-subtle" />
                </>
              )}
            </Button>

            {!task.deployment_port && (
              <p className="text-xs text-yellow-400 mt-2 font-mono">
                Deployment port required. Deploy the task first.
              </p>
            )}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Auto-generates a unique subdomain, creates DNS record, configures Nginx reverse proxy, and sets up SSL certificate.
              </p>
              <CreditCost cost={1} variant="context" />
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-black/20 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <LockClosedIcon className="h-4 w-4 text-green-400" />
                <span className="text-sm font-semibold text-foreground">Domain Active</span>
              </div>
              <p className="text-sm font-mono text-cyan-400">{hostingFqdn}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Your custom domain is configured with DNS, Nginx, and SSL certificate.
            </p>
          </div>
        )}
      </motion.div>

      {/* Visit Deployed Site - Show when hosting_fqdn or deployment_host is set */}
      {(hostingFqdn || task.deployment_host) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.075 }}
          className="relative group"
        >
          {/* Glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-300" />

          <a
            href={`https://${hostingFqdn || task.deployment_host}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block"
          >
            <div className="bg-gradient-to-br from-card to-card/90 rounded-xl border border-border/50 p-6 backdrop-blur-sm hover:border-cyan-500/50 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur-md opacity-50" />
                    <div className="relative bg-gradient-to-r from-cyan-500/20 to-blue-500/20 p-3 rounded-xl border border-cyan-500/30">
                      <ExternalLinkIcon className="h-6 w-6 text-cyan-400" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-cyan-400 transition-colors">
                      Visit Deployed Site
                    </h3>
                    <p className="text-sm font-mono text-cyan-400/90 group-hover:text-cyan-300 transition-colors">
                      {hostingFqdn || task.deployment_host}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">

                  <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 p-2.5 rounded-lg border border-cyan-500/30 group-hover:scale-110 transition-transform">
                    <ExternalLinkIcon className="h-5 w-5 text-cyan-400" />
                  </div>
                </div>
              </div>

              {/* Decorative bottom border */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        </motion.div>
      )}
    </div>
  )
}
