import { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/seo-config'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/p/',              // Private project pages
          '/profile/',        // Private profile pages
          '/account/',        // Private account pages
          '/payment/',        // Payment processing pages
          '/auth/',           // Auth callback pages
          '/_next/',          // Next.js internals
          '/admin/',          // Admin pages if any
        ],
      },
      {
        userAgent: 'GPTBot',
        allow: [
          '/',
          '/blog/',
          '/pricing',
          '/contact',
        ],
        disallow: [
          '/api/',
          '/p/',
          '/profile/',
          '/account/',
        ],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: [
          '/',
          '/blog/',
          '/pricing',
          '/contact',
        ],
      },
      {
        userAgent: 'Google-Extended',
        allow: [
          '/',
          '/blog/',
        ],
      },
      {
        userAgent: 'Anthropic-AI',
        allow: [
          '/',
          '/blog/',
          '/pricing',
          '/contact',
        ],
      },
      {
        userAgent: 'Claude-Web',
        allow: [
          '/',
          '/blog/',
          '/pricing',
          '/contact',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
