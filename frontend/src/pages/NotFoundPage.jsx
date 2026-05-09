import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#f4f3ef' }}>
      <div className="max-w-md">
        <p className="font-serif text-[140px] leading-none text-gray-200 select-none">404</p>
        <p className="eyebrow mb-3 mt-2">Erreur</p>
        <h1 className="font-serif text-4xl text-gray-900 mb-3">Cette page n'existe pas.</h1>
        <p className="text-sm text-gray-500 mb-7">
          Le lien que vous avez suivi est peut-être périmé, ou la ressource a été déplacée.
        </p>
        <Link to="/" className="btn-primary">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
