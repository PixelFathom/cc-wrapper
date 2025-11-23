import { Metadata } from 'next'
import { generatePageMetadata, siteConfig } from '@/lib/seo-config'
import { BreadcrumbSchema, FAQSchema } from '@/components/seo/structured-data'

export const metadata: Metadata = {
  ...generatePageMetadata('pricing'),
  alternates: {
    canonical: '/pricing',
  },
}

const pricingFAQs = [
  {
    question: 'How does the credit system work?',
    answer: 'Credits are used for three main activities: AI queries (chat interactions with AI agents), deployments (automated build and deploy operations), and hosting (keeping your projects live). Credits are valid for 30 days from purchase.',
  },
  {
    question: 'What consumes credits?',
    answer: 'Credits are consumed when you: send AI queries to build or update your project, deploy your application to the cloud, and host your services. Each action has a specific credit cost based on resource usage.',
  },
  {
    question: 'Can I get a refund if I\'m not satisfied?',
    answer: 'Yes, we offer a 7-day money-back guarantee for all credit purchases. Contact our support team within 7 days of purchase for a full refund of unused credits.',
  },
  {
    question: 'What happens when my credits expire?',
    answer: 'When your credits expire after 30 days, your account downgrades to the free tier. Your hosted projects may be paused. Purchase more credits anytime to restore full access and hosting.',
  },
  {
    question: 'Can I stack multiple credit packages?',
    answer: 'Yes! You can purchase multiple packages. Credits stack together, and each package has its own 30-day validity period.',
  },
]

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteConfig.url },
          { name: 'Pricing', url: `${siteConfig.url}/pricing` },
        ]}
      />
      <FAQSchema faqs={pricingFAQs} />
      {children}
    </>
  )
}
