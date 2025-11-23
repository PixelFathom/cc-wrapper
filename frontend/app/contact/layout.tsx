import { Metadata } from 'next'
import { generatePageMetadata, siteConfig } from '@/lib/seo-config'
import { BreadcrumbSchema } from '@/components/seo/structured-data'

export const metadata: Metadata = {
  ...generatePageMetadata('contact'),
  alternates: {
    canonical: '/contact',
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteConfig.url },
          { name: 'Contact', url: `${siteConfig.url}/contact` },
        ]}
      />
      {children}
    </>
  )
}
