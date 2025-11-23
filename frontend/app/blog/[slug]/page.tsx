import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBlogPostBySlug, getRecentPosts, blogPosts } from '@/lib/blog-data'
import { siteConfig } from '@/lib/seo-config'
import { BlogPostSchema, BreadcrumbSchema } from '@/components/seo/structured-data'
import { CalendarDays, Clock, ArrowLeft, Share2, Twitter, Linkedin, Tag } from 'lucide-react'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    keywords: post.tags,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `${siteConfig.url}/blog/${post.slug}`,
      images: [
        {
          url: post.image || '/og-image.png',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [post.image || '/twitter-image.png'],
    },
  }
}

// Simple markdown-like renderer for blog content
function renderContent(content: string) {
  const lines = content.trim().split('\n')
  const elements: JSX.Element[] = []
  let currentList: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let inCodeBlock = false
  let codeContent: string[] = []
  let codeLanguage = ''
  let inTable = false
  let tableRows: string[][] = []

  const flushList = () => {
    if (currentList.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul'
      elements.push(
        <ListTag key={elements.length} className={`my-4 ${listType === 'ol' ? 'list-decimal' : 'list-disc'} list-inside space-y-2 text-gray-300`}>
          {currentList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ListTag>
      )
      currentList = []
      listType = null
    }
  }

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0]
      const bodyRows = tableRows.slice(2) // Skip header and separator
      elements.push(
        <div key={elements.length} className="my-6 overflow-x-auto">
          <table className="min-w-full border border-gray-700 rounded-lg">
            <thead className="bg-gray-800">
              <tr>
                {headerRow.map((cell, i) => (
                  <th key={i} className="px-4 py-2 text-left text-gray-300 font-semibold border-b border-gray-700">
                    {cell.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-800/50'}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2 text-gray-400 border-b border-gray-800">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
      inTable = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={elements.length} className="my-4 p-4 bg-gray-900 rounded-lg overflow-x-auto border border-gray-800">
            <code className="text-sm text-gray-300">{codeContent.join('\n')}</code>
          </pre>
        )
        codeContent = []
        inCodeBlock = false
      } else {
        flushList()
        flushTable()
        codeLanguage = line.slice(3)
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    // Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) {
        flushList()
        inTable = true
      }
      tableRows.push(line.split('|').filter(cell => cell !== ''))
      continue
    } else if (inTable) {
      flushTable()
    }

    // Headers
    if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={elements.length} className="text-3xl md:text-4xl font-bold text-white mt-8 mb-4">
          {line.slice(2)}
        </h1>
      )
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={elements.length} className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
          {line.slice(3)}
        </h2>
      )
      continue
    }
    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={elements.length} className="text-xl md:text-2xl font-semibold text-white mt-6 mb-3">
          {line.slice(4)}
        </h3>
      )
      continue
    }

    // Horizontal rule
    if (line.trim() === '---') {
      flushList()
      elements.push(<hr key={elements.length} className="my-8 border-gray-700" />)
      continue
    }

    // Lists
    if (line.match(/^- \*\*/)) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      const text = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      currentList.push(text)
      continue
    }
    if (line.startsWith('- ')) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      currentList.push(line.slice(2))
      continue
    }
    if (line.match(/^\d+\. /)) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      currentList.push(line.replace(/^\d+\. /, ''))
      continue
    }

    // Empty lines
    if (line.trim() === '') {
      flushList()
      continue
    }

    // Regular paragraphs
    flushList()
    const formattedLine = line
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-gray-800 rounded text-purple-400 text-sm">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-purple-400 hover:text-purple-300 underline">$1</a>')
      .replace(/❌/g, '<span class="text-red-400">❌</span>')
      .replace(/✅/g, '<span class="text-green-400">✅</span>')

    elements.push(
      <p
        key={elements.length}
        className="my-4 text-gray-300 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formattedLine }}
      />
    )
  }

  flushList()
  flushTable()

  return elements
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const recentPosts = getRecentPosts(3).filter((p) => p.slug !== slug)
  const shareUrl = `${siteConfig.url}/blog/${slug}`

  return (
    <>
      <BlogPostSchema
        title={post.title}
        description={post.description}
        publishedAt={post.publishedAt}
        modifiedAt={post.modifiedAt}
        author={post.author}
        image={post.image}
        slug={post.slug}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteConfig.url },
          { name: 'Blog', url: `${siteConfig.url}/blog` },
          { name: post.title, url: `${siteConfig.url}/blog/${post.slug}` },
        ]}
      />

      <article className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center text-gray-400 hover:text-purple-400 mb-8 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Blog
        </Link>

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
            <span className="text-purple-400 font-medium uppercase tracking-wider">
              {post.category}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            {post.title}
          </h1>

          <p className="text-xl text-gray-400 leading-relaxed mb-6">
            {post.description}
          </p>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                {post.author.charAt(0)}
              </div>
              <span className="text-gray-300 font-medium">{post.author}</span>
            </div>

            {/* Share buttons */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm mr-2">Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                aria-label="Share on Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(post.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                aria-label="Share on LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>
        </header>

        {/* Featured image placeholder */}
        <div className="relative h-64 md:h-96 mb-12 rounded-2xl bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex items-center justify-center">
          <div className="text-8xl opacity-30">
            {post.category === 'AI Development' && '🤖'}
            {post.category === 'Machine Learning' && '🧠'}
            {post.category === 'Developer Tools' && '🛠️'}
            {post.category === 'Best Practices' && '✨'}
            {post.category === 'Tutorials' && '📚'}
            {post.category === 'Industry News' && '📰'}
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none">
          {renderContent(post.content)}
        </div>

        {/* Tags */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex items-center flex-wrap gap-2">
            <Tag className="h-4 w-4 text-gray-500" />
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-sm bg-gray-800 text-gray-400 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Related Posts */}
        {recentPosts.length > 0 && (
          <section className="mt-16 pt-12 border-t border-gray-800">
            <h2 className="text-2xl font-bold text-white mb-8">Continue Reading</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {recentPosts.slice(0, 2).map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group p-6 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-purple-500/50 transition-all"
                >
                  <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                    {relatedPost.category}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
                    {relatedPost.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                    {relatedPost.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to Build with AI?
          </h2>
          <p className="text-gray-300 mb-6 max-w-xl mx-auto">
            Use credits for AI queries, deployments, and hosting. Build faster with Tediux.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Get Credits
          </Link>
        </section>
      </article>
    </>
  )
}
