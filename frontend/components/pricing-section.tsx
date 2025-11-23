'use client'

import { motion } from 'framer-motion'
import { CheckCircledIcon } from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface PricingPlan {
  id: string
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  is_popular: boolean
  sort_order: number
}

export function PricingSection() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPricingPlans = async () => {
      try {
        setLoading(true)
        const response = await api.getPricingPlans()
        setPlans(response.plans.sort((a, b) => a.sort_order - b.sort_order))
        setError(null)
      } catch (err) {
        console.error('Failed to fetch pricing plans:', err)
        setError('Unable to load pricing plans')
        setPlans([])
      } finally {
        setLoading(false)
      }
    }

    fetchPricingPlans()
  }, [])

  return (
    <section className="py-20 px-4 sm:px-6 border-t border-border/30">
      <div className="container mx-auto max-w-6xl">
        {/* Terminal Header */}
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
              <span className="text-xs font-mono text-muted-foreground ml-2">~/pricing</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-400 ml-2">tediux</span>
              <span className="text-muted-foreground ml-2">plans --list</span>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400 mt-4 font-mono">
              // {error}
            </p>
          )}
        </motion.div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-80 bg-card/30 rounded-lg border border-border/50" />
              </div>
            ))}
          </div>
        ) : (
          /* Pricing Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative ${plan.is_popular ? '-mt-2 mb-2' : ''}`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500 text-black">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`h-full flex flex-col rounded-lg border bg-card/50 transition-all duration-200 ${
                  plan.is_popular
                    ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                    : 'border-border/50 hover:border-cyan-500/30'
                }`}>
                  {/* Header */}
                  <div className={`px-5 py-5 border-b ${plan.is_popular ? 'border-cyan-500/30' : 'border-border/30'}`}>
                    <div className="font-mono text-cyan-400 mb-2">{plan.name}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>

                  {/* Features */}
                  <div className="flex-1 px-5 py-5">
                    <div className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircledIcon className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-5 pb-5">
                    <Link href="/pricing">
                      <Button
                        className={`w-full ${
                          plan.is_popular
                            ? 'bg-cyan-500 hover:bg-cyan-600 text-black'
                            : 'bg-transparent border border-border hover:border-cyan-500/50 hover:bg-cyan-500/10 text-foreground'
                        }`}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Bottom Status */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <CheckCircledIcon className="h-4 w-4 text-green-500" />
            <span>{plans.length} plans available</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
