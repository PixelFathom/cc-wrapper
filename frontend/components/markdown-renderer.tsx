'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          // Code blocks
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                className="rounded-md border border-border"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code 
                className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono border border-border"
                {...props}
              >
                {children}
              </code>
            )
          },
          // Headers
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-4 border-b border-border pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-foreground mt-5 mb-3 border-b border-border pb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mt-3 mb-2">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-foreground mt-2 mb-1">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold text-foreground mt-2 mb-1">
              {children}
            </h6>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="text-foreground leading-relaxed mb-4 last:mb-0">
              {children}
            </p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-4 text-foreground pl-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-4 text-foreground pl-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground">
              {children}
            </li>
          ),
          // Links
          a: ({ href, children }) => (
            <a 
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500 pl-4 py-2 my-4 bg-muted/20 rounded-r">
              <div className="text-muted-foreground italic">
                {children}
              </div>
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-foreground">
              {children}
            </td>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="border-border my-6" />
          ),
          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">
              {children}
            </strong>
          ),
          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-foreground">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}