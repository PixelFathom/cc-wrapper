// SEO Configuration for Tediux
export const siteConfig = {
  name: 'Tediux',
  description: 'AI-Powered Development Platform - Build, deploy, and host your projects with intelligent AI agents. Use credits for AI queries, automated deployments, and cloud hosting services.',
  shortDescription: 'AI-powered queries, deployments, and hosting with a simple credit system',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://tediux.com',
  ogImage: '/og-image.png',
  twitterImage: '/twitter-image.png',
  creator: '@tediux',
  keywords: [
    'AI development platform',
    'AI coding assistant',
    'automated code generation',
    'AI pair programming',
    'intelligent development tools',
    'code automation',
    'AI-powered IDE',
    'automated testing',
    'CI/CD automation',
    'developer productivity',
    'AI agents',
    'code review AI',
    'smart deployment',
    'cloud hosting',
    'credit-based pricing',
    'AI queries',
    'automated deployment',
    'project hosting',
    'collaborative development'
  ],
  authors: [{ name: 'Tediux Team', url: 'https://tediux.com' }],
  links: {
    twitter: 'https://twitter.com/tediux',
    github: 'https://github.com/tediux',
    linkedin: 'https://linkedin.com/company/tediux'
  }
}

export const defaultMetadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} - AI-Powered Development Platform`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: siteConfig.authors,
  creator: siteConfig.creator,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} - AI-Powered Development Platform`,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - AI-Powered Development Platform`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} - AI-Powered Development Platform`,
    description: siteConfig.description,
    images: [siteConfig.twitterImage],
    creator: siteConfig.creator,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification tokens here
    // google: 'your-google-verification-token',
    // yandex: 'your-yandex-verification-token',
    // bing: 'your-bing-verification-token',
  },
  alternates: {
    canonical: siteConfig.url,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

// Page-specific metadata configurations
export const pageMetadata = {
  home: {
    title: 'AI-Powered Development Platform',
    description: 'Transform your development workflow with AI agents. Use credits for AI queries, automated deployments, and cloud hosting. Build faster and deploy smarter with Tediux.',
  },
  pricing: {
    title: 'Pricing - Credits for AI Queries, Deployments & Hosting',
    description: 'Simple credit-based pricing. Use credits for AI-powered queries, automated deployments, and project hosting. Buy once, use for 30 days.',
  },
  contact: {
    title: 'Contact Us',
    description: 'Get in touch with the Tediux team. We\'re here to help you get started with AI-powered development and answer any questions.',
  },
  terms: {
    title: 'Terms of Service',
    description: 'Read our terms of service to understand your rights and responsibilities when using Tediux AI development platform.',
  },
  refundPolicy: {
    title: 'Refund Policy',
    description: 'Our refund and cancellation policy. Learn about our fair refund process for unused credits and subscriptions.',
  },
  profile: {
    title: 'Your Profile',
    description: 'Manage your Tediux profile, settings, and preferences.',
  },
  blog: {
    title: 'Blog',
    description: 'Insights, tutorials, and updates about AI in software development. Learn how AI is transforming the way we build software.',
  },
}

// Helper function to generate metadata for pages
export function generatePageMetadata(
  page: keyof typeof pageMetadata,
  overrides?: Record<string, unknown>
) {
  const pageConfig = pageMetadata[page]
  return {
    title: pageConfig.title,
    description: pageConfig.description,
    openGraph: {
      title: `${pageConfig.title} | ${siteConfig.name}`,
      description: pageConfig.description,
    },
    twitter: {
      title: `${pageConfig.title} | ${siteConfig.name}`,
      description: pageConfig.description,
    },
    ...overrides,
  }
}
