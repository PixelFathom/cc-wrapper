'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  RocketIcon, ReloadIcon, CheckCircledIcon,
  CrossCircledIcon, UpdateIcon, ClockIcon, FileIcon,
  CubeIcon, LockClosedIcon, PlusIcon, TrashIcon, ExternalLinkIcon
} from '@radix-ui/react-icons'
import { api, Task } from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { DeploymentLogs } from './deployment-logs'
import { cn } from '@/lib/utils'

interface DeploymentTaskTabProps {
  taskId: string
  task: Task
}

interface EnvVariable {
  key: string
  value: string
}

export function DeploymentTaskTab({ taskId, task }: DeploymentTaskTabProps) {
  const queryClient = useQueryClient()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [envVars, setEnvVars] = useState<EnvVariable[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [deploymentHost, setDeploymentHost] = useState<string>(task.deployment_host || '')
  const [hostSaveStatus, setHostSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [hostSaveMessage, setHostSaveMessage] = useState<string>('')
  const [sslStatus, setSslStatus] = useState<'idle' | 'setting_up' | 'success' | 'error'>('idle')
  const [sslMessage, setSslMessage] = useState<string>('')

  // Fetch environment variables
  const { data: envData, refetch: refetchEnv } = useQuery({
    queryKey: ['deployment-env', taskId],
    queryFn: () => api.getDeploymentEnv(taskId),
    enabled: !!taskId,
  })

  // Update local state when envData changes
  useEffect(() => {
    if (envData?.env_variables) {
      const vars = Object.entries(envData.env_variables).map(([key, value]) => ({
        key,
        value: String(value)
      }))
      setEnvVars(vars)
      setHasUnsavedChanges(false)
    } else {
      setEnvVars([])
      setHasUnsavedChanges(false)
    }
  }, [envData])

  // Update deploymentHost when task changes
  useEffect(() => {
    setDeploymentHost(task.deployment_host || '')
  }, [task.deployment_host])

  // Fetch deployment hooks (only deployment phase for this tab)
  // Poll more aggressively during active deployment, but keep polling even when completed
  // to catch new deployments without needing to refresh
  const isActiveDeployment = task && task.deployment_status === 'deploying'
  const hasDeploymentStarted = task && task.deployment_status !== 'pending'

  const { data: deploymentData, refetch: refetchHooks } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getTaskDeploymentHooks(taskId, 100),
    enabled: !!task, // Always fetch if task exists
    // Poll every 2 seconds during active deployment, every 5 seconds otherwise
    // This ensures new deployment actions appear automatically
    refetchInterval: isActiveDeployment ? 2000 : (hasDeploymentStarted ? 5000 : false),
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  })

  // Filter to only show deployment phase hooks (exclude initialization)
  const deploymentPhaseHooks = useMemo(() => {
    if (!deploymentData?.hooks) return []
    return deploymentData.hooks.filter(hook => hook.phase === 'deployment')
  }, [deploymentData?.hooks])

  // Update env variables mutation
  const updateEnvMutation = useMutation({
    mutationFn: (variables: Record<string, string>) => api.updateDeploymentEnv(taskId, variables),
    onSuccess: () => {
      setHasUnsavedChanges(false)
      queryClient.invalidateQueries({ queryKey: ['deployment-env', taskId] })
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setSaveStatus('success')
      setSaveMessage('Environment variables saved successfully')
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
    },
    onError: (error: Error) => {
      setSaveStatus('error')
      setSaveMessage(error.message || 'Failed to save environment variables')
    },
  })

  // Update deployment host mutation
  const updateHostMutation = useMutation({
    mutationFn: (host: string) => api.updateDeploymentHost(taskId, host),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setHostSaveStatus('success')
      setHostSaveMessage('Deployment host saved successfully')
      setTimeout(() => {
        setHostSaveStatus('idle')
        setHostSaveMessage('')
      }, 3000)
    },
    onError: (error: Error) => {
      setHostSaveStatus('error')
      setHostSaveMessage(error.message || 'Failed to save deployment host')
    },
  })

  const handleSaveHost = () => {
    updateHostMutation.mutate(deploymentHost)
  }

  // Setup SSL mutation
  const setupSslMutation = useMutation({
    mutationFn: () => api.setupSSLCertificate(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setSslStatus('success')
      setSslMessage('SSL certificate configured successfully')
      setTimeout(() => {
        setSslStatus('idle')
        setSslMessage('')
      }, 5000)
    },
    onError: (error: Error) => {
      setSslStatus('error')
      setSslMessage(error.message || 'Failed to setup SSL certificate')
      setTimeout(() => {
        setSslStatus('idle')
        setSslMessage('')
      }, 5000)
    },
  })

  const handleSetupSsl = () => {
    setupSslMutation.mutate()
  }

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: () => api.deployTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['deployment-hooks', taskId] })
      refetchHooks()
    },
  })

  const handleAddVariable = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
    setHasUnsavedChanges(true)
  }

  const handleRemoveVariable = (index: number) => {
    const newVars = envVars.filter((_, i) => i !== index)
    setEnvVars(newVars)
    setHasUnsavedChanges(true)
  }

  const handleUpdateVariable = (index: number, field: 'key' | 'value', newValue: string) => {
    const newVars = [...envVars]
    newVars[index] = { ...newVars[index], [field]: newValue }
    setEnvVars(newVars)
    setHasUnsavedChanges(true)
  }

  const handleSaveVariables = () => {
    // Filter out empty keys and convert to object
    const variables: Record<string, string> = {}
    envVars.forEach(({ key, value }) => {
      if (key.trim()) {
        variables[key.trim()] = value
      }
    })
    updateEnvMutation.mutate(variables)
  }

  const envVariables = envData?.env_variables || {}
  const hasEnvFile = envData?.has_env_file || false
  const hasVariables = envVars.length > 0 || Object.keys(envVariables).length > 0
  const canDeploy = task.deployment_port
  const hasDeployed = task.deployment_status !== 'pending' && task.deployment_status !== null
  const hasDeploymentError = useMemo(() =>
    deploymentPhaseHooks.some(hook => {
      const status = hook.status?.toLowerCase()
      return (
        hook.hook_type === 'error' ||
        status === 'error' ||
        hook.data?.error
      )
    }),
    [deploymentPhaseHooks]
  )
  const isDeployingWithoutError = task.deployment_status === 'deploying' && !hasDeploymentError
  const disableDeployButton = !canDeploy || deployMutation.isPending || hasUnsavedChanges || isDeployingWithoutError
  return (
    <div className="space-y-6">
      {/* Port Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CubeIcon className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Deployment Port</h3>
              <p className="text-xs text-muted-foreground">Port assigned to this task</p>
            </div>
          </div>
          {task.deployment_port ? (
            <div className="px-4 py-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
              <span className="font-mono text-lg text-cyan-400">{task.deployment_port}</span>
            </div>
          ) : (
            <div className="px-4 py-2 bg-gray-500/20 rounded-lg border border-gray-500/30">
              <span className="font-mono text-sm text-muted-foreground">Not assigned</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Deployment Host Section */}
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
              <h3 className="text-sm font-semibold text-foreground">Deployment Host</h3>
              <p className="text-xs text-muted-foreground">Host URL for nginx configuration</p>
            </div>
          </div>
        </div>

        {/* Save Status */}
        {hostSaveStatus !== 'idle' && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm font-mono mb-4",
            hostSaveStatus === 'success' && "bg-green-500/10 text-green-400",
            hostSaveStatus === 'error' && "bg-red-500/10 text-red-400",
            hostSaveStatus === 'saving' && "bg-cyan-500/10 text-cyan-400"
          )}>
            {hostSaveStatus === 'saving' && <UpdateIcon className="h-4 w-4 animate-spin" />}
            {hostSaveStatus === 'success' && <CheckCircledIcon className="h-4 w-4" />}
            {hostSaveStatus === 'error' && <CrossCircledIcon className="h-4 w-4" />}
            <span>{hostSaveMessage}</span>
          </div>
        )}

        <div className="flex gap-3">
          <Input
            value={deploymentHost}
            onChange={(e) => setDeploymentHost(e.target.value)}
            placeholder="example.com or subdomain.example.com"
            className="font-mono text-sm flex-1 bg-black/20 border-border"
          />
          <Button
            onClick={handleSaveHost}
            disabled={updateHostMutation.isPending || deploymentHost === (task.deployment_host || '')}
            className="font-mono"
          >
            {updateHostMutation.isPending ? (
              <>
                <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircledIcon className="h-4 w-4 mr-2" />
                Save Host
              </>
            )}
          </Button>
        </div>
        {task.deployment_host && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Current host: <span className="text-foreground">{task.deployment_host}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          The host will be used to create nginx configuration via API during deployment.
        </p>

        {/* SSL Certificate Setup */}
        {task.deployment_host && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LockClosedIcon className="h-4 w-4 text-green-400" />
                <h4 className="text-sm font-semibold text-foreground">SSL Certificate</h4>
              </div>
            </div>

            {/* SSL Status */}
            {sslStatus !== 'idle' && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm font-mono mb-3",
                sslStatus === 'success' && "bg-green-500/10 text-green-400",
                sslStatus === 'error' && "bg-red-500/10 text-red-400",
                sslStatus === 'setting_up' && "bg-cyan-500/10 text-cyan-400"
              )}>
                {sslStatus === 'setting_up' && <UpdateIcon className="h-4 w-4 animate-spin" />}
                {sslStatus === 'success' && <CheckCircledIcon className="h-4 w-4" />}
                {sslStatus === 'error' && <CrossCircledIcon className="h-4 w-4" />}
                <span>{sslMessage}</span>
              </div>
            )}

            <Button
              onClick={handleSetupSsl}
              disabled={setupSslMutation.isPending || !task.deployment_host}
              variant="outline"
              className="font-mono w-full"
            >
              {setupSslMutation.isPending ? (
                <>
                  <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                  Setting up SSL...
                </>
              ) : (
                <>
                  <LockClosedIcon className="h-4 w-4 mr-2" />
                  Setup SSL Certificate
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Configures Let's Encrypt SSL certificate for HTTPS access.
            </p>
          </div>
        )}
      </motion.div>

      {/* Visit Deployed Site - Show only when deployment_host is set */}
      {task.deployment_host && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.075 }}
          className="relative group"
        >
          {/* Glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-300" />

          <a
            href={`https://${task.deployment_host}`}
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
                      {task.deployment_host}
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

      {/* Environment Variables Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <LockClosedIcon className="h-5 w-5 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground">Environment Variables</h3>
          </div>
          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-400 font-mono">Unsaved changes</span>
          )}
        </div>

        {/* Save Status */}
        {saveStatus !== 'idle' && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm font-mono mb-4",
            saveStatus === 'success' && "bg-green-500/10 text-green-400",
            saveStatus === 'error' && "bg-red-500/10 text-red-400",
            saveStatus === 'saving' && "bg-cyan-500/10 text-cyan-400"
          )}>
            {saveStatus === 'saving' && <UpdateIcon className="h-4 w-4 animate-spin" />}
            {saveStatus === 'success' && <CheckCircledIcon className="h-4 w-4" />}
            {saveStatus === 'error' && <CrossCircledIcon className="h-4 w-4" />}
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Manual Entry Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground font-mono">Key-Value Pairs</h4>
            <div className="flex gap-2">
              <Button
                onClick={handleAddVariable}
                variant="outline"
                size="sm"
                className="font-mono text-xs"
              >
                <PlusIcon className="h-3 w-3 mr-1" />
                Add Variable
              </Button>
              {hasUnsavedChanges && (
                <Button
                  onClick={handleSaveVariables}
                  size="sm"
                  className="font-mono text-xs"
                  disabled={updateEnvMutation.isPending}
                >
                  {updateEnvMutation.isPending ? (
                    <>
                      <UpdateIcon className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircledIcon className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Environment Variables Table */}
          {envVars.length > 0 ? (
            <div className="terminal-bg rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground font-mono w-1/3">Key</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground font-mono">Value</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground font-mono w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {envVars.map((envVar, index) => (
                      <tr key={index} className="hover:bg-black/10 transition-colors">
                        <td className="px-4 py-2">
                          <Input
                            value={envVar.key}
                            onChange={(e) => handleUpdateVariable(index, 'key', e.target.value)}
                            placeholder="KEY"
                            className="font-mono text-sm h-8 bg-black/20 border-border"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={envVar.value}
                            onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                            placeholder="value"
                            className="font-mono text-sm h-8 bg-black/20 border-border"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            onClick={() => handleRemoveVariable(index)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="terminal-bg rounded-lg border border-border p-8 text-center">
              <LockClosedIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground font-mono">
                No environment variables. Add variables manually.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Deployment Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 mb-4">
          <RocketIcon className="h-5 w-5 text-yellow-400" />
          <h3 className="text-sm font-semibold text-foreground">Deployment Actions</h3>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => deployMutation.mutate()}
            disabled={disableDeployButton}
            className="font-mono"
          >
            {deployMutation.isPending ? (
              <>
                <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <RocketIcon className="h-4 w-4 mr-2" />
                Deploy
              </>
            )}
          </Button>

        </div>

        {hasUnsavedChanges && (
          <p className="text-xs text-yellow-400 mt-3 font-mono">
            Please save your changes before deploying.
          </p>
        )}

        {/* Deployment Status */}
        {task.deployment_status && task.deployment_status !== 'pending' && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">Status:</span>
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium font-mono",
              task.deployment_status === 'completed' && 'bg-green-500/20 text-green-400',
              task.deployment_status === 'failed' && 'bg-red-500/20 text-red-400',
              task.deployment_status === 'deploying' && 'bg-yellow-500/20 text-yellow-400',
              'bg-gray-500/20 text-gray-400'
            )}>
              {task.deployment_status === 'completed' && <CheckCircledIcon className="h-3 w-3" />}
              {task.deployment_status === 'failed' && <CrossCircledIcon className="h-3 w-3" />}
              {task.deployment_status === 'deploying' && <UpdateIcon className="h-3 w-3 animate-spin" />}
              {task.deployment_status.charAt(0).toUpperCase() + task.deployment_status.slice(1)}
            </div>
          </div>
        )}
      </motion.div>

      {/* Deployment Hooks Display */}
      {hasDeployed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <FileIcon className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Deployment Logs</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time deployment activity and progress
              </p>
            </div>
          </div>
          {deploymentPhaseHooks.length > 0 ? (
            <DeploymentLogs
              hooks={deploymentPhaseHooks}
              isCompleted={task.deployment_completed}
              status={task.deployment_status}
              showPhaseFilter={false}
              splitStatusAndQueryHooks
            />
          ) : (
            <div className="bg-card rounded-lg border border-border/50 p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/30 mb-4">
                <ClockIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">No Deployment Logs</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Deployment logs will appear here once you click the Deploy button and the deployment process starts.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
