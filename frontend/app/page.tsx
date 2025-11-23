import { Hero } from '@/components/hero'
import { DashboardTabs } from '@/components/dashboard-tabs'
import { FeaturesSection } from '@/components/features-section'
import { BenefitsSection } from '@/components/benefits-section'
import { PricingSection } from '@/components/pricing-section'

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturesSection />
      <BenefitsSection />
      <DashboardTabs />
      <PricingSection />
    </>
  )
}