import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resourcesApi, recommendationsApi } from '../services/api'
import ResourceCard from '../components/Common/ResourceCard'

const LEVEL_LABELS = {
  beginner:     'Débutant',
  intermediate: 'Intermédiaire',
  advanced:     'Avancé',
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="skeleton h-[140px] rounded-none" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-3 w-3/4" />
      </div>
    </div>
  )
}

function Section({ title, link, linkLabel = 'Voir tout', children, loading }) {
  return (
    <section>
      <div className="flex items-end justify-between mb-5 pb-3 border-b border-gray-200">
        <h2 className="font-serif text-[28px] sm:text-3xl text-gray-900 leading-none">
          {title}
        </h2>
        {link && (
          <Link
            to={link}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 underline-offset-4 hover:underline transition-colors"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function HomePage() {
  const { user, profile } = useAuth()
  const [popular, setPopular]                 = useState([])
  const [recent, setRecent]                   = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading]                 = useState(true)

  useEffect(() => {
    Promise.all([
      resourcesApi.popular(),
      resourcesApi.recent(),
      recommendationsApi.get(6),
    ]).then(([pop, rec, reco]) => {
      setPopular(pop.data.slice(0, 4))
      setRecent(rec.data.slice(0, 4))
      setRecommendations(reco.data.recommendations?.slice(0, 4) || [])
    }).finally(() => setLoading(false))
  }, [])

  const firstName = user?.first_name || user?.username || ''

  return (
    <div className="space-y-14">

      {/* Hero — typography first, no decorative side panel */}
      <header className="pt-3">
        <p className="eyebrow mb-5">
          {greeting()}{firstName && `, ${firstName}`}
        </p>
        <h1 className="font-serif text-[44px] sm:text-[56px] md:text-[68px] text-gray-900 leading-[1.02] mb-5 max-w-3xl">
          Quelle ressource ouvrirez-vous aujourd'hui<span className="text-gray-400">&nbsp;?</span>
        </h1>
        <p className="text-[15px] text-gray-500 leading-relaxed max-w-lg mb-7">
          Parcourez le catalogue, ou laissez-vous guider par les suggestions adaptées à votre niveau et à ce que vos pairs étudient.
        </p>
        <div className="flex flex-wrap gap-2.5 items-center">
          <Link to="/resources" className="btn-primary">
            Explorer le catalogue
          </Link>
          <Link to="/recommendations" className="btn-secondary">
            Pour vous <span aria-hidden>→</span>
          </Link>
        </div>

        {profile?.level && (
          <div className="mt-10 pt-5 border-t border-gray-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 max-w-3xl">
            <span className="font-medium text-gray-700">Votre profil</span>
            <span className="text-gray-300">·</span>
            <span>Niveau <span className="text-gray-800">{LEVEL_LABELS[profile.level] || profile.level}</span></span>
            {profile.field_of_study && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-800">{profile.field_of_study}</span>
              </>
            )}
          </div>
        )}
      </header>

      {/* Personalised recommendations */}
      {(loading || recommendations.length > 0) && (
        <Section title="Sélectionnés pour vous" link="/recommendations" loading={loading}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.map(r => <ResourceCard key={r.id} resource={r} />)}
          </div>
        </Section>
      )}

      {/* Popular */}
      <Section title="Les plus populaires" link="/resources?sort=popular" loading={loading}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popular.map(r => <ResourceCard key={r.id} resource={r} />)}
        </div>
      </Section>

      {/* Recent */}
      <Section title="Ajouts récents" link="/resources?sort=recent" loading={loading}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recent.map(r => <ResourceCard key={r.id} resource={r} />)}
        </div>
      </Section>

    </div>
  )
}
