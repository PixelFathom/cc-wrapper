'use client'

import { cn } from '@/lib/utils'
import {
  StageId,
  StageConfig,
  ACCENT_CLASSES,
} from './stage-config'
import { CheckCircledIcon, DotFilledIcon } from '@radix-ui/react-icons'

export type StageStatus = 'complete' | 'active' | 'upcoming' | 'blocked'

export interface StageNavItem extends StageConfig {
  status: StageStatus
  progress: number
  startedAt?: string
  completedAt?: string
  disabled?: boolean
}

interface StageNavProps {
  stages: StageNavItem[]
  activeStage: StageId
  onStageChange: (stage: StageId) => void
}

export function StageNav({ stages, activeStage, onStageChange }: StageNavProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xl p-4 sm:p-6">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage, index) => {
          const Icon = stage.icon
          const isActive = activeStage === stage.id
          const isComplete = stage.status === 'complete'
          const accent = ACCENT_CLASSES[stage.accent]

          return (
            <button
              key={stage.id}
              disabled={stage.disabled}
              onClick={() => onStageChange(stage.id)}
              className={cn(
                'min-w-[180px] flex-1 rounded-2xl border px-4 py-3 text-left transition-all duration-300',
                'bg-gradient-to-br from-black/40 to-transparent',
                accent.border,
                isActive && 'ring-2 ring-offset-2 ring-offset-background ring-border/40',
                stage.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-xs text-muted-foreground">{index + 1}</span>
                  <Icon className={cn('h-4 w-4', accent.text)} />
                  <span className="text-foreground">{stage.label}</span>
                </div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {stage.status === 'active' && 'In Progress'}
                  {stage.status === 'complete' && 'Done'}
                  {stage.status === 'upcoming' && 'Next'}
                  {stage.status === 'blocked' && 'Blocked'}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{stage.subtitle}</p>

              <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', accent.progress)}
                  style={{ width: `${Math.min(stage.progress, 100)}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {isComplete ? (
                    <CheckCircledIcon className={cn('h-3.5 w-3.5', accent.text)} />
                  ) : (
                    <DotFilledIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                  {stage.status === 'complete' ? 'Complete' : stage.status === 'active' ? 'In progress' : 'Pending'}
                </span>
                {stage.completedAt ? (
                  <span>{new Date(stage.completedAt).toLocaleTimeString()}</span>
                ) : stage.startedAt ? (
                  <span>{new Date(stage.startedAt).toLocaleTimeString()}</span>
                ) : (
                  <span>&nbsp;</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
