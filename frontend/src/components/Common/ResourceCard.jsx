import { Link } from 'react-router-dom'
import { Star, CheckCircle2, Circle } from 'lucide-react'
import { useCompleted } from '../../context/CompletedContext'
import { useBookmarked } from '../../context/BookmarkedContext'
import toast from 'react-hot-toast'

const FORMAT_LABELS = {
  pdf:   'PDF',
  video: 'Vidéo',
  audio: 'Audio',
  html:  'Web',
  zip:   'Archive',
  other: 'Autre',
}

const LEVEL_LABELS = {
  beginner:     'Débutant',
  intermediate: 'Intermédiaire',
  advanced:     'Avancé',
}

export default function ResourceCard({ resource }) {
  const { completedIds, toggleCompleted }   = useCompleted()
  const { bookmarkedIds, toggleBookmarked } = useBookmarked()
  const done       = completedIds.has(resource.id)
  const bookmarked = bookmarkedIds.has(resource.id)

  const fmtLabel    = FORMAT_LABELS[resource.format] || FORMAT_LABELS.other
  const levelLabel  = LEVEL_LABELS[resource.level]
  const rating      = resource.average_rating
  const ratingCount = resource.rating_count ?? 0
  const initial     = (resource.title || '?').trim().charAt(0).toUpperCase()

  const handlePin = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const result = await toggleCompleted(resource.id)
    if (result === true)  toast.success('Marqué comme complété !')
    if (result === false) toast('Retiré des complétés.')
  }

  const handleStar = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const result = await toggleBookmarked(resource.id)
    if (result === true)  toast.success('Ajouté aux favoris !')
    if (result === false) toast('Retiré des favoris.')
  }

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 transition-colors duration-200 hover:border-gray-400">

      {/* Star / bookmark — top-right corner, outside Link */}
      <button
        onClick={handleStar}
        title={bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className="absolute top-3 right-3 z-10 p-1 rounded-md bg-white/80 backdrop-blur-sm transition-colors hover:bg-white"
      >
        <Star
          size={15}
          className={bookmarked ? 'fill-amber-400 text-amber-400' : 'text-gray-400 hover:text-amber-400'}
        />
      </button>

      <Link to={`/resources/${resource.id}`} className="block rounded-xl">
        {/* Thumbnail */}
        <div className="relative w-full h-[140px] bg-[#f4f3ef] flex items-center justify-center overflow-hidden rounded-t-xl border-b border-gray-100">
          {resource.thumbnail ? (
            <img src={resource.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-serif text-[64px] leading-none text-gray-300 select-none -mt-1">
              {initial}
            </span>
          )}
          {/* Format badge — top-left */}
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.15em] font-semibold text-gray-700 bg-white/90 px-1.5 py-0.5 rounded">
            {fmtLabel}
          </span>
          {/* Rating badge — bottom-right (moved from top-right to avoid star overlap) */}
          {rating > 0 && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold bg-white/90 text-gray-800 px-1.5 py-0.5 rounded">
              <Star size={9} className="fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 pb-10">
          <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.12em] text-gray-500 font-semibold">
            {levelLabel && <span>{levelLabel}</span>}
            {levelLabel && resource.category_name && <span className="text-gray-300">·</span>}
            {resource.category_name && (
              <span className="truncate normal-case tracking-normal text-[11px] font-medium text-gray-500">
                {resource.category_name}
              </span>
            )}
          </div>

          <h3 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-2 group-hover:text-gray-700 transition-colors">
            {resource.title}
          </h3>

          {resource.description && (
            <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed mb-3">
              {resource.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
            <span>
              {resource.view_count ?? 0} vues
              {ratingCount > 0 && <> · {ratingCount} avis</>}
            </span>
            <span className="truncate max-w-[100px] text-right text-gray-500">
              {resource.uploaded_by_name}
            </span>
          </div>
        </div>
      </Link>

      {/* Complete pin — bottom-left, outside Link */}
      <button
        onClick={handlePin}
        title={done ? 'Retirer des complétés' : 'Marquer comme complété'}
        className={`absolute bottom-3 left-4 z-10 flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
          done ? 'text-emerald-600 hover:text-emerald-700' : 'text-gray-400 hover:text-gray-700'
        }`}
      >
        {done ? <CheckCircle2 size={15} className="shrink-0" /> : <Circle size={15} className="shrink-0" />}
        <span>{done ? 'Complété' : 'Marquer complété'}</span>
      </button>

    </div>
  )
}
