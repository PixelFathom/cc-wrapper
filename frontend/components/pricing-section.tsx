'use client'

import { motion } from 'framer-motion'
import { CheckCircledIcon, StarIcon } from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

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
        setError('Unable to load pricing plans. Please try again later.')
        setPlans([])
      } finally {
        setLoading(false)
      }
    }

    fetchPricingPlans()
  }, [])

  return (
    <section className="py-24 px-4 sm:px-6 bg-background">
      <div className="container mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="font-mono text-muted-foreground">{'<'}</span>
            <span className="bg-gradient-to-r from-green-400 via-cyan-500 to-purple-500 bg-clip-text text-transparent">
              Simple Pricing
            </span>
            <span className="font-mono text-muted-foreground">{' />'}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-mono">
            // Choose the plan that scales with your development needs
          </p>
          {error && (
            <p className="text-sm text-red-400 mt-2 font-mono">
              // {error}
            </p>
          )}
        </motion.div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20 max-w-4xl mx-auto">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <Card className="h-full terminal-bg border border-border">
                  <CardHeader className="text-center">
                    <div className="h-6 bg-muted rounded w-24 mx-auto mb-4"></div>
                    <div className="h-8 bg-muted rounded w-32 mx-auto mb-2"></div>
                    <div className="h-4 bg-muted rounded w-48 mx-auto"></div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-10 bg-muted rounded w-full"></div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="flex items-center space-x-3">
                          <div className="h-4 w-4 bg-muted rounded-full flex-shrink-0"></div>
                          <div className="h-4 bg-muted rounded flex-1"></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          /* Pricing Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
              className={`relative ${plan.is_popular ? 'scale-105' : ''}`}
            >
              {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-mono">
                    <StarIcon className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <Card className={`h-full terminal-bg border-2 ${plan.is_popular
                ? 'border-gradient-to-r from-cyan-500 to-purple-500 glow-cyan'
                : 'border-border hover:border-cyan-500/50'} transition-all duration-300`}>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-mono text-cyan-400 mb-2">
                    {plan.name}
                  </CardTitle>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-muted-foreground ml-2 font-mono">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <Button
                    className={`w-full font-mono ${plan.is_popular
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white'
                      : 'bg-card hover:bg-card/80 text-cyan-400 border border-cyan-500/50 hover:border-cyan-500'
                    }`}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>

                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div
                        key={featureIndex}
                        className="flex items-center space-x-3"
                      >
                        <CheckCircledIcon className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm font-mono text-white">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          </div>
        )}
      </div>
    </section>
  )
}