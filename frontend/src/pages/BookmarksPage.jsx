import { useEffect, useState } from 'react'
import { authApi, resourcesApi } from '../services/api'
import ResourceCard from '../components/Common/ResourceCard'
import { Loader2 } from 'lucide-react'

export default function BookmarksPage() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.bookmarks().then(async res => {
      const list = Array.isArray(res.data) ? res.data : res.data.results || []
      const ids = list.map(p => p.resource_id).filter(Boolean)
      if (!ids.length) return
      const details = await Promise.all(ids.map(id => resourcesApi.detail(id).catch(() => null)))
      setResources(details.filter(Boolean).map(r => r.data))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={22} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="space-y-8 max-w-6xl">
      <header>
        <p className="eyebrow mb-3">Bibliothèque</p>
        <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
          Mes favoris
        </h1>
        <p className="text-[15px] text-gray-500 mt-3 max-w-xl">
          Les ressources que vous avez mises de côté pour plus tard.
        </p>
      </header>

      {resources.length === 0 ? (
        <div className="border-t border-gray-200 pt-10">
          <p className="font-serif text-2xl text-gray-700 mb-2">Rien ici, pour le moment.</p>
          <p className="text-sm text-gray-500 max-w-md">
            Ouvrez une ressource et cliquez sur l'icône signet pour la conserver à portée de main.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {resources.map(r => <ResourceCard key={r.id} resource={r} />)}
        </div>
      )}
    </div>
  )
}

