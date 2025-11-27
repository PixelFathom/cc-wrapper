/**
 * Task Breakdown API Client
 * 
 * Handles API calls for task breakdown functionality
 */

import { api } from '../api'

export interface SubTaskInfo {
  sequence: number
  title: string
  description: string
  prompt?: string
  testing_requirements?: string
  session_id: string | null
  next_session_id?: string | null  // Link to next task in sequence
  chat_id?: string | null
  next_chat_id?: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  started_at?: string
  completed_at?: string
  result_summary?: string
}

export interface BreakdownAnalysis {
  is_breakdown: boolean
  total_sub_tasks: number
  reasoning: string
  sub_tasks: Array<{
    sequence: number
    title: string
    description: string
  }>
}

export interface BreakdownStatus {
  parent_session_id: string
  total_sub_tasks: number
  completed_sub_tasks: number
  current_sub_task: number
  sub_task_sessions: SubTaskInfo[]
  reasoning: string
}

export interface ChatMessage {
  id: string
  role: string
  content: any
  created_at: string
  session_id: string
  parent_session_id?: string
}

export interface BreakdownGroup {
  parent_session_id: string
  parent_messages: ChatMessage[]
  child_sessions: Array<{
    session_id: string
    messages: ChatMessage[]
  }>
}

/**
 * Get all sessions in a breakdown group (parent + children)
 */
export async function getBreakdownGroup(sessionId: string): Promise<BreakdownGroup> {
  return api.request<BreakdownGroup>(`/sessions/${sessionId}/breakdown-group`)
}

/**
 * Get breakdown progress and status
 */
export async function getBreakdownStatus(sessionId: string): Promise<BreakdownStatus> {
  return api.request<BreakdownStatus>(`/sessions/${sessionId}/breakdown-status`)
}

/**
 * Start the first sub-task of a breakdown
 */
export async function startFirstSubTask(parentSessionId: string): Promise<{
  message: string
  sub_task_session_id: string
  sequence: number
  title: string
}> {
  return api.request<{
    message: string
    sub_task_session_id: string
    sequence: number
    title: string
  }>(`/sessions/${parentSessionId}/start-first-subtask`, {
    method: 'POST'
  })
}

/**
 * Retry a failed sub-task
 */
export async function retrySubTask(parentSessionId: string, sessionId: string): Promise<{
  message: string
  task_id: string
  session_id: string
}> {
  return api.request<{
    message: string
    task_id: string
    session_id: string
  }>(`/sessions/${parentSessionId}/retry-subtask/${sessionId}`, {
    method: 'POST'
  })
}

/**
 * Retry a failed chat message
 */
export async function retryChat(chatId: string): Promise<{
  message: string
  task_id: string
}> {
  return api.request<{
    message: string
    task_id: string
  }>(`/chats/${chatId}/retry`, {
    method: 'POST'
  })
}

