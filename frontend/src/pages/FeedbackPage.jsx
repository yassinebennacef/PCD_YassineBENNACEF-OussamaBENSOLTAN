import { useEffect, useState } from 'react'
import { feedbackApi } from '../services/api'
import {
  CheckCircle, Loader2, ExternalLink, Clock, User,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_LABELS = {
  topic:       'Nouveau sujet',
  resource:    'Ressource externe',
  improvement: 'Amélioration',
}

function parseResourceName(title) {
  const match = title?.match(/^\[(.+?)\]/)
  return match ? match[1] : null
}

function parseActualText(title, description) {
  if (title?.startsWith('[')) {
    const afterBracket = title.replace(/^\[.+?\]\s*/, '')
    return afterBracket || description
  }
  return description || title
}

function SuggestionCard({ s, onReview }) {
  const resourceName = parseResourceName(s.title)
  const feedbackText = parseActualText(s.title, s.description)

  return (
    <div className={`bg-white rounded-xl border p-5 transition-colors ${
      s.is_reviewed ? 'border-gray-100 opacity-60' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">

          {/* Meta row */}
          <p className="eyebrow mb-2.5">
            {TYPE_LABELS[s.suggestion_type] || s.suggestion_type}
            {s.is_reviewed && <> · <span className="text-emerald-700">Traité</span></>}
          </p>

          {/* Resource reference */}
          {resourceName && (
            <p className="text-xs text-gray-500 italic mb-2">
              à propos de <span className="text-gray-900 font-semibold not-italic">{resourceName}</span>
            </p>
          )}

          {/* Feedback text */}
          {feedbackText && (
            <p className="text-[15px] text-gray-800 leading-relaxed mb-3 font-serif">
              "{feedbackText}"
            </p>
          )}

          {/* Page source */}
          {s.url && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs text-gray-400">Page :</span>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900 underline-offset-2 hover:underline truncate max-w-xs"
              >
                <ExternalLink size={11} />
                {(() => { try { return new URL(s.url).pathname } catch { return s.url } })()}
              </a>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <User size={11} /> {s.username}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={11} /> {new Date(s.created_at).toLocaleDateString('fr-TN', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Action button */}
        {!s.is_reviewed && (
          <button
            onClick={() => onReview(s.id)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            <CheckCircle size={13} /> Marquer comme traité
          </button>
        )}
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('pending')

  useEffect(() => {
    feedbackApi.suggestions()
      .then(r => {
        const d = r.data
        setSuggestions(Array.isArray(d) ? d : d.results || [])
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false))
  }, [])

  const handleReview = async (id) => {
    try {
      await feedbackApi.reviewSuggestion(id)
      setSuggestions(s => s.map(x => x.id === id ? { ...x, is_reviewed: true } : x))
      toast.success('Suggestion marquée comme traitée.')
    } catch {
      toast.error('Erreur lors de la mise à jour.')
    }
  }

  const pending  = suggestions.filter(s => !s.is_reviewed)
  const reviewed = suggestions.filter(s => s.is_reviewed)
  const displayed = activeTab === 'pending' ? pending : reviewed

  const tabs = [
    { key: 'pending',  label: 'En attente', count: pending.length  },
    { key: 'reviewed', label: 'Traitées',   count: reviewed.length },
  ]

  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <header>
        <p className="eyebrow mb-3">Modération</p>
        <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
          Feedbacks
        </h1>
        <p className="text-sm text-gray-500 mt-3 max-w-xl">
          Suggestions et signalements envoyés par les étudiants et enseignants.
        </p>
      </header>

      {/* Tabs — underline style */}
      <div className="flex gap-6 border-b border-gray-200">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`relative pb-3 text-sm transition-colors ${
              activeTab === key
                ? 'text-gray-900 font-semibold'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            {label}
            <span className="ml-2 text-xs text-gray-400 tabular-nums">({count})</span>
            {activeTab === key && (
              <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-gray-900" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-gray-400" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-12">
          <p className="font-serif text-2xl text-gray-700 mb-2">
            {activeTab === 'pending'
              ? 'Tout est en ordre.'
              : 'Rien dans les archives.'}
          </p>
          <p className="text-sm text-gray-500 max-w-md">
            {activeTab === 'pending'
              ? 'Aucune suggestion en attente. Les nouveaux retours apparaîtront ici.'
              : 'Les suggestions que vous traitez seront archivées ici.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(s => (
            <SuggestionCard key={s.id} s={s} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  )
}
