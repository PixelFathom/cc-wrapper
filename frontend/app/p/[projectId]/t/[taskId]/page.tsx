import { TaskDetail } from '@/components/task-detail'

export default function TaskPage({
  params,
}: {
  params: { projectId: string; taskId: string }
}) {
  return <TaskDetail projectId={params.projectId} taskId={params.taskId} />
}