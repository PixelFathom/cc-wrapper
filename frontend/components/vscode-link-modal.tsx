'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CodeIcon, CheckCircledIcon, CopyIcon, ExternalLinkIcon, UpdateIcon, InfoCircledIcon } from '@radix-ui/react-icons'
import { api } from '@/lib/api'

interface VSCodeLinkModalProps {
  taskId: string
  trigger: React.ReactNode
}

export function VSCodeLinkModal({ taskId, trigger }: VSCodeLinkModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [result, setResult] = useState<{
    tunnel_link: string
    tunnel_name: string
    authentication_required: boolean
    authentication_url?: string
    device_code?: string
  } | null>(null)
  const [copied, setCopied] = useState<'device_code' | 'tunnel_link' | null>(null)

  const handleGenerateLink = async () => {
    setIsLoading(true)
    try {
      const response = await api.getTaskVSCodeLink(taskId, undefined, userName || undefined)
      setResult(response)
    } catch (error) {
      console.error('Failed to get VS Code link:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, type: 'device_code' | 'tunnel_link') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleReset = () => {
    setResult(null)
    setUserName('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) {
        // Reset state when closing
        setTimeout(() => {
          handleReset()
        }, 300)
      }
    }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CodeIcon className="h-5 w-5 text-purple-400" />
            Open in VS Code
          </DialogTitle>
          <DialogDescription>
            Generate a tunnel link to access your project in VS Code for Web
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!result ? (
            // Initial form
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userName" className="text-sm font-medium">
                    GitHub Username (Optional)
                  </Label>
                  <Input
                    id="userName"
                    placeholder="your-github-username"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="font-mono text-sm"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for naming the tunnel. Leave empty to use default naming.
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <InfoCircledIcon className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                    <div className="space-y-2 text-sm text-blue-200">
                      <p className="font-medium">About VS Code Tunnels</p>
                      <p className="text-xs text-blue-300/80">
                        VS Code tunnels allow you to access your development environment from anywhere through a secure connection.
                        You may need to authenticate with GitHub on first use.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleGenerateLink}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0"
                >
                  {isLoading ? (
                    <>
                      <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <CodeIcon className="h-4 w-4 mr-2" />
                      Generate Link
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            // Results display
            <>
              {result.authentication_required ? (
                // Authentication Required
                <div className="space-y-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <InfoCircledIcon className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-medium text-yellow-200">Authentication Required</p>
                        <p className="text-sm text-yellow-300/80">
                          Your tunnel requires GitHub authentication. Follow the steps below to complete the setup.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Device Code */}
                  {result.device_code && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Step 1: Copy Device Code</Label>
                        <span className="text-xs text-muted-foreground">Required</span>
                      </div>
                      <div className="relative">
                        <Input
                          value={result.device_code}
                          readOnly
                          className="font-mono text-lg font-bold text-center pr-20 bg-card/50"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(result.device_code!, 'device_code')}
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                        >
                          {copied === 'device_code' ? (
                            <CheckCircledIcon className="h-4 w-4 text-green-400" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Authenticate */}
                  {result.authentication_url && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Step 2: Authenticate with GitHub</Label>
                        <span className="text-xs text-muted-foreground">Required</span>
                      </div>
                      <Button
                        onClick={() => handleOpenLink(result.authentication_url!)}
                        className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white"
                      >
                        <ExternalLinkIcon className="h-4 w-4 mr-2" />
                        Open GitHub Authentication
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        A new window will open. Paste the device code when prompted.
                      </p>
                    </div>
                  )}

                  {/* Step 3: Access Tunnel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Step 3: Access Your Tunnel</Label>
                      <span className="text-xs text-muted-foreground">After authentication</span>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          value={result.tunnel_link}
                          readOnly
                          className="font-mono text-sm pr-20 bg-card/50"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(result.tunnel_link, 'tunnel_link')}
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                        >
                          {copied === 'tunnel_link' ? (
                            <CheckCircledIcon className="h-4 w-4 text-green-400" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleOpenLink(result.tunnel_link)}
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                      >
                        <CodeIcon className="h-4 w-4 mr-2" />
                        Open VS Code
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Click after completing GitHub authentication
                    </p>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-xs text-blue-300/80">
                      <strong className="text-blue-200">Note:</strong> You only need to authenticate once per tunnel.
                      Future access will work directly.
                    </p>
                  </div>
                </div>
              ) : (
                // No Authentication Required - Direct Access
                <div className="space-y-6">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircledIcon className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-medium text-green-200">Tunnel Ready</p>
                        <p className="text-sm text-green-300/80">
                          Your tunnel is configured and ready to use. Click below to open VS Code.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Tunnel Link</Label>
                    <div className="relative">
                      <Input
                        value={result.tunnel_link}
                        readOnly
                        className="font-mono text-sm pr-20 bg-card/50"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(result.tunnel_link, 'tunnel_link')}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                      >
                        {copied === 'tunnel_link' ? (
                          <CheckCircledIcon className="h-4 w-4 text-green-400" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Tunnel Name</Label>
                    <Input
                      value={result.tunnel_name}
                      readOnly
                      className="font-mono text-sm bg-card/50"
                    />
                  </div>

                  <Button
                    onClick={() => handleOpenLink(result.tunnel_link)}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                  >
                    <CodeIcon className="h-4 w-4 mr-2" />
                    Open VS Code
                  </Button>
                </div>
              )}

              {/* Reset Button */}
              <div className="pt-4 border-t border-border">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  Generate New Link
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
