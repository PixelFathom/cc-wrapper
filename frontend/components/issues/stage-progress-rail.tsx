"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  Clock,
  Code,
  FileText,
  FlaskConical,
  Package,
  Rocket,
  GitPullRequest,
  Lock
} from "lucide-react"
import { motion } from "framer-motion"

export type StageKey = 'deployment' | 'planning' | 'implementation' | 'deploy' | 'testing' | 'pr'

interface StageProgressRailProps {
  currentStage: StageKey
  stages: Record<string, any>
  selectedStage?: StageKey
  onStageSelect?: (stage: StageKey) => void
  lockedStages?: StageKey[]
}

const stageConfig: Array<{
  key: StageKey
  label: string
  icon: any
}> = [
  { key: 'deployment', label: 'Deployment', icon: Package },
  { key: 'planning', label: 'Planning', icon: FileText },
  { key: 'implementation', label: 'Implementation', icon: Code },
  { key: 'deploy', label: 'Deploy', icon: Rocket },
  { key: 'testing', label: 'Testing', icon: FlaskConical },
  { key: 'pr', label: 'Pull Request', icon: GitPullRequest }
]

export function StageProgressRail({ currentStage, stages, selectedStage, onStageSelect, lockedStages = [] }: StageProgressRailProps) {
  const stageOrder = useMemo(() => stageConfig.map((stage) => stage.key), [])

  const getStageStatus = (stageKey: StageKey) => {
    const stageIndex = stageOrder.indexOf(stageKey)
    const currentIndex = stageOrder.indexOf(currentStage)

    if (stageIndex < currentIndex) return 'completed'
    if (stageIndex === currentIndex) {
      if (stages?.[stageKey]?.complete) return 'completed'
      return 'active'
    }
    return 'pending'
  }

  const currentIndex = stageOrder.indexOf(currentStage)
  const progressPercentage = ((currentIndex + 1) / stageOrder.length) * 100

  return (
    <div className="relative">
      {/* Minimalist container */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8">
        <div className="flex items-center justify-between relative">
          {/* Progress line background */}
          <div className="absolute left-0 right-0 top-6 h-0.5 bg-border/40" style={{ zIndex: 0 }} />

          {/* Active progress line */}
          <motion.div
            className="absolute left-0 top-6 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ zIndex: 0 }}
          />

          {stageConfig.map((stage, index) => {
            const status = getStageStatus(stage.key)
            const Icon = stage.icon
            const stageData = stages?.[stage.key]
            const isSelected = selectedStage ? selectedStage === stage.key : currentStage === stage.key
            const isCompleted = status === 'completed'
            const isActive = status === 'active'
            const isPending = status === 'pending'
            const isLocked = lockedStages.includes(stage.key) && !isCompleted

            return (
              <motion.button
                key={stage.key}
                type="button"
                onClick={() => !isLocked && onStageSelect?.(stage.key)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={cn(
                  'group relative flex flex-col items-center gap-3 transition-all duration-200',
                  isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'
                )}
                style={{ zIndex: 1 }}
                disabled={isLocked}
              >
                {/* Icon circle */}
                <div className="relative">
                  <motion.div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background transition-all duration-300",
                      isCompleted && "border-green-500 shadow-lg shadow-green-500/20",
                      isActive && !isCompleted && "border-primary shadow-lg shadow-primary/20",
                      isPending && "border-border",
                      isLocked && !isCompleted && "opacity-70"
                    )}
                    whileHover={{ scale: 1.1 }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : isLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Icon className={cn(
                        "h-5 w-5 transition-colors",
                        isActive && !isCompleted && "text-primary",
                        isPending && "text-muted-foreground"
                      )} />
                    )}
                  </motion.div>

                  {/* Pulsing indicator for active */}
                  {isActive && !isCompleted && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="space-y-1 text-center">
                  <p className={cn(
                    "text-xs font-medium transition-colors whitespace-nowrap",
                    isCompleted && "text-green-600 dark:text-green-400",
                    isActive && !isCompleted && "text-primary",
                    isPending && "text-muted-foreground"
                  )}>
                    {stage.label}
                  </p>

                  {stageData?.completed_at && (
                    <p className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(stageData.completed_at), 'HH:mm')}
                    </p>
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && !isLocked && (
                  <motion.div
                    layoutId="stageSelector"
                    className="absolute -inset-2 rounded-2xl border border-primary/40 bg-primary/5"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Minimal current stage info */}
        <div className="mt-6 flex items-center justify-center gap-3 pt-6 border-t border-border/40">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-medium text-foreground">
              {stageConfig.find(s => s.key === currentStage)?.label}
            </span>
          </div>
          {stages?.[currentStage]?.session_id && (
            <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              {stages[currentStage].session_id.slice(0, 8)}
            </code>
          )}
        </div>
      </div>
    </div>
  )
}
