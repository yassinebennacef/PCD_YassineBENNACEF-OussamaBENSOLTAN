import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../services/api'
import { useAuth } from './AuthContext'

const CompletedCtx = createContext({ completedIds: new Set(), toggleCompleted: async () => {} })

export function CompletedProvider({ children }) {
  const { user } = useAuth()
  const [completedIds, setCompletedIds] = useState(new Set())

  useEffect(() => {
    if (!user) { setCompletedIds(new Set()); return }
    authApi.activity()
      .then(r => {
        const ids = new Set((r.data.completed_list || []).map(x => x.id))
        setCompletedIds(ids)
      })
      .catch(() => {})
  }, [user])

  const toggleCompleted = async (resourceId) => {
    try {
      const { data } = await authApi.toggleComplete(resourceId)
      setCompletedIds(prev => {
        const next = new Set(prev)
        if (data.completed) next.add(resourceId)
        else next.delete(resourceId)
        return next
      })
      return data.completed
    } catch {
      return null
    }
  }

  return (
    <CompletedCtx.Provider value={{ completedIds, toggleCompleted }}>
      {children}
    </CompletedCtx.Provider>
  )
}

export const useCompleted = () => useContext(CompletedCtx)
