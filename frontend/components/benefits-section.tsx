'use client'

import { motion } from 'framer-motion'
import {
  LightningBoltIcon,
  CheckCircledIcon,
  RocketIcon,
  GearIcon
} from '@radix-ui/react-icons'

const benefits = [
  {
    command: 'speed',
    flag: '--turbo',
    title: 'Ship 10x Faster',
    stat: '90%',
    statLabel: 'faster development',
    points: [
      'AI-powered code generation',
      'Automated testing pipeline',
      'One-click deployments',
      'Smart dependency management'
    ]
  },
  {
    command: 'init',
    flag: '--zero-config',
    title: 'Zero Configuration',
    stat: '0min',
    statLabel: 'setup time',
    points: [
      'Pre-configured environments',
      'Auto project scaffolding',
      'Built-in best practices',
      'Intelligent defaults'
    ]
  },
  {
    command: 'collab',
    flag: '--team',
    title: 'Team Collaboration',
    stat: '5x',
    statLabel: 'better workflow',
    points: [
      'Real-time code sharing',
      'Centralized knowledge base',
      'Approval workflows',
      'Integrated reviews'
    ]
  }
]

export function BenefitsSection() {
  return (
    <section className="py-20 px-4 sm:px-6">
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
              <span className="text-xs font-mono text-muted-foreground ml-2">~/why-developers-love-us</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-400 ml-2">tediux</span>
              <span className="text-muted-foreground ml-2">benefits --list</span>
            </div>
          </div>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="h-full bg-card/50 rounded-lg border border-border/50 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden">
                {/* Command Header */}
                <div className="px-4 py-3 border-b border-border/30 bg-muted/20">
                  <code className="text-sm font-mono">
                    <span className="text-green-400">$</span>
                    <span className="text-cyan-400 ml-2">{benefit.command}</span>
                    <span className="text-purple-400 ml-2">{benefit.flag}</span>
                  </code>
                </div>

                {/* Content */}
                <div className="p-5">
                  {/* Stat */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold text-cyan-400 font-mono">{benefit.stat}</span>
                    <span className="text-sm text-muted-foreground">{benefit.statLabel}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-foreground mb-4">{benefit.title}</h3>

                  {/* Points */}
                  <div className="space-y-2">
                    {benefit.points.map((point, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircledIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Terminal Output */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-8 max-w-xl"
        >
          <div className="font-mono text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircledIcon className="h-4 w-4 text-green-500" />
              <span>3 benefits loaded successfully</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
