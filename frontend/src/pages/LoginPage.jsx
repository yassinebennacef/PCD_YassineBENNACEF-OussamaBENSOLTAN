import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form)
      toast.success('Bienvenue !')
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Identifiants incorrects.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f4f3ef' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 text-white"
        style={{ background: 'linear-gradient(160deg, #1e3a8a 0%, #2563eb 100%)' }}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl leading-none">Learnly</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-blue-200 font-semibold">ENSI</span>
        </div>

        <div>
          <p className="text-blue-200 text-[11px] uppercase tracking-[0.2em] font-semibold mb-4">Plateforme d'apprentissage inclusif</p>
          <h2 className="font-serif text-[44px] leading-[1.05] mb-5">
            Apprenez à votre<br />rythme, où que<br />vous soyez.
          </h2>
          <p className="text-blue-100/80 text-[15px] leading-relaxed max-w-[280px]">
            Des ressources pédagogiques adaptées à votre niveau, recommandées en fonction de ce que font vos pairs.
          </p>
        </div>

        <p className="text-blue-300 text-xs">ENSI — Université de la Manouba · 2025/2026</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-baseline gap-1.5 mb-10 lg:hidden">
            <span className="font-serif text-3xl text-gray-900 leading-none">Learnly</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold">ENSI</span>
          </div>

          <p className="eyebrow mb-3">Connexion</p>
          <h1 className="font-serif text-[40px] leading-[1.05] text-gray-900 mb-2">Content de vous revoir.</h1>
          <p className="text-sm text-gray-500 mb-7">Entrez vos identifiants pour reprendre où vous en étiez.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nom d'utilisateur
              </label>
              <input
                className="input"
                value={form.username}
                onChange={set('username')}
                placeholder="ex : yassine_b"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-gray-900 font-semibold underline-offset-4 hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
