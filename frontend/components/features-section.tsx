'use client'

import { motion } from 'framer-motion'
import {
  RocketIcon,
  CodeIcon,
  GitHubLogoIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  LightningBoltIcon,
  MixIcon,
  UpdateIcon
} from '@radix-ui/react-icons'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const features = [
  {
    icon: RocketIcon,
    title: 'AI-Powered Queries',
    description: 'Chat with AI agents to build, update, and optimize your projects. Each query uses credits based on complexity. From code generation to bug fixes.',
    capabilities: ['Code generation & refactoring', 'Automated testing', 'Bug detection & fixes', 'Credit-based usage']
  },
  {
    icon: CodeIcon,
    title: 'Automated Deployments',
    description: 'One-click deployments that build and deploy your applications. Credits cover the build process, container setup, and deployment orchestration.',
    capabilities: ['Build automation', 'Container orchestration', 'Zero-downtime deploys', 'Deployment credits']
  },
  {
    icon: GitHubLogoIcon,
    title: 'Git Integration',
    description: 'Deep GitHub integration for repository management, issue tracking, and collaborative development workflows.',
    capabilities: ['Repository cloning & sync', 'Branch management', 'Pull request automation', 'Issue tracking']
  },
  {
    icon: ChatBubbleIcon,
    title: 'Real-Time Collaboration',
    description: 'Interactive chat sessions with live code execution, streaming updates, and collaborative problem-solving.',
    capabilities: ['Live chat interface', 'Code streaming', 'Real-time updates', 'Session continuity']
  },
  {
    icon: CheckCircledIcon,
    title: 'Approval Workflows',
    description: 'Built-in approval system for critical operations with pause/resume capabilities and comprehensive audit trails.',
    capabilities: ['Tool use approvals', 'Multi-stage reviews', 'Audit logging', 'Compliance tracking']
  },
  {
    icon: LightningBoltIcon,
    title: 'Cloud Hosting',
    description: 'Host your applications with credits. Your services stay live as long as you have hosting credits. Scale up or down as needed.',
    capabilities: ['Managed hosting', 'Auto-scaling', 'SSL certificates', 'Hosting credits']
  },
  {
    icon: MixIcon,
    title: 'Multi-Framework Support',
    description: 'Support for multiple programming languages and frameworks with intelligent dependency management.',
    capabilities: ['React/Next.js', 'Python/FastAPI', 'Node.js/Express', 'Docker containers']
  },
  {
    icon: UpdateIcon,
    title: 'Continuous Integration',
    description: 'Automated testing, building, and deployment with comprehensive monitoring and rollback capabilities.',
    capabilities: ['Automated testing', 'Build pipelines', 'Deployment automation', 'Health monitoring']
  }
]

export function FeaturesSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="font-mono text-muted-foreground">{'<'}</span>
            <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Powerful Features
            </span>
            <span className="font-mono text-muted-foreground">{' />'}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-mono">
            // Everything you need to build, test, and deploy modern applications
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full terminal-bg border border-border hover:border-cyan-500/50 transition-all duration-300 group">
                <CardHeader>
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 group-hover:from-cyan-500/30 group-hover:to-purple-500/30 transition-colors">
                      <feature.icon className="h-6 w-6 text-cyan-400" />
                    </div>
                  </div>
                  <CardTitle className="text-lg font-mono text-cyan-400">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="space-y-2">
                    {feature.capabilities.map((capability, capIndex) => (
                      <div key={capIndex} className="flex items-center space-x-2 text-xs">
                        <CheckCircledIcon className="h-3 w-3 text-green-400 flex-shrink-0" />
                        <span className="text-muted-foreground font-mono">{capability}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="max-w-4xl mx-auto terminal-bg rounded-lg border border-border p-8">
            <h3 className="text-2xl font-mono font-bold mb-4">
              <span className="text-green-400">$</span>
              <span className="ml-2 text-cyan-400">npm install</span>
              <span className="ml-2 text-purple-400">@project-hub/cli</span>
            </h3>
            <p className="text-muted-foreground font-mono text-sm mb-6">
              // Get started in seconds with our command-line tool
            </p>
            <div className="bg-card/50 rounded border border-border p-4 font-mono text-sm text-left max-w-2xl mx-auto">
              <div className="text-green-400">
                <span>✓</span> <span className="text-muted-foreground ml-2">Project initialized</span>
              </div>
              <div className="text-green-400 mt-1">
                <span>✓</span> <span className="text-muted-foreground ml-2">Dependencies installed</span>
              </div>
              <div className="text-green-400 mt-1">
                <span>✓</span> <span className="text-muted-foreground ml-2">Development server started</span>
              </div>
              <div className="text-cyan-400 mt-2">
                <span>→</span> <span className="text-muted-foreground ml-2">Ready to build amazing things!</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}