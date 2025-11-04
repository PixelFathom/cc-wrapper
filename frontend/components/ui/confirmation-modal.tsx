'use client'

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './button'
import { AlertTriangleIcon, InfoIcon, TrashIcon } from '@radix-ui/react-icons'

export interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'default'
  icon?: ReactNode
  loading?: boolean
  children?: ReactNode
}

const variantStyles = {
  danger: {
    icon: <TrashIcon className="h-6 w-6 text-red-500" />,
    iconBg: 'bg-red-500/10',
    confirmButton: 'bg-red-500 hover:bg-red-600 text-white',
    border: 'border-red-500/50',
  },
  warning: {
    icon: <AlertTriangleIcon className="h-6 w-6 text-yellow-500" />,
    iconBg: 'bg-yellow-500/10',
    confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-black',
    border: 'border-yellow-500/50',
  },
  info: {
    icon: <InfoIcon className="h-6 w-6 text-cyan-500" />,
    iconBg: 'bg-cyan-500/10',
    confirmButton: 'bg-cyan-500 hover:bg-cyan-600 text-black',
    border: 'border-cyan-500/50',
  },
  default: {
    icon: <InfoIcon className="h-6 w-6 text-foreground" />,
    iconBg: 'bg-foreground/10',
    confirmButton: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    border: 'border-border',
  },
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  loading = false,
  children,
}: ConfirmationModalProps) {
  const styles = variantStyles[variant]
  const displayIcon = icon || styles.icon

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) {
              onClose()
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={`bg-card rounded-lg max-w-md w-full shadow-2xl border ${styles.border}`}
          >
            {/* Header */}
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${styles.iconBg} flex-shrink-0`}>
                  {displayIcon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  {description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                  {children && (
                    <div className="mt-4">
                      {children}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/50 border-t border-border">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="min-w-[100px]"
              >
                {cancelText}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className={`min-w-[100px] ${styles.confirmButton}`}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  confirmText
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}