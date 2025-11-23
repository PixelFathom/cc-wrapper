import { Metadata } from 'next'
import { generatePageMetadata, siteConfig } from '@/lib/seo-config'
import { BreadcrumbSchema } from '@/components/seo/structured-data'

export const metadata: Metadata = {
  ...generatePageMetadata('terms'),
  alternates: {
    canonical: '/terms',
  },
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteConfig.url },
          { name: 'Terms of Service', url: `${siteConfig.url}/terms` },
        ]}
      />
      {children}
    </>
  )
}
