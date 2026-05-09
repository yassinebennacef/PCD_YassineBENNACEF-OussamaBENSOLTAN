import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { resourcesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ResourceCard from '../components/Common/ResourceCard'
import { useDebounce } from '../hooks/useDebounce'
import {
  Search, Filter, X, Loader2, SlidersHorizontal,
  FileText, Video, Music, Globe, Archive, Image as ImageIcon,
  File, Folder, Tag, ArrowRight, Sparkles,
} from 'lucide-react'

const LEVELS    = [{ v: '', l: 'Tous les niveaux' }, { v: 'beginner', l: 'Débutant' }, { v: 'intermediate', l: 'Intermédiaire' }, { v: 'advanced', l: 'Avancé' }]
const FORMATS   = [{ v: '', l: 'Tous les formats' }, { v: 'pdf', l: 'PDF' }, { v: 'video', l: 'Vidéo' }, { v: 'audio', l: 'Audio' }, { v: 'html', l: 'Web' }, { v: 'zip', l: 'Archive' }]
const LANGUAGES = [{ v: '', l: 'Toutes les langues' }, { v: 'fr', l: 'Français' }, { v: 'ar', l: 'Arabe' }, { v: 'en', l: 'Anglais' }]
const SORTS     = [{ v: '-created_at', l: 'Récents' }, { v: '-view_count', l: 'Populaires' }, { v: '-average_rating', l: 'Mieux notés' }, { v: 'title', l: 'Alphabétique' }]

const FORMAT_LABELS = { pdf: 'PDF', video: 'Vidéo', audio: 'Audio', html: 'Web', zip: 'Archive', image: 'Image', other: 'Autre' }
const LEVEL_LABELS  = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }
const FORMAT_ICONS  = {
  pdf:   <FileText  size={14} className="text-red-400" />,
  video: <Video     size={14} className="text-blue-400" />,
  audio: <Music     size={14} className="text-purple-400" />,
  html:  <Globe     size={14} className="text-green-500" />,
  zip:   <Archive   size={14} className="text-yellow-500" />,
  image: <ImageIcon size={14} className="text-pink-400" />,
  other: <File      size={14} className="text-gray-400" />,
}

// ── Highlight the matched substring in bold ──────────────────────────────────
function HighlightedText({ text, query }) {
  if (!query) return <span className="text-sm text-gray-900 truncate">{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span className="text-sm text-gray-900 truncate">{text}</span>
  return (
    <span className="text-sm text-gray-900 truncate">
      {text.slice(0, idx)}
      <strong className="font-semibold">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Icon for each suggestion type ────────────────────────────────────────────
function SuggestionIcon({ type, format }) {
  const cls = 'w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0'
  if (type === 'resource')  return <span className={cls}>{FORMAT_ICONS[format] ?? FORMAT_ICONS.other}</span>
  if (type === 'category')  return <span className={cls}><Folder size={14} className="text-orange-400" /></span>
  return                           <span className={cls}><Tag    size={14} className="text-indigo-400" /></span>
}

// ── Main autocomplete input ───────────────────────────────────────────────────
function SearchAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([])
  const [open,        setOpen]        = useState(false)
  const [activeIdx,   setActiveIdx]   = useState(-1)
  const [fetching,    setFetching]    = useState(false)
  const inputRef    = useRef(null)
  const dropdownRef = useRef(null)
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const debounced   = useDebounce(value, 200)

  // Fetch suggestions whenever debounced query changes
  useEffect(() => {
    if (debounced.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    let cancelled = false
    setFetching(true)
    resourcesApi.suggest(debounced)
      .then(r => {
        if (cancelled) return
        const data = Array.isArray(r.data) ? r.data : []
        setSuggestions(data)
        setOpen(data.length > 0)
        setActiveIdx(-1)
      })
      .catch(() => { if (!cancelled) setSuggestions([]) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [debounced])

  // Close on click outside
  useEffect(() => {
    const onDown = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const handleSelect = (s) => {
    setOpen(false)
    setActiveIdx(-1)
    if (s.type === 'resource') {
      navigate(`/resources/${s.resource_id}`)
    } else {
      onChange(s.text)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!open || suggestions.length === 0) return
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      if (!open) return
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0) {
        e.preventDefault()
        handleSelect(suggestions[activeIdx])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  const hasProfile = profile?.field_of_study || profile?.preferred_themes?.length > 0

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          className="input pl-9 pr-9"
          placeholder="Rechercher une ressource..."
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          autoComplete="off"
          spellCheck={false}
        />
        {fetching && (
          <Loader2 size={13} className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-300 animate-spin pointer-events-none" />
        )}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setSuggestions([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 border-b border-gray-100">
            {hasProfile
              ? <><Sparkles size={11} className="text-indigo-400 shrink-0" /><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Suggéré pour vous</p></>
              : <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Suggestions</p>
            }
          </div>

          {/* Suggestion list */}
          <ul className="py-1">
            {suggestions.map((s, i) => (
              <li key={`${s.type}-${s.text}-${i}`}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                    ${i === activeIdx ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => handleSelect(s)}
                >
                  <SuggestionIcon type={s.type} format={s.format} />

                  <div className="flex-1 min-w-0">
                    <HighlightedText text={s.text} query={value} />

                    {s.type === 'resource' && (s.category || s.format || s.level) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {[s.category, FORMAT_LABELS[s.format], LEVEL_LABELS[s.level]].filter(Boolean).join(' · ')}
                      </p>
                    )}

                    {s.type !== 'resource' && s.count != null && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.count} ressource{s.count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {s.type === 'resource'
                    ? <ArrowRight size={13} className="text-gray-300 shrink-0" />
                    : <Search size={12} className="text-gray-300 shrink-0" />
                  }
                </button>

                {i < suggestions.length - 1 && (
                  <div className="mx-3 border-b border-gray-100" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Simple select ─────────────────────────────────────────────────────────────
function Select({ label, value, onChange, options = [] }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <select className="input text-sm" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ResourcesPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery]           = useState(searchParams.get('q') || '')
  const [level, setLevel]           = useState(searchParams.get('level') || '')
  const [format, setFormat]         = useState(searchParams.get('format') || '')
  const [language, setLanguage]     = useState(searchParams.get('language') || '')
  const [sort, setSort]             = useState(searchParams.get('ordering') || '-created_at')
  const [category, setCategory]     = useState(searchParams.get('category') || '')
  const [categories, setCategories] = useState([])
  const [resources, setResources]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    resourcesApi.categories().then(r => {
      const d = r.data
      setCategories(Array.isArray(d) ? d : d.results || [])
    }).catch(() => setCategories([]))
  }, [])

  const fetchResources = useCallback(async () => {
    setLoading(true)
    try {
      let data = []
      if (debouncedQuery.trim()) {
        const res = await resourcesApi.search({
          q: debouncedQuery,
          level: level || undefined,
          format: format || undefined,
          language: language || undefined,
        })
        data = res.data.results || res.data || []
      } else {
        const params = {
          ordering: sort,
          ...(level    && { level }),
          ...(format   && { format }),
          ...(language && { language }),
          ...(category && { category }),
        }
        const res = await resourcesApi.list(params)
        data = res.data.results || res.data || []
      }
      setResources(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setResources([])
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, level, format, language, sort, category])

  useEffect(() => { fetchResources() }, [fetchResources])

  const clearFilters = () => {
    setQuery(''); setLevel(''); setFormat(''); setLanguage('')
    setSort('-created_at'); setCategory('')
  }

  const hasFilters = query || level || format || language || category

  return (
    <div>
      <header className="mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">Catalogue</p>
            <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
              Toutes les ressources
            </h1>
            <p className="text-sm text-gray-500 mt-3">
              {resources.length} ressource{resources.length !== 1 ? 's' : ''} {resources.length !== 1 ? 'trouvées' : 'trouvée'}
            </p>
          </div>
          <button onClick={() => setFiltersOpen(o => !o)} className="btn-secondary text-sm md:hidden">
            <SlidersHorizontal size={14} /> Filtres
          </button>
        </div>
      </header>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className={`${filtersOpen ? 'block' : 'hidden'} md:block w-full md:w-56 shrink-0 space-y-4`}>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Filter size={14} /> Filtres
              </h3>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                  <X size={12} /> Effacer
                </button>
              )}
            </div>
            <Select label="Niveau"    value={level}    onChange={setLevel}    options={LEVELS} />
            <Select label="Format"    value={format}   onChange={setFormat}   options={FORMATS} />
            <Select label="Langue"    value={language} onChange={setLanguage} options={LANGUAGES} />
            <Select
              label="Catégorie"
              value={category}
              onChange={setCategory}
              options={[{ v: '', l: 'Toutes' }, ...categories.map(c => ({ v: c.id, l: c.name }))]}
            />
            <Select label="Trier par" value={sort} onChange={setSort} options={SORTS} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="mb-5">
            <SearchAutocomplete value={query} onChange={setQuery} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : resources.length === 0 ? (
            <div className="py-16 border-t border-gray-200">
              <p className="font-serif text-2xl text-gray-700 mb-2">Aucune ressource ne correspond.</p>
              <p className="text-sm text-gray-500 max-w-md">
                Essayez d'élargir un filtre, ou videz la recherche pour voir l'ensemble du catalogue.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {resources.map(r => <ResourceCard key={r.id} resource={r} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
