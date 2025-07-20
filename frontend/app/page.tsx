import { Hero } from '@/components/hero'
import { ProjectList } from '@/components/project-list'

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="container mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="terminal-bg rounded-lg border border-border p-6 mb-8">
              <div className="font-mono">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-green-400">➜</span>
                  <span className="text-cyan-500">ls</span>
                  <span className="text-muted-foreground">-la</span>
                  <span className="text-purple-400">~/projects</span>
                </div>
                <div className="text-muted-foreground text-sm">
                  <span>total {Math.floor(Math.random() * 100) + 20}</span>
                  <br />
                  <span>drwxr-xr-x  12 dev  staff  384 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  <span className="text-cyan-500 ml-1">.</span>
                </div>
              </div>
            </div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold font-mono mb-2">
                <span className="text-muted-foreground">{'<'}</span>
                <span className="text-cyan-500">Active</span>
                <span className="text-purple-400">Repositories</span>
                <span className="text-muted-foreground">{' />'}</span>
              </h2>
              <p className="text-muted-foreground font-mono text-sm">
                // Track your code projects with git-powered workflows
              </p>
            </div>
          </div>
        </div>
        <ProjectList />
      </section>
    </>
  )
}