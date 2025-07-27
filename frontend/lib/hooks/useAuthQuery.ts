import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

// Hook for authenticated queries
export function useAuthQuery<TData = unknown, TError = unknown>(
  queryKey: any[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  const { user } = useAuth()
  const router = useRouter()

  return useQuery<TData, TError>({
    queryKey,
    queryFn: async () => {
      if (!user) {
        router.push('/login')
        throw new Error('Not authenticated')
      }
      return queryFn()
    },
    enabled: !!user && (options?.enabled !== false),
    ...options
  })
}

// Hook for authenticated mutations
export function useAuthMutation<TData = unknown, TError = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables>
) {
  const { user } = useAuth()
  const router = useRouter()

  return useMutation<TData, TError, TVariables>({
    mutationFn: async (variables) => {
      if (!user) {
        router.push('/login')
        throw new Error('Not authenticated')
      }
      return mutationFn(variables)
    },
    ...options
  })
}