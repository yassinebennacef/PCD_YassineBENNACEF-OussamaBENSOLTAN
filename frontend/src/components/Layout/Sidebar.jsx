import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Home, BookOpen, Sparkles, Bookmark, Upload,
  LayoutDashboard, User, MessageSquare,
  ChevronDown, ChevronUp, Send, Loader2, MapPin, Navigation,
} from 'lucide-react'
import { feedbackApi, resourcesApi, contextApi } from '../../services/api'
import toast from 'react-hot-toast'

const navItem = (to, icon, label, roles = null) => ({ to, icon, label, roles })

const NAV_ITEMS = [
  navItem('/', Home, 'Accueil'),
  navItem('/resources', BookOpen, 'Ressources'),
  navItem('/recommendations', Sparkles, 'Pour moi'),
  navItem('/bookmarks', Bookmark, 'Favoris'),
  navItem('/profile', User, 'Mon profil'),
  navItem('/upload', Upload, 'Publier', ['teacher', 'admin']),
  navItem('/admin', LayoutDashboard, 'Dashboard', ['admin']),
  navItem('/feedback', MessageSquare, 'Feedbacks', ['admin']),
]

function FeedbackWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [resourceTitle, setResourceTitle] = useState(null)

  useEffect(() => {
    setResourceTitle(null)
    const match = location.pathname.match(/^\/resources\/(\d+)/)
    if (!match) return
    resourcesApi.detail(match[1])
      .then(r => setResourceTitle(r.data?.title || null))
      .catch(() => {})
  }, [location.pathname])

  useEffect(() => { setOpen(false); setText('') }, [location.pathname])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      await feedbackApi.suggest({
        suggestion_type: 'improvement',
        title: resourceTitle
          ? `[${resourceTitle}] ${text.trim()}`.slice(0, 255)
          : text.trim().slice(0, 255),
        description: text.trim(),
        url: window.location.href,
      })
      toast.success('Feedback envoyé !')
      setText('')
      setOpen(false)
    } catch {
      toast.error("Erreur lors de l'envoi.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-200 pt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${
          open ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <span className="flex items-center gap-2">
          <MessageSquare size={14} />
          Donner un avis
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-2 px-1">
          {resourceTitle && (
            <p className="mb-2 px-1 text-[11px] text-gray-500 italic truncate">
              à propos de <span className="text-gray-800 not-italic font-medium">{resourceTitle}</span>
            </p>
          )}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Votre avis ou suggestion..."
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-2 resize-none focus:outline-none focus:border-gray-900 text-gray-700 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Envoyer
          </button>
        </form>
      )}
    </div>
  )
}

const ZONE_LABELS = {
  classroom:    'Salle de cours',
  library:      'Bibliothèque',
  lab:          'Laboratoire',
  amphitheater: 'Amphithéâtre',
  common_area:  'Espace commun',
  off_campus:   'Hors campus',
}

const ENSI_LAT = 36.8464
const ENSI_LNG = 10.0228

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function ZoneWidget() {
  const [zone, setZone]         = useState(null)
  const [open, setOpen]         = useState(false)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    contextApi.getZone()
      .then(r => setZone(r.data.zone))
      .catch(() => setZone('off_campus'))
  }, [])

  const selectZone = async (z) => {
    setZone(z)
    setOpen(false)
    try { await contextApi.updateZone(z) } catch {}
  }

  const detect = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non disponible.')
      return
    }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const km = haversineKm(coords.latitude, coords.longitude, ENSI_LAT, ENSI_LNG)
        if (km > 1.5) {
          selectZone('off_campus')
          toast('Vous êtes hors campus.')
        } else {
          toast.success('Vous êtes sur le campus — choisissez votre zone.')
          setOpen(true)
        }
        setDetecting(false)
      },
      () => {
        toast.error('Impossible de détecter la position.')
        setDetecting(false)
      },
      { timeout: 8000 }
    )
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 px-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold mb-2">
        Localisation
      </p>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 font-medium"
      >
        <span className="flex items-center gap-1.5">
          <MapPin size={13} className="text-gray-400 shrink-0" />
          <span className="truncate">{zone ? ZONE_LABELS[zone] : '…'}</span>
        </span>
        {open ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
      </button>

      {open && (
        <div className="mt-2 space-y-0.5">
          {Object.entries(ZONE_LABELS).map(([z, label]) => (
            <button
              key={z}
              onClick={() => selectZone(z)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                zone === z
                  ? 'bg-gray-900 text-white font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={detect}
            disabled={detecting}
            className="w-full flex items-center justify-center gap-1.5 mt-1 px-2 py-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors"
          >
            {detecting
              ? <Loader2 size={11} className="animate-spin" />
              : <Navigation size={11} />}
            Détecter ma position
          </button>
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { user, profile } = useAuth()

  const visible = NAV_ITEMS.filter(
    item => !item.roles || item.roles.includes(user?.role)
  )

  const isRegularUser = user?.role === 'student' || user?.role === 'teacher'

  return (
    <aside className="hidden lg:flex flex-col w-52 border-r border-gray-200 bg-white min-h-full py-6 px-4 shrink-0">
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold mb-3 px-2">
        Navigation
      </p>
      <nav className="flex flex-col">
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 pl-3 pr-2 py-2 text-sm border-l-2 transition-colors ${
                isActive
                  ? 'text-gray-900 font-semibold border-gray-900 bg-gray-50/60'
                  : 'text-gray-500 hover:text-gray-900 font-medium border-transparent'
              }`
            }
          >
            <Icon size={15} className="shrink-0 opacity-80" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Level — inline text, no badge */}
      {user?.role === 'student' && profile?.level && (
        <div className="mt-6 pt-4 border-t border-gray-200 px-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold mb-1.5">
            Niveau
          </p>
          <p className="text-sm text-gray-800 font-medium">
            {{ beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }[profile.level] || profile.level}
          </p>
        </div>
      )}

      {isRegularUser && <ZoneWidget />}
      {isRegularUser && <FeedbackWidget />}
    </aside>
  )
}
