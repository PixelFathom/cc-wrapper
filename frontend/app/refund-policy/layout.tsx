import { Metadata } from 'next'
import { generatePageMetadata, siteConfig } from '@/lib/seo-config'
import { BreadcrumbSchema } from '@/components/seo/structured-data'

export const metadata: Metadata = {
  ...generatePageMetadata('refundPolicy'),
  alternates: {
    canonical: '/refund-policy',
  },
}

export default function RefundPolicyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteConfig.url },
          { name: 'Refund Policy', url: `${siteConfig.url}/refund-policy` },
        ]}
      />
      {children}
    </>
  )
}
