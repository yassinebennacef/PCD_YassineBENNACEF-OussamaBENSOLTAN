import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const LEVELS = ['beginner', 'intermediate', 'advanced']
const LEVEL_LABELS = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }

const FIELDS = [
  'Informatique', 'Mathématiques', 'Physique', 'Chimie', 'Biologie',
  'Électronique', 'Génie civil', 'Génie mécanique', 'Réseaux & Télécoms',
  'Intelligence artificielle', 'Cybersécurité', 'Data Science',
  'Économie', 'Gestion', 'Langues', 'Philosophie', 'Histoire',
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', password2: '', role: 'student',
    level: 'beginner', field_of_study: [], preferred_language: 'fr',
  })
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) {
      toast.error('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      await authApi.register({ ...form, field_of_study: form.field_of_study.join(', ') })
      toast.success('Compte créé ! Vous pouvez vous connecter.')
      navigate('/login')
    } catch (err) {
      const errors = err.response?.data
      if (errors) {
        Object.values(errors).flat().forEach(msg => toast.error(msg))
      } else {
        toast.error('Erreur lors de l\'inscription.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#f4f3ef' }}>
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <p className="eyebrow mb-3">ENSI · Learnly</p>
          <h1 className="font-serif text-[40px] leading-[1.05] text-gray-900">
            Créer un compte
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Quelques minutes pour adapter la plateforme à votre profil.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input className="input" value={form.first_name} onChange={set('first_name')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input className="input" value={form.last_name} onChange={set('last_name')} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
              <input className="input" value={form.username} onChange={set('username')} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} required />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="student">Étudiant</option>
                <option value="teacher">Enseignant</option>
              </select>
            </div>

            {/* Student-specific */}
            {form.role === 'student' && (
              <div className="grid grid-cols-2 gap-3">
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
            )}

            {form.role === 'student' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ce que je veux apprendre
                  <span className="text-gray-400 font-normal ml-1">(plusieurs choix possibles)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {FIELDS.map(field => {
                    const selected = form.field_of_study.includes(field)
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          field_of_study: selected
                            ? f.field_of_study.filter(x => x !== field)
                            : [...f.field_of_study, field]
                        }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          selected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-900 hover:text-gray-900'
                        }`}
                      >
                        {field}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input className="input" type="password" value={form.password} onChange={set('password')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                <input className="input" type="password" value={form.password2} onChange={set('password2')} required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Inscription...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà inscrit ?{' '}
            <Link to="/login" className="text-gray-900 font-semibold underline-offset-4 hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
