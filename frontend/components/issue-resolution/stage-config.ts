'use client'

import {
  RocketIcon,
  FileTextIcon,
  CodeIcon,
  CheckCircledIcon,
  ClipboardCopyIcon,
} from '@radix-ui/react-icons'

export type StageId = 'deployment' | 'planning' | 'implementation' | 'testing' | 'handoff'

export type StageAccent = 'cyan' | 'violet' | 'amber' | 'emerald' | 'slate'

export interface StageConfig {
  id: StageId
  label: string
  subtitle: string
  accent: StageAccent
  icon: typeof RocketIcon
}

export const STAGE_CONFIG: StageConfig[] = [
  {
    id: 'deployment',
    label: 'Deployment',
    subtitle: 'Environment setup & init',
    accent: 'cyan',
    icon: RocketIcon,
  },
  {
    id: 'planning',
    label: 'Planning',
    subtitle: 'Analysis & solution approach',
    accent: 'violet',
    icon: FileTextIcon,
  },
  {
    id: 'implementation',
    label: 'Implementation',
    subtitle: 'Coding & automation',
    accent: 'amber',
    icon: CodeIcon,
  },
  {
    id: 'testing',
    label: 'Testing',
    subtitle: 'Validation & QA',
    accent: 'emerald',
    icon: ClipboardCopyIcon,
  },
  {
    id: 'handoff',
    label: 'Wrap-Up',
    subtitle: 'PR & delivery',
    accent: 'slate',
    icon: CheckCircledIcon,
  },
]

export const ACCENT_CLASSES: Record<
  StageAccent,
  { text: string; border: string; glow: string; progress: string; badge: string }
> = {
  cyan: {
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    glow: 'shadow-[0_0_25px_rgba(34,211,238,0.25)]',
    progress: 'bg-gradient-to-r from-cyan-400 to-blue-400',
    badge: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/30',
  },
  violet: {
    text: 'text-purple-300',
    border: 'border-purple-500/40',
    glow: 'shadow-[0_0_25px_rgba(168,85,247,0.25)]',
    progress: 'bg-gradient-to-r from-purple-400 to-pink-400',
    badge: 'bg-purple-500/10 text-purple-200 border-purple-500/30',
  },
  amber: {
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_25px_rgba(245,158,11,0.25)]',
    progress: 'bg-gradient-to-r from-amber-400 to-orange-400',
    badge: 'bg-amber-500/10 text-amber-100 border-amber-500/30',
  },
  emerald: {
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_25px_rgba(16,185,129,0.25)]',
    progress: 'bg-gradient-to-r from-emerald-400 to-green-400',
    badge: 'bg-emerald-500/10 text-emerald-100 border-emerald-500/30',
  },
  slate: {
    text: 'text-slate-200',
    border: 'border-slate-500/30',
    glow: 'shadow-[0_0_25px_rgba(148,163,184,0.25)]',
    progress: 'bg-gradient-to-r from-slate-300 to-zinc-400',
    badge: 'bg-slate-500/10 text-slate-100 border-slate-500/30',
  },
}
