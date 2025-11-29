"use client"

import { useState } from "react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import {
  Activity,
  ChevronDown,
  Clock,
  Info,
  MessageSquare,
  Package,
  RefreshCw,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

// ==================== HOOK ITEM ====================
interface HookItemProps {
  hook: any
  index: number
  onClick: () => void
  accentColor?: string
}

export function StageHookItem({ hook, index, onClick, accentColor = "purple" }: HookItemProps) {
  const Icon = hook.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className={cn(
        "relative rounded-lg border bg-card hover:bg-accent/5 transition-all duration-200 hover:shadow-md overflow-hidden",
        `hover:border-${accentColor}-300 dark:hover:border-${accentColor}-700`
      )}>
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r from-transparent via-transparent opacity-0 group-hover:opacity-100 transition-opacity",
          `to-${accentColor}-500/5`
        )} />
        <div className="relative flex items-center gap-3 p-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0", hook.bgColor)}>
            <Icon className={cn("h-4 w-4", hook.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-1 mb-0.5">{hook.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(new Date(hook.timestamp), 'HH:mm:ss')}
              {hook.toolName && (
                <>
                  <span>•</span>
                  <code className="font-mono text-xs">{hook.toolName}</code>
                </>
              )}
            </div>
          </div>
          {hook.status && (
            <Badge
              variant={
                hook.status === 'completed' ? 'default' :
                hook.status === 'error' || hook.status === 'failed' ? 'destructive' :
                'secondary'
              }
              className="text-xs flex-shrink-0"
            >
              {hook.status}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ==================== HOOK DETAILS MODAL ====================
interface HookDetailsModalProps {
  hook: any | null
  isOpen: boolean
  onClose: () => void
}

export function StageHookDetailsModal({ hook, isOpen, onClose }: HookDetailsModalProps) {
  if (!hook) return null

  const Icon = hook.icon

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-6">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0", hook.bgColor)}>
              <Icon className={cn("h-6 w-6", hook.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold">{hook.title}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(hook.timestamp), 'MMM d, yyyy HH:mm:ss')}
                </span>
                {hook.toolName && (
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    <code className="font-mono text-xs">{hook.toolName}</code>
                  </span>
                )}
                {hook.hookType && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {hook.hookType}
                  </Badge>
                )}
                {hook.status && (
                  <Badge
                    variant={
                      hook.status === 'completed' ? 'default' :
                      hook.status === 'error' || hook.status === 'failed' ? 'destructive' :
                      'secondary'
                    }
                    className="text-xs"
                  >
                    {hook.status}
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Separator className="my-4" />
        <ScrollArea className="max-h-[calc(85vh-200px)] pr-4">
          <div className="space-y-4 pb-4">
            {hook.message && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Message
                </h4>
                <div className="rounded-lg bg-muted/50 border p-3">
                  <p className="text-sm leading-relaxed">{hook.message}</p>
                </div>
              </div>
            )}
            {Object.entries(hook.details).map(([key, value]: [string, any]) => {
              if (!value) return null
              const stringValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
              const isResult = key.toLowerCase() === 'result'

              return (
                <div key={key}>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 capitalize">
                    <Info className="h-4 w-4" />
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <div className="rounded-lg bg-muted/50 border p-4 overflow-auto max-h-[400px]">
                    {isResult ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-black/40 prose-pre:border prose-code:text-xs">
                        <ReactMarkdown>{stringValue}</ReactMarkdown>
                      </div>
                    ) : (
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">{stringValue}</pre>
                    )}
                  </div>
                </div>
              )
            })}
            {!hook.message && Object.keys(hook.details).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No additional details available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ==================== SUMMARY CARD ====================
interface StageSummaryCardProps {
  title: string
  description: string
  content: string
  icon: any
  accentColor: "blue" | "purple" | "emerald" | "orange" | "green"
  badge?: string
}

export function StageSummaryCard({
  title,
  description,
  content,
  icon: Icon,
  accentColor,
  badge
}: StageSummaryCardProps) {
  const colorMap = {
    blue: {
      border: "border-blue-300 dark:border-blue-700",
      gradient: "from-blue-500 to-cyan-600",
      blockquote: "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
      link: "text-blue-600 dark:text-blue-400",
      badgeBorder: "border-blue-300 dark:border-blue-700",
      badgeText: "text-blue-700 dark:text-blue-400",
      bgGradient: "from-blue-500/10"
    },
    purple: {
      border: "border-purple-300 dark:border-purple-700",
      gradient: "from-purple-500 to-violet-600",
      blockquote: "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20",
      link: "text-purple-600 dark:text-purple-400",
      badgeBorder: "border-purple-300 dark:border-purple-700",
      badgeText: "text-purple-700 dark:text-purple-400",
      bgGradient: "from-purple-500/10"
    },
    emerald: {
      border: "border-emerald-300 dark:border-emerald-700",
      gradient: "from-emerald-500 to-teal-600",
      blockquote: "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
      link: "text-emerald-600 dark:text-emerald-400",
      badgeBorder: "border-emerald-300 dark:border-emerald-700",
      badgeText: "text-emerald-700 dark:text-emerald-400",
      bgGradient: "from-emerald-500/10"
    },
    orange: {
      border: "border-orange-300 dark:border-orange-700",
      gradient: "from-orange-500 to-amber-600",
      blockquote: "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
      link: "text-orange-600 dark:text-orange-400",
      badgeBorder: "border-orange-300 dark:border-orange-700",
      badgeText: "text-orange-700 dark:text-orange-400",
      bgGradient: "from-orange-500/10"
    },
    green: {
      border: "border-green-300 dark:border-green-700",
      gradient: "from-green-500 to-emerald-600",
      blockquote: "border-green-500 bg-green-50/50 dark:bg-green-950/20",
      link: "text-green-600 dark:text-green-400",
      badgeBorder: "border-green-300 dark:border-green-700",
      badgeText: "text-green-700 dark:text-green-400",
      bgGradient: "from-green-500/10"
    }
  }

  const colors = colorMap[accentColor]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className={cn("shadow-lg overflow-hidden", colors.border)}>
        <div className={cn("absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl to-transparent rounded-full blur-3xl", colors.bgGradient)} />
        <CardHeader className="pb-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn("rounded-xl p-3 shadow-lg bg-gradient-to-br", colors.gradient)}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{title}</CardTitle>
                <CardDescription className="text-sm mt-1">{description}</CardDescription>
              </div>
            </div>
            {badge && (
              <Badge variant="outline" className={cn("text-xs font-semibold", colors.badgeBorder, colors.badgeText)}>
                {badge}
              </Badge>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <ScrollArea className="h-[600px] w-full">
            <div className="p-8">
              <div className={cn(
                "prose prose-sm dark:prose-invert max-w-none",
                "prose-headings:font-bold prose-headings:tracking-tight",
                "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base",
                "prose-p:leading-relaxed prose-p:text-foreground/90",
                "prose-li:text-foreground/90",
                "prose-strong:text-foreground prose-strong:font-semibold",
                "prose-code:text-sm prose-code:bg-muted prose-code:px-2 prose-code:py-0.5 prose-code:rounded",
                "prose-code:before:content-[''] prose-code:after:content-['']",
                "prose-pre:bg-muted prose-pre:border",
                "prose-blockquote:border-l-4 prose-blockquote:py-2",
                `prose-blockquote:${colors.blockquote}`,
                `prose-a:${colors.link}`,
                "prose-a:no-underline hover:prose-a:underline"
              )}>
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="mt-8 mb-4 first:mt-0" {...props} />,
                    h2: ({node, ...props}) => <h2 className="mt-6 mb-3 first:mt-0" {...props} />,
                    h3: ({node, ...props}) => <h3 className="mt-5 mb-2.5 first:mt-0" {...props} />,
                    h4: ({node, ...props}) => <h4 className="mt-4 mb-2 first:mt-0" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4" {...props} />,
                    ul: ({node, ...props}) => <ul className="mb-4 space-y-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="mb-4 space-y-2" {...props} />,
                    li: ({node, ...props}) => <li className="ml-4" {...props} />,
                    code: ({node, inline, ...props}: any) =>
                      inline ? <code {...props} /> : <code className="block" {...props} />,
                    pre: ({node, ...props}) => <pre className="mb-4 overflow-x-auto" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="mb-4" {...props} />,
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== HOOKS SECTION ====================
interface StageHooksSectionProps {
  hooks: any[]
  accentColor: "blue" | "purple" | "emerald" | "orange" | "green"
  title?: string
  description?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function StageHooksSection({
  hooks,
  accentColor,
  title = "All Activity",
  description,
  onRefresh,
  isRefreshing = false
}: StageHooksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedHook, setSelectedHook] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleHookClick = (hook: any) => {
    setSelectedHook(hook)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setTimeout(() => setSelectedHook(null), 200)
  }

  const colorMap = {
    blue: "from-blue-500/10 to-cyan-500/10 text-blue-600",
    purple: "from-purple-500/10 to-violet-500/10 text-purple-600",
    emerald: "from-emerald-500/10 to-teal-500/10 text-emerald-600",
    orange: "from-orange-500/10 to-amber-500/10 text-orange-600",
    green: "from-green-500/10 to-emerald-500/10 text-green-600"
  }

  if (hooks.length === 0) return null

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1">
                  <div className={cn("rounded-lg bg-gradient-to-br p-2", colorMap[accentColor])}>
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">{title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {description || `Complete execution log with ${hooks.length} events`}
                    </CardDescription>
                  </div>
                </div>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRefresh()
                    }}
                    disabled={isRefreshing}
                    className="h-8 w-8 p-0"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <Separator />
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px] w-full pr-4">
                <div className="space-y-2">
                  {hooks.map((hook, index) => (
                    <StageHookItem
                      key={hook.id}
                      hook={hook}
                      index={index}
                      onClick={() => handleHookClick(hook)}
                      accentColor={accentColor}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <StageHookDetailsModal hook={selectedHook} isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  )
}

// ==================== METADATA SECTION ====================
interface StageMetadataProps {
  items: Array<{
    label: string
    value: string | number
    icon?: any
  }>
  title?: string
  accentColor: "blue" | "purple" | "emerald" | "orange" | "green"
}

export function StageMetadata({ items, title = "Stage Metadata", accentColor }: StageMetadataProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const colorMap = {
    blue: "from-blue-500/10 to-cyan-500/10 text-blue-600",
    purple: "from-purple-500/10 to-violet-500/10 text-purple-600",
    emerald: "from-emerald-500/10 to-teal-500/10 text-emerald-600",
    orange: "from-orange-500/10 to-amber-500/10 text-orange-600",
    green: "from-green-500/10 to-emerald-500/10 text-green-600"
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-all py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg bg-gradient-to-br p-2", colorMap[accentColor])}>
                  <Info className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm font-bold">{title}</CardTitle>
              </div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((item, index) => {
                const ItemIcon = item.icon
                return (
                  <div key={index} className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      {ItemIcon && <ItemIcon className="h-3 w-3" />}
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold">{item.value}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
