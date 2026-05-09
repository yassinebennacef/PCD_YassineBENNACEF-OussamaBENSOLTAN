import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BookOpen, LogOut, User, ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'

const ROLE_LABELS = { student: 'Étudiant', teacher: 'Enseignant', admin: 'Administrateur' }
const ROLE_COLORS = {
  student: 'bg-blue-100 text-blue-700',
  teacher: 'bg-emerald-100 text-emerald-700',
  admin:   'bg-violet-100 text-violet-700',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const navLinks = [
    { to: '/', label: 'Accueil' },
    { to: '/resources', label: 'Ressources' },
    { to: '/recommendations', label: 'Pour moi' },
    ...(user?.role !== 'student' ? [{ to: '/upload', label: 'Publier' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Dashboard' }] : []),
  ]

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-6">

        {/* Logo — wordmark only, no icon-in-square */}
        <Link to="/" className="flex items-baseline gap-1.5 shrink-0 group">
          <span className="font-serif text-[26px] leading-none text-gray-900 group-hover:text-gray-700 transition-colors">
            Learnly
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
            ENSI
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 flex-1 ml-4">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm transition-colors ${
                isActive(to)
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-500 hover:text-gray-900 font-medium'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center overflow-hidden shrink-0">
                {user?.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white text-sm font-semibold">
                      {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
                    </span>
                }
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-gray-900 leading-tight">
                  {user?.first_name || user?.username}
                </p>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  {ROLE_LABELS[user?.role]}
                </p>
              </div>
              <ChevronDown size={13} className="text-gray-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+8px)] w-60 bg-white rounded-xl border border-gray-200 py-1.5 z-50 overflow-hidden" style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,0.12)' }}>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user?.full_name || user?.username}</p>
                    <span className={`inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${ROLE_COLORS[user?.role]}`}>
                      {ROLE_LABELS[user?.role]}
                    </span>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={14} className="text-gray-400" /> Mon profil
                  </Link>
                  <Link
                    to="/bookmarks"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <BookOpen size={14} className="text-gray-400" /> Favoris
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={14} /> Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen(o => !o)}
          >
            {menuOpen ? <X size={20} className="text-gray-600" /> : <Menu size={20} className="text-gray-600" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-2 flex flex-col">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2.5 text-sm border-l-2 transition-colors ${
                isActive(to)
                  ? 'text-gray-900 font-semibold border-gray-900 bg-gray-50/60'
                  : 'text-gray-500 hover:text-gray-900 font-medium border-transparent'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
