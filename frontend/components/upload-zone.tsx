'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadIcon, CheckCircledIcon, CrossCircledIcon, UpdateIcon } from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadZoneProps {
  orgName: string
  cwd: string
  remotePath?: string
  onUploadComplete?: () => void
  onUpload?: (file: File) => Promise<any>
  acceptedFileTypes?: Record<string, string[]>
}

interface UploadStatus {
  filename: string
  status: 'uploading' | 'success' | 'error'
  message?: string
  remotePath?: string
}

export function UploadZone({ orgName, cwd, remotePath, onUploadComplete, onUpload, acceptedFileTypes }: UploadZoneProps) {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newStatuses: UploadStatus[] = acceptedFiles.map(file => ({
        filename: file.name,
        status: 'uploading' as const,
        message: 'Creating temporary file...'
      }))
      
      setUploadStatuses(prev => [...prev, ...newStatuses])

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        const statusIndex = uploadStatuses.length + i
        
        try {
          // Update status to show uploading to remote
          setUploadStatuses(prev => prev.map((status, idx) => 
            idx === statusIndex 
              ? { ...status, message: 'Uploading to remote server...' }
              : status
          ))

          const result = onUpload 
            ? await onUpload(file)
            : await api.uploadFile(file, orgName, cwd, remotePath)
          
          // Update status to success
          setUploadStatuses(prev => prev.map((status, idx) => 
            idx === statusIndex 
              ? { 
                  ...status, 
                  status: 'success', 
                  message: result.message,
                  remotePath: result.remote_path
                }
              : status
          ))
        } catch (error) {
          console.error('Upload failed:', error)
          // Update status to error
          setUploadStatuses(prev => prev.map((status, idx) => 
            idx === statusIndex 
              ? { 
                  ...status, 
                  status: 'error', 
                  message: error instanceof Error ? error.message : 'Upload failed'
                }
              : status
          ))
        }
      }
      onUploadComplete?.()
    },
    [orgName, cwd, remotePath, uploadStatuses.length, onUploadComplete, onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes || {
      'text/*': [],
      'image/*': [],
      'application/pdf': [],
    },
  })

  const getStatusIcon = (status: UploadStatus['status']) => {
    switch (status) {
      case 'uploading':
        return <UpdateIcon className="h-4 w-4 text-cyan-500 animate-spin" />
      case 'success':
        return <CheckCircledIcon className="h-4 w-4 text-green-500" />
      case 'error':
        return <CrossCircledIcon className="h-4 w-4 text-red-500" />
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'gradient-border-neon rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'bg-cyan-500/10 border-cyan-500'
            : 'bg-card/50 hover:bg-card/70'
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className={cn(
          "h-12 w-12 mx-auto mb-4 transition-colors",
          isDragActive ? "text-cyan-500" : "text-muted-foreground"
        )} />
        {isDragActive ? (
          <p className="text-lg font-mono text-cyan-500">Drop the files here...</p>
        ) : (
          <div className="font-mono">
            <p className="text-lg mb-2 text-foreground">Drag & drop files here</p>
            <p className="text-sm text-muted-foreground">or click to select files</p>
            {remotePath && (
              <p className="text-xs text-cyan-500 mt-2">
                Remote path: {remotePath}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Upload Status List */}
      {uploadStatuses.length > 0 && (
        <div className="terminal-bg rounded-lg border border-border p-4 space-y-2 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-mono text-muted-foreground mb-2">Upload Status</h3>
          <AnimatePresence>
            {uploadStatuses.map((status, index) => (
              <motion.div
                key={`${status.filename}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "flex items-center space-x-2 p-2 rounded font-mono text-xs",
                  status.status === 'success' && "bg-green-500/10",
                  status.status === 'error' && "bg-red-500/10",
                  status.status === 'uploading' && "bg-cyan-500/10"
                )}
              >
                {getStatusIcon(status.status)}
                <div className="flex-1">
                  <div className={cn(
                    "font-semibold",
                    status.status === 'success' && "text-green-400",
                    status.status === 'error' && "text-red-400",
                    status.status === 'uploading' && "text-cyan-400"
                  )}>
                    {status.filename}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {status.message}
                  </div>
                  {status.remotePath && (
                    <div className="text-cyan-500 text-xs mt-1">
                      → {status.remotePath}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}