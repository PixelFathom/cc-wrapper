'use client'

import { motion } from 'framer-motion'
import {
  RocketIcon,
  GitHubLogoIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  LightningBoltIcon,
  CubeIcon
} from '@radix-ui/react-icons'

const features = [
  {
    icon: ChatBubbleIcon,
    name: 'ai-queries',
    description: 'Chat with AI agents to build and optimize',
  },
  {
    icon: RocketIcon,
    name: 'deployments',
    description: 'One-click build and deploy automation',
  },
  {
    icon: GitHubLogoIcon,
    name: 'git-sync',
    description: 'Deep GitHub repository integration',
  },
  {
    icon: LightningBoltIcon,
    name: 'hosting',
    description: 'Managed cloud hosting with SSL',
  },
  {
    icon: CheckCircledIcon,
    name: 'approvals',
    description: 'Built-in approval workflows',
  },
  {
    icon: CubeIcon,
    name: 'containers',
    description: 'Docker-based environments',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 border-t border-border/30">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="terminal-bg rounded-lg border border-border p-4 max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">~/features</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-400 ml-2">tediux</span>
              <span className="text-muted-foreground ml-2">features --all</span>
            </div>
          </div>
        </motion.div>

        {/* Features Grid - Minimal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              viewport={{ once: true }}
            >
              <div className="group flex items-start gap-4 p-4 rounded-lg border border-border/40 bg-card/30 hover:border-cyan-500/30 hover:bg-card/50 transition-all duration-200">
                <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-cyan-400 mb-1">{feature.name}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Terminal CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-12"
        >
          <div className="terminal-bg rounded-lg border border-border p-6 max-w-2xl mx-auto">
            <div className="font-mono text-sm space-y-2">
              <div>
                <span className="text-green-400">➜</span>
                <span className="text-cyan-400 ml-2">tediux</span>
                <span className="text-muted-foreground ml-2">init my-project</span>
              </div>
              <div className="pl-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircledIcon className="h-3.5 w-3.5 text-green-500" />
                  <span>Project initialized</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircledIcon className="h-3.5 w-3.5 text-green-500" />
                  <span>AI agents connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircledIcon className="h-3.5 w-3.5 text-green-500" />
                  <span>Ready to deploy</span>
                </div>
              </div>
              <div className="pt-2">
                <span className="text-cyan-400">→</span>
                <span className="text-muted-foreground ml-2">Start building at</span>
                <span className="text-cyan-400 ml-1">localhost:3000</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom Status */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
