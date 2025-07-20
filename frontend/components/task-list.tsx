'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, CheckCircledIcon, CircleIcon, ArrowRightIcon, FileTextIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { motion } from 'framer-motion'
import { MCPServerSelector } from './mcp-server-selector'

interface TaskListProps {
  projectId: string
}

export function TaskList({ projectId }: TaskListProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.getTasks(projectId),
  })

  const createMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setIsCreating(false)
      setNewTaskName('')
      setMcpServers([])
      // Navigate to the task page to see deployment logs
      router.push(`/p/${projectId}/t/${newTask.id}`)
    },
  })

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({ 
      name: newTaskName, 
      project_id: projectId,
      mcp_servers: mcpServers.length > 0 ? mcpServers : undefined
    })
  }

  return (
    <div className="space-y-4">
      {/* Create Task Terminal */}
      {isCreating ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-border-neon rounded-lg overflow-hidden"
        >
          <form onSubmit={handleCreateTask} className="bg-card/50 p-6 space-y-6">
            <div className="font-mono">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-green-400">➜</span>
                <span className="text-cyan-500">task</span>
                <span className="text-muted-foreground">create</span>
              </div>
              <Input
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Enter task name..."
                className="bg-transparent border font-mono text-purple-400 placeholder:text-muted-foreground/50"
                autoFocus
                required
              />
            </div>
            
            <div className="border-t border-border pt-6">
              <MCPServerSelector
                value={mcpServers}
                onChange={setMcpServers}
              />
            </div>
            
            <div className="flex items-center justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCreating(false)
                  setNewTaskName('')
                  setMcpServers([])
                }}
                className="font-mono text-xs"
              >
                ^C Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono text-xs"
                size="sm"
              >
                <CheckCircledIcon className="mr-1 h-3 w-3" />
                Execute
              </Button>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="flex items-center justify-end">
          <Button 
            onClick={() => setIsCreating(true)} 
            className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono hover:glow-cyan transition-all"
            size="sm"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            task --new
          </Button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="terminal-bg rounded-lg border border-border p-6 text-center">
            <div className="font-mono text-muted-foreground">
              <span className="text-yellow-400">!</span> No tasks found
              <br />
              <span className="text-xs">Run `task --new` to create your first task</span>
            </div>
          </div>
        ) : (
          tasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link href={`/p/${projectId}/t/${task.id}`}>
                <div className="gradient-border-neon rounded-lg overflow-hidden hover:glow-cyan transition-all duration-300 group cursor-pointer">
                  <div className="bg-card/50 p-4 font-mono">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <CircleIcon className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm">
                            <span className="text-muted-foreground">task/</span>
                            <span className="text-cyan-500">{task.id.slice(0, 8)}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                        <div className="ml-7">
                          <h3 className="text-base text-foreground group-hover:text-cyan-500 transition-colors">
                            {task.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                            <span className={`${
                              task.deployment_status === 'completed' ? 'text-green-400' :
                              task.deployment_status === 'failed' ? 'text-red-400' :
                              task.deployment_status === 'deploying' ? 'text-yellow-400' :
                              'text-cyan-400'
                            }`}>
                              {task.deployment_status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ArrowRightIcon className="h-4 w-4 text-muted-foreground group-hover:text-cyan-500 transition-all transform group-hover:translate-x-1 mt-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>

      {/* Task Summary Terminal */}
      {tasks.length > 0 && (
        <div className="terminal-bg rounded-lg border border-border p-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Total: <span className="text-cyan-500">{tasks.length}</span> tasks
            </span>
            <span className="text-muted-foreground">
              Status: <span className="text-green-400">All systems operational</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}