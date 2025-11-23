'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ACCENT_CLASSES, StageAccent } from './stage-config'

interface StagePanelProps {
  accent: StageAccent
  title: string
  description?: string
  statusBadge?: ReactNode
  icon?: ReactNode
  children: ReactNode
  actions?: ReactNode
  footer?: ReactNode
}

export function StagePanel({
  accent,
  title,
  description,
  statusBadge,
  icon,
  children,
  actions,
  footer,
}: StagePanelProps) {
  const accentClasses = ACCENT_CLASSES[accent]

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card/70 backdrop-blur-xl p-6 sm:p-8',
        'shadow-lg shadow-black/30 transition-all duration-300',
        accentClasses.border,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className={cn(
                'h-12 w-12 rounded-xl border bg-gradient-to-br flex items-center justify-center text-lg',
                'border-white/5 text-white/90',
                accentClasses.border,
              )}
            >
              {icon}
            </div>
          )}
          <div>
            <h2 className={cn('text-xl font-semibold', accentClasses.text)}>{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {statusBadge}
          {actions}
        </div>
      </div>

      <div className="mt-6 space-y-6">{children}</div>

      {footer && (
        <div className="mt-6 border-t border-border/60 pt-6">
          {footer}
        </div>
      )}
    </div>
  )
}
