import { TaskDetail } from '@/components/task-detail'

export default async function TaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>
}) {
  const { projectId, taskId } = await params
  return <TaskDetail projectId={projectId} taskId={taskId} />
}