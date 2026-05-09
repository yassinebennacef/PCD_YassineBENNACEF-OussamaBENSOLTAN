import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import { Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const FORMATS = ['pdf', 'video', 'audio', 'html']
const LEVELS  = ['beginner', 'intermediate', 'advanced']
const LEVEL_LABELS = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }

const FORMAT_LABELS = {
  pdf: 'PDF', video: 'Vidéo', audio: 'Audio', html: 'Web', zip: 'Archive', other: 'Autre',
}

function Stat({ label, value, hint }) {
  return (
    <div className="border-l border-gray-200 pl-5 first:border-l-0 first:pl-0">
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-serif text-[34px] leading-none text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}

function ResourceRow({ item }) {
  const fmt = FORMAT_LABELS[item.format] || FORMAT_LABELS.other
  return (
    <Link
      to={`/resources/${item.id}`}
      className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="w-8 h-8 rounded bg-[#f4f3ef] flex items-center justify-center shrink-0 text-[11px] font-semibold text-gray-400 uppercase">
        {fmt.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-gray-600 transition-colors">
          {item.title}
        </p>
        {item.category_name && (
          <p className="text-[11px] text-gray-400 truncate">{item.category_name}</p>
        )}
      </div>
    </Link>
  )
}

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const [activity, setActivity] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    level: 'beginner',
    field_of_study: '',
    preferred_language: 'fr',
    learning_goals: '',
    preferred_formats: [],
    preferred_themes: [],
  })

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        first_name: user.first_name || '',
        last_name:  user.last_name  || '',
        email:      user.email      || '',
      }))
    }
    if (profile && Object.keys(profile).length > 0) {
      setForm(f => ({
        ...f,
        level:              profile.level              || 'beginner',
        field_of_study:     profile.field_of_study     || '',
        preferred_language: profile.preferred_language || 'fr',
        learning_goals:     profile.learning_goals     || '',
        preferred_formats:  Array.isArray(profile.preferred_formats) ? profile.preferred_formats : [],
        preferred_themes:   Array.isArray(profile.preferred_themes)  ? profile.preferred_themes  : [],
      }))
    }
    authApi.activity()
      .then(r => setActivity(r.data))
      .catch(() => setActivity(null))
  }, [user, profile])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleFormat = (fmt) => setForm(f => ({
    ...f,
    preferred_formats: f.preferred_formats.includes(fmt)
      ? f.preferred_formats.filter(x => x !== fmt)
      : [...f.preferred_formats, fmt],
  }))

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateProfile(form)
      toast.success('Profil mis à jour !')
    } catch {
      toast.error('Erreur lors de la mise à jour.')
    } finally {
      setLoading(false)
    }
  }

  const totalMin = Math.round((profile?.total_time_spent || 0) / 60)

  return (
    <div className="max-w-3xl space-y-10">

      {/* Header */}
      <header>
        <p className="eyebrow mb-3">Profil</p>
        <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
          {form.first_name || user?.username}
          {form.last_name && <> {form.last_name}</>}
        </h1>
        {user?.email && (
          <p className="text-sm text-gray-500 mt-2">{user.email}</p>
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 py-6 border-y border-gray-200">
        <Stat label="Temps total"  value={totalMin}                           hint="minutes" />
        <Stat label="Complétés"    value={activity?.completed_count ?? '—'}   hint={activity?.completed_count === 1 ? 'ressource' : 'ressources'} />
        <Stat label="Au total"     value={activity?.viewed_count    ?? '—'}   hint="ressources ouvertes" />
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="card space-y-5">
        <h2 className="font-serif text-2xl text-gray-900">Informations personnelles</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input className="input" value={form.first_name} onChange={set('first_name')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input className="input" value={form.last_name} onChange={set('last_name')} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} />
        </div>

        {user?.role === 'student' && (
          <>
            <div className="rule pt-5">
              <h2 className="font-serif text-2xl text-gray-900 mb-4">Préférences d'apprentissage</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                <select className="input" value={form.level} onChange={set('level')}>
                  {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Langue préférée</label>
                <select className="input" value={form.preferred_language} onChange={set('preferred_language')}>
                  <option value="fr">Français</option>
                  <option value="ar">Arabe</option>
                  <option value="en">Anglais</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domaine d'études</label>
              <input
                className="input"
                value={form.field_of_study}
                onChange={set('field_of_study')}
                placeholder="ex : Informatique, Mathématiques..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Formats préférés</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(fmt => {
                  const active = form.preferred_formats.includes(fmt)
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleFormat(fmt)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-900 hover:text-gray-900'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objectifs d'apprentissage</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={form.learning_goals}
                onChange={set('learning_goals')}
                placeholder="Quelques mots sur ce que vous cherchez à accomplir..."
              />
            </div>
          </>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {loading ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </form>

      {/* Recent viewed */}
      <section>
        <h2 className="font-serif text-2xl text-gray-900 mb-4 pb-3 border-b border-gray-200">
          Dernières ressources ouvertes
        </h2>
        {activity?.recent_viewed?.length ? (
          <div className="divide-y divide-gray-100">
            {activity.recent_viewed.map(item => <ResourceRow key={item.id} item={item} />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-4">
            Consultez des ressources pour les voir apparaître ici.
          </p>
        )}
      </section>

      {/* Completed list */}
      <section>
        <h2 className="font-serif text-2xl text-gray-900 mb-4 pb-3 border-b border-gray-200">
          Ressources complétées
        </h2>
        {activity?.completed_list?.length ? (
          <div className="divide-y divide-gray-100">
            {activity.completed_list.map(item => <ResourceRow key={item.id} item={item} />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-4">
            Appuyez sur le bouton <span className="not-italic">◎</span> sur une ressource pour la marquer comme complétée.
          </p>
        )}
      </section>

    </div>
  )
}
