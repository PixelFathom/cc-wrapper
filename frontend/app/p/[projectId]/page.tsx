import { ProjectDetail } from '@/components/project-detail'

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return <ProjectDetail projectId={params.projectId} />
}