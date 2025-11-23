'use client'

import { motion } from 'framer-motion'
import {
  LightningBoltIcon,
  CheckCircledIcon,
  PersonIcon
} from '@radix-ui/react-icons'
import { Card, CardContent } from './ui/card'

const benefits = [
  {
    icon: LightningBoltIcon,
    title: 'Ship 10x Faster',
    description: 'From idea to production in minutes, not weeks',
    stats: '90% faster development',
    details: [
      'AI-powered code generation reduces boilerplate by 80%',
      'Automated testing catches bugs before deployment',
      'One-click deployment to multiple environments',
      'Intelligent dependency management prevents conflicts'
    ]
  },
  {
    icon: CheckCircledIcon,
    title: 'Zero Configuration',
    description: 'Start building immediately without setup overhead',
    stats: '0 minutes setup time',
    details: [
      'Pre-configured development environments',
      'Automatic project scaffolding for any framework',
      'Built-in best practices and security standards',
      'Intelligent defaults that scale with your needs'
    ]
  },
  {
    icon: PersonIcon,
    title: 'Team Collaboration',
    description: 'Built for modern development teams',
    stats: '5x better collaboration',
    details: [
      'Real-time code sharing and pair programming',
      'Centralized project knowledge and documentation',
      'Approval workflows for critical operations',
      'Integrated communication and review tools'
    ]
  }
]


export function BenefitsSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-muted/20">
      <div className="container mx-auto">
        {/* Main Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="font-mono text-muted-foreground">{'<'}</span>
            <span className="bg-gradient-to-r from-orange-400 via-red-500 to-purple-500 bg-clip-text text-transparent">
              Why Developers Love Us
            </span>
            <span className="font-mono text-muted-foreground">{' />'}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-mono">
            // Focus on building great products, not wrestling with tooling
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-24">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="h-full terminal-bg border border-border hover:border-orange-500/50 transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 group-hover:from-orange-500/30 group-hover:to-red-500/30 transition-colors">
                      <benefit.icon className="h-8 w-8 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-mono font-bold text-orange-400">
                        {benefit.title}
                      </h3>
                      <p className="text-sm font-mono text-green-400">{benefit.stats}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-6">{benefit.description}</p>
                  <div className="space-y-3">
                    {benefit.details.map((detail, detailIndex) => (
                      <div key={detailIndex} className="flex items-start space-x-3">
                        <CheckCircledIcon className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{detail}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}