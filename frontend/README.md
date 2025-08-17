# Frontend Application

Next.js frontend for the project management tool.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp ../.env.example ../.env
```

3. Start the development server:
```bash
npm run dev
```

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm test
npm run test:e2e
```

## Project Structure

```
frontend/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── ui/          # Base UI components
│   └── ...          # Feature components
├── lib/             # Utilities and API client
├── public/          # Static assets
└── styles/          # Global styles
```

## Key Features

- **Server-side rendering** with Next.js App Router
- **Type-safe API calls** with TypeScript
- **Real-time updates** via EventSource API
- **Responsive design** with Tailwind CSS
- **Component library** with shadcn/ui
- **State management** with TanStack Query

## Component Architecture

### Core Components

- `ProjectList`: Displays grid of project cards
- `ProjectCard`: Individual project display
- `TaskList`: List of tasks within a project
- `SubProjectChat`: Live chat interface
- `UploadZone`: Drag-and-drop file upload
- `ApprovalModal`: Approval request handling

### UI Components

Based on shadcn/ui with customizations:
- Button, Card, Dialog, Input, Label
- Skeleton for loading states
- Toast for notifications

## Performance Optimizations

- Lazy loading with dynamic imports
- Image optimization with Next.js Image
- API response caching with TanStack Query
- Optimistic UI updates
- Debounced search inputs

## Lighthouse Targets

- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: ≥90