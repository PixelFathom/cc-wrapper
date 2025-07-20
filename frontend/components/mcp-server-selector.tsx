'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckIcon, LockClosedIcon, GitHubLogoIcon, DesktopIcon, GlobeIcon, CodeIcon, CubeIcon, ComponentInstanceIcon } from '@radix-ui/react-icons'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { cn } from '@/lib/utils'

interface MCPServer {
  server_type: string
  access_token?: string
}

interface MCPServerOption {
  value: string
  label: string
  shortLabel?: string
  requiresToken: boolean
  icon: React.ReactNode
  color: string
}

const MCP_SERVER_OPTIONS: MCPServerOption[] = [
  {
    value: 'context-manager',
    label: 'Context Manager',
    shortLabel: 'Context',
    requiresToken: false,
    icon: <CubeIcon className="h-4 w-4" />,
    color: 'from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30 border-purple-500/50'
  },
  {
    value: 'github',
    label: 'GitHub',
    requiresToken: true,
    icon: <GitHubLogoIcon className="h-4 w-4" />,
    color: 'from-gray-500/20 to-gray-600/20 hover:from-gray-500/30 hover:to-gray-600/30 border-gray-500/50'
  },
  {
    value: 'figma',
    label: 'Figma',
    requiresToken: true,
    icon: <ComponentInstanceIcon className="h-4 w-4" />,
    color: 'from-pink-500/20 to-rose-600/20 hover:from-pink-500/30 hover:to-rose-600/30 border-pink-500/50'
  },
  {
    value: 'context7',
    label: 'Context7',
    requiresToken: false,
    icon: <CodeIcon className="h-4 w-4" />,
    color: 'from-blue-500/20 to-indigo-600/20 hover:from-blue-500/30 hover:to-indigo-600/30 border-blue-500/50'
  }
]

interface MCPServerSelectorProps {
  value: MCPServer[]
  onChange: (servers: MCPServer[]) => void
  disabled?: boolean
}

export function MCPServerSelector({ value, onChange, disabled }: MCPServerSelectorProps) {
  const [selectedServers, setSelectedServers] = useState<Map<string, MCPServer>>(
    new Map(value.map(server => [server.server_type, server]))
  )

  const handleServerToggle = (serverType: string) => {
    const newSelected = new Map(selectedServers)
    
    if (newSelected.has(serverType)) {
      newSelected.delete(serverType)
    } else {
      newSelected.set(serverType, { server_type: serverType })
    }
    
    setSelectedServers(newSelected)
    onChange(Array.from(newSelected.values()))
  }

  const handleTokenChange = (serverType: string, token: string) => {
    const newSelected = new Map(selectedServers)
    const server = newSelected.get(serverType)
    
    if (server) {
      newSelected.set(serverType, { ...server, access_token: token })
      setSelectedServers(newSelected)
      onChange(Array.from(newSelected.values()))
    }
  }

  const isSelected = (serverType: string) => selectedServers.has(serverType)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">MCP Servers</Label>
        {disabled && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <LockClosedIcon className="h-3 w-3" />
            <span>Read-only</span>
          </div>
        )}
      </div>
      
      {/* Grid of MCP servers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {MCP_SERVER_OPTIONS.map((option) => {
          const selected = isSelected(option.value)
          
          return (
            <motion.div
              key={option.value}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
            >
              <button
                type="button"
                onClick={() => !disabled && handleServerToggle(option.value)}
                disabled={disabled}
                className={cn(
                  "relative w-full p-3 rounded-lg border transition-all duration-200",
                  "bg-gradient-to-br",
                  selected ? option.color : "from-gray-800/20 to-gray-900/20 border-gray-700/50",
                  selected && "shadow-sm",
                  !disabled && "cursor-pointer",
                  disabled && "opacity-60 cursor-not-allowed"
                )}
              >
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "transition-colors",
                    selected ? "text-cyan-400" : "text-muted-foreground"
                  )}>
                    {option.icon}
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-colors",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {option.shortLabel || option.label}
                  </span>
                  {selected && (
                    <CheckIcon className="h-3 w-3 text-cyan-400 ml-auto" />
                  )}
                </div>
                
                {/* Token indicator */}
                {option.requiresToken && selected && (
                  <div className="absolute top-1 right-1">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      selectedServers.get(option.value)?.access_token 
                        ? "bg-green-500" 
                        : "bg-yellow-500 animate-pulse"
                    )} />
                  </div>
                )}
              </button>
            </motion.div>
          )
        })}
      </div>
      
      {/* Token inputs for selected servers that require them */}
      <AnimatePresence>
        {Array.from(selectedServers.entries()).map(([serverType, server]) => {
          const option = MCP_SERVER_OPTIONS.find(opt => opt.value === serverType)
          if (!option?.requiresToken) return null
          
          return (
            <motion.div
              key={serverType}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border">
                <div className="flex-shrink-0 text-muted-foreground">
                  {option.icon}
                </div>
                <Input
                  type="password"
                  placeholder={`${option.label} access token`}
                  value={server.access_token || ''}
                  onChange={(e) => handleTokenChange(serverType, e.target.value)}
                  disabled={disabled}
                  className="h-8 text-xs font-mono bg-background/50"
                />
                {!server.access_token && (
                  <span className="text-xs text-yellow-500 flex-shrink-0">Required</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      
      {/* Summary */}
      {value.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {value.length} server{value.length !== 1 ? 's' : ''} selected
          </span>
          {value.some(s => MCP_SERVER_OPTIONS.find(o => o.value === s.server_type)?.requiresToken && !s.access_token) && (
            <span className="text-yellow-500">Some tokens missing</span>
          )}
        </div>
      )}
    </div>
  )
}