"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Package,
  FileText,
  Code,
  FlaskConical,
  Check,
  Loader2,
  AlertCircle,
  Clock
} from "lucide-react"
import { format } from "date-fns"

interface StageTimelineProps {
  currentStage: string
  stages: any
}

const stageConfig = [
  {
    key: 'deployment',
    label: 'Environment Setup',
    icon: Package,
    color: 'blue'
  },
  {
    key: 'planning',
    label: 'Analysis & Planning',
    icon: FileText,
    color: 'purple'
  },
  {
    key: 'implementation',
    label: 'Code Implementation',
    icon: Code,
    color: 'amber'
  },
  {
    key: 'testing',
    label: 'Testing & Verification',
    icon: FlaskConical,
    color: 'green'
  }
]

export function StageTimeline({ currentStage, stages }: StageTimelineProps) {
  const getStageStatus = (stageKey: string) => {
    const stageIndex = stageConfig.findIndex(s => s.key === stageKey)
    const currentIndex = stageConfig.findIndex(s => s.key === currentStage)

    if (stageIndex < currentIndex) {
      return 'completed'
    } else if (stageIndex === currentIndex) {
      if (stages[stageKey]?.complete) return 'completed'
      return 'active'
    }
    return 'pending'
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center justify-between min-w-max px-4">
          {stageConfig.map((stage, index) => {
            const status = getStageStatus(stage.key)
            const stageData = stages[stage.key]
            const Icon = stage.icon
            const isLast = index === stageConfig.length - 1

            return (
              <div key={stage.key} className="flex items-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Stage Circle */}
                  <div
                    className={cn(
                      "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background transition-all duration-300",
                      status === 'completed' && `bg-${stage.color}-500 border-${stage.color}-500 text-white`,
                      status === 'active' && `border-${stage.color}-500 text-${stage.color}-500 animate-pulse`,
                      status === 'pending' && "border-muted-foreground/30 text-muted-foreground/50"
                    )}
                    style={{
                      backgroundColor: status === 'completed' ? `var(--${stage.color}-500)` : undefined,
                      borderColor: status === 'active' ? `var(--${stage.color}-500)` : undefined,
                      color: status === 'completed' ? 'white' : status === 'active' ? `var(--${stage.color}-500)` : undefined
                    }}
                  >
                    {status === 'completed' ? (
                      <Check className="h-5 w-5" />
                    ) : status === 'active' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  {/* Stage Label and Time */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center w-32">
                    <p className={cn(
                      "text-xs font-medium",
                      status === 'active' && "text-foreground",
                      status === 'completed' && "text-muted-foreground",
                      status === 'pending' && "text-muted-foreground/50"
                    )}>
                      {stage.label}
                    </p>
                    {stageData?.started_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(stageData.started_at), 'HH:mm')}
                      </p>
                    )}
                  </div>

                  {/* Status Badge */}
                  {status === 'active' && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full whitespace-nowrap">
                        In Progress
                      </span>
                    </div>
                  )}
                  {status === 'completed' && stageData?.completed_at && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        ✓ {format(new Date(stageData.completed_at), 'HH:mm')}
                      </span>
                    </div>
                  )}
                </motion.div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="relative flex-1 mx-4">
                    <div className="absolute inset-0 flex items-center">
                      <div
                        className={cn(
                          "h-0.5 w-full transition-all duration-500",
                          status === 'completed' ? "bg-gradient-to-r from-green-500 to-green-400" : "bg-muted-foreground/20"
                        )}
                      >
                        {status === 'completed' && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Spacer for labels */}
      <div className="h-12" />
    </div>
  )
}