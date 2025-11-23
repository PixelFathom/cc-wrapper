import { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts, blogCategories, getFeaturedPosts, getRecentPosts } from '@/lib/blog-data'
import { generatePageMetadata } from '@/lib/seo-config'
import { BreadcrumbSchema } from '@/components/seo/structured-data'
import { siteConfig } from '@/lib/seo-config'
import { CalendarDays, Clock, ArrowRight, Tag } from 'lucide-react'

export const metadata: Metadata = {
  ...generatePageMetadata('blog'),
  alternates: {
    canonical: '/blog',
  },
}

function BlogCard({ post, featured = false }: { post: typeof blogPosts[0], featured?: boolean }) {
  return (
    <article className={`group relative rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden hover:border-purple-500/50 transition-all duration-300 ${featured ? 'md:col-span-2 md:row-span-2' : ''}`}>
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className={`relative ${featured ? 'h-64 md:h-80' : 'h-48'} bg-gradient-to-br from-purple-900/30 to-blue-900/30`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl opacity-20">
              {post.category === 'AI Development' && '🤖'}
              {post.category === 'Machine Learning' && '🧠'}
              {post.category === 'Developer Tools' && '🛠️'}
              {post.category === 'Best Practices' && '✨'}
              {post.category === 'Tutorials' && '📚'}
              {post.category === 'Industry News' && '📰'}
            </div>
          </div>
          {featured && (
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 text-xs font-semibold bg-purple-600 text-white rounded-full">
                Featured
              </span>
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
            {post.category}
          </span>
          <h2 className={`mt-2 font-bold text-white group-hover:text-purple-400 transition-colors ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
            {post.title}
          </h2>
          <p className={`mt-3 text-gray-400 ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>
            {post.description}
          </p>
          <div className="mt-4 flex items-center text-purple-400 font-medium group-hover:gap-2 transition-all">
            Read more <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </div>
      </Link>
    </article>
  )
}

export default function BlogPage() {
  const featuredPosts = getFeaturedPosts()
  const recentPosts = getRecentPosts(10)

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteConfig.url },
          { name: 'Blog', url: `${siteConfig.url}/blog` },
        ]}
      />

      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Tediux Blog
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Insights, tutorials, and updates about AI in software development.
            Learn how AI is transforming the way we build software.
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {blogCategories.map((category) => (
            <span
              key={category.slug}
              className="px-4 py-2 rounded-full text-sm font-medium bg-gray-800 text-gray-300 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
            >
              {category.name}
            </span>
          ))}
        </div>

        {/* Featured Posts */}
        {featuredPosts.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-8">Featured Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredPosts.map((post, index) => (
                <BlogCard key={post.slug} post={post} featured={index === 0} />
              ))}
            </div>
          </section>
        )}

        {/* All Posts */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-8">Latest Articles</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="mt-16 p-8 md:p-12 rounded-2xl bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Start Building with AI Today
            </h2>
            <p className="text-gray-300 mb-6">
              Use credits for AI queries, deployments, and hosting. No subscriptions, just simple credit-based pricing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                type="email"
                placeholder="Enter your email"
                className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 min-w-[300px]"
              />
              <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
