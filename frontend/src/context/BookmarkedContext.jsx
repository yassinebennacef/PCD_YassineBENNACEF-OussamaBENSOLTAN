import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../services/api'
import { useAuth } from './AuthContext'

const BookmarkedCtx = createContext({ bookmarkedIds: new Set(), toggleBookmarked: async () => {} })

export function BookmarkedProvider({ children }) {
  const { user } = useAuth()
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set())

  useEffect(() => {
    if (!user) { setBookmarkedIds(new Set()); return }
    authApi.bookmarks()
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data.results ?? []
        setBookmarkedIds(new Set(list.map(p => p.resource_id).filter(Boolean)))
      })
      .catch(() => {})
  }, [user])

  const toggleBookmarked = async (resourceId) => {
    try {
      const { data } = await authApi.toggleBookmark(resourceId)
      setBookmarkedIds(prev => {
        const next = new Set(prev)
        if (data.bookmarked) next.add(resourceId)
        else next.delete(resourceId)
        return next
      })
      return data.bookmarked
    } catch {
      return null
    }
  }

  return (
    <BookmarkedCtx.Provider value={{ bookmarkedIds, toggleBookmarked }}>
      {children}
    </BookmarkedCtx.Provider>
  )
}

export const useBookmarked = () => useContext(BookmarkedCtx)
