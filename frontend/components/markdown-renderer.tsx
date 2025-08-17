'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  compact?: boolean
}

export function MarkdownRenderer({ content, className, compact = false }: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className={cn(
      compact 
        ? "prose prose-xs prose-invert max-w-none overflow-x-hidden break-words" 
        : "prose prose-sm prose-invert max-w-none overflow-x-hidden break-words", 
      className
    )}>
      <ReactMarkdown
        components={{
          // Code blocks with copy functionality
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const isInline = !className && children && !String(children).includes('\n')
            const code = String(children).replace(/\n$/, '')
            
            return !isInline && match ? (
              <div className="relative group my-4">
                <div className="absolute right-2 top-2 z-10">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(code)}
                    className="h-8 w-8 p-0 bg-black/30 hover:bg-black/50 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 border border-white/10 hover:border-white/20"
                  >
                    {copiedCode === code ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={language}
                  PreTag="div"
                  className="rounded-md border border-border !overflow-x-auto !overflow-y-auto !m-0 !max-h-[50vh]"
                  customStyle={{
                    margin: 0,
                    fontSize: compact ? '0.8rem' : '0.875rem',
                    lineHeight: compact ? '1.4' : '1.5',
                    padding: compact ? '0.75rem' : '1rem',
                    maxHeight: compact ? '30vh' : '50vh',
                    overflowY: 'auto',
                  }}
                  {...props}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code 
                className={cn(
                  "bg-muted px-1.5 py-0.5 rounded font-mono border border-border",
                  compact ? "text-xs" : "text-sm"
                )}
                {...props}
              >
                {children}
              </code>
            )
          },
          // Headers
          h1: ({ children }) => (
            <h1 className={cn(
              "font-bold text-foreground border-b border-border pb-2",
              compact ? "text-lg mt-3 mb-2" : "text-xl mt-4 mb-3"
            )}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn(
              "font-semibold text-foreground border-b border-border pb-1",
              compact ? "text-base mt-2 mb-1" : "text-lg mt-3 mb-2"
            )}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn(
              "font-semibold text-foreground",
              compact ? "text-sm mt-2 mb-1" : "text-base mt-3 mb-2"
            )}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={cn(
              "font-semibold text-foreground",
              compact ? "text-sm mt-2 mb-1" : "text-base mt-3 mb-2"
            )}>
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className={cn(
              "font-semibold text-foreground",
              compact ? "text-xs mt-1 mb-1" : "text-sm mt-2 mb-1"
            )}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className={cn(
              "font-semibold text-foreground",
              compact ? "text-xs mt-1 mb-0.5" : "text-xs mt-2 mb-1"
            )}>
              {children}
            </h6>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className={cn(
              "text-foreground leading-normal last:mb-0",
              compact ? "mb-2 text-sm" : "mb-3"
            )}>
              {children}
            </p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className={cn(
              "list-disc list-inside space-y-0.5 text-foreground pl-4",
              compact ? "mb-2 text-sm" : "mb-3"
            )}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={cn(
              "list-decimal list-inside space-y-0.5 text-foreground pl-4",
              compact ? "mb-2 text-sm" : "mb-3"
            )}>
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
            <div className={cn("overflow-x-auto", compact ? "mb-3" : "mb-4")}>
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
            <th className={cn(
              "text-left font-semibold text-foreground border-b border-border",
              compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm"
            )}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={cn(
              "text-foreground",
              compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm"
            )}>
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