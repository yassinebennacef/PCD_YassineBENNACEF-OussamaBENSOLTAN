import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { recommendationsApi } from '../services/api'
import ResourceCard from '../components/Common/ResourceCard'
import { RefreshCw, ArrowRight } from 'lucide-react'

const LEVEL_LABELS = {
  beginner:     'Débutant',
  intermediate: 'Intermédiaire',
  advanced:     'Avancé',
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="skeleton h-[140px] rounded-none" />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-3 w-3/4" />
        <div className="skeleton h-3 w-1/2 mt-3" />
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, subtitle, count }) {
  return (
    <div className="mb-5 pb-3 border-b border-gray-200">
      {eyebrow && (
        <p className="eyebrow mb-2">{eyebrow}</p>
      )}
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-serif text-[26px] sm:text-[30px] text-gray-900 leading-[1.05]">
          {title}
        </h2>
        {count > 0 && (
          <span className="text-xs text-gray-400 font-medium pb-1 shrink-0">
            {count} ressource{count > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-gray-500 mt-1.5 max-w-2xl">{subtitle}</p>
      )}
    </div>
  )
}

function ResourceRow({ resources, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }
  if (!resources?.length) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {resources.map(r => <ResourceCard key={r.id} resource={r} />)}
    </div>
  )
}

function ProfileSummary({ profile }) {
  if (!profile) return null
  const levelLabel = LEVEL_LABELS[profile.level] || profile.level

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-semibold mb-1">Niveau</p>
        <p className="text-sm text-gray-900 font-semibold">{levelLabel || '—'}</p>
      </div>
      {profile.field && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-semibold mb-1">Domaine</p>
          <p className="text-sm text-gray-900 font-semibold">{profile.field}</p>
        </div>
      )}
      {profile.preferred_formats?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-semibold mb-1">Formats préférés</p>
          <p className="text-sm text-gray-900 font-semibold">
            {profile.preferred_formats.map(f => f.toUpperCase()).join(' · ')}
          </p>
        </div>
      )}
      <Link
        to="/profile"
        className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-900 underline-offset-4 hover:underline transition-colors flex items-center gap-1"
      >
        Modifier mon profil <ArrowRight size={12} />
      </Link>
    </div>
  )
}

function EmptySection({ message }) {
  return (
    <div className="py-10 px-5 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
      <p className="text-sm italic">{message}</p>
    </div>
  )
}

export default function RecommendationsPage() {
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const { data: res } = await recommendationsApi.sections()
      setData(res)
    } catch (err) {
      setError(err?.response?.status === 404
        ? 'Endpoint introuvable — redémarrez le serveur backend.'
        : (err?.message || 'Erreur de chargement.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const sections = data?.sections
  const profile  = data?.profile

  return (
    <div className="space-y-12 max-w-6xl">

      {/* Page header */}
      <header>
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <p className="eyebrow mb-3">Pour vous</p>
            <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
              Recommandations
            </h1>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-secondary text-sm shrink-0"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
        <p className="text-[15px] text-gray-500 leading-relaxed max-w-2xl">
          Ressources choisies selon votre niveau, votre domaine et votre historique de consultation.
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Profile summary */}
      {loading ? (
        <div className="skeleton h-[88px] rounded-xl" />
      ) : (
        <ProfileSummary profile={profile} />
      )}

      {/* History */}
      <section>
        <SectionHeader
          eyebrow="Historique"
          title="Reprenez là où vous étiez"
          subtitle="Ressources que vous avez consultées récemment."
          count={sections?.history?.length}
        />
        {loading ? (
          <ResourceRow loading />
        ) : sections?.history?.length ? (
          <ResourceRow resources={sections.history} />
        ) : (
          <EmptySection message="Consultez quelques ressources pour retrouver votre historique ici." />
        )}
      </section>

      {/* By level */}
      <section>
        <SectionHeader
          eyebrow="À votre niveau"
          title={profile?.level ? `Pour un niveau ${LEVEL_LABELS[profile.level] || profile.level}` : 'Selon votre niveau'}
          subtitle="Contenu adapté à votre progression actuelle."
          count={sections?.by_level?.length}
        />
        {loading ? (
          <ResourceRow loading />
        ) : sections?.by_level?.length ? (
          <ResourceRow resources={sections.by_level} />
        ) : (
          <EmptySection message="Aucune ressource trouvée pour votre niveau actuellement." />
        )}
      </section>

      {/* By field */}
      <section>
        <SectionHeader
          eyebrow="Votre domaine"
          title={profile?.field ? `Du côté de ${profile.field}` : 'Dans votre domaine'}
          subtitle="Liées à votre filière et aux thèmes que vous suivez."
          count={sections?.by_field?.length}
        />
        {loading ? (
          <ResourceRow loading />
        ) : sections?.by_field?.length ? (
          <ResourceRow resources={sections.by_field} />
        ) : (
          <EmptySection message="Renseignez votre filière dans le profil pour obtenir des suggestions personnalisées." />
        )}
      </section>

      {/* By peers */}
      <section>
        <SectionHeader
          eyebrow="Vos pairs"
          title="Ce que d'autres étudient"
          subtitle="Choix populaires parmi les étudiants de niveau et domaine similaires."
          count={sections?.by_peers?.length}
        />
        {loading ? (
          <ResourceRow loading />
        ) : sections?.by_peers?.length ? (
          <ResourceRow resources={sections.by_peers} />
        ) : (
          <EmptySection message="Pas encore assez de signaux d'autres étudiants de votre profil." />
        )}
      </section>

      {/* Trending */}
      <section>
        <SectionHeader
          eyebrow="Tendances"
          title="Cette semaine sur Learnly"
          subtitle="Les ressources les plus consultées en ce moment."
          count={sections?.popular?.length}
        />
        {loading ? (
          <ResourceRow loading />
        ) : sections?.popular?.length ? (
          <ResourceRow resources={sections.popular} />
        ) : (
          <EmptySection message="Aucune donnée de popularité disponible." />
        )}
      </section>

      {/* By location */}
      {(loading || sections?.by_location?.length > 0) && (
        <section>
          <SectionHeader
            eyebrow={data?.zone?.label ? `Zone · ${data.zone.label}` : 'Votre zone'}
            title="Adapté à votre emplacement"
            subtitle="Formats optimaux selon où vous vous trouvez sur le campus."
            count={sections?.by_location?.length}
          />
          {loading ? (
            <ResourceRow loading />
          ) : sections?.by_location?.length ? (
            <ResourceRow resources={sections.by_location} />
          ) : (
            <EmptySection message="Aucune ressource adaptée à votre zone pour le moment." />
          )}
        </section>
      )}

    </div>
  )
}
