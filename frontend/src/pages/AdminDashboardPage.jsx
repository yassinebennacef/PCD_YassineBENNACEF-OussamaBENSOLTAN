import { useEffect, useState } from 'react'
import { dashboardApi, resourcesApi } from '../services/api'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Users, BookOpen, TrendingUp, Star, Wifi, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
)

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon size={14} className="text-gray-300" />}
      </div>
      <p className="font-serif text-[36px] leading-none text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="font-serif text-2xl text-gray-900 mb-5 pb-3 border-b border-gray-200">
      {children}
    </h2>
  )
}

export default function AdminDashboardPage() {
  const [overview, setOverview]         = useState(null)
  const [usageData, setUsageData]       = useState([])
  const [studentStats, setStudentStats] = useState(null)
  const [resourceStats, setResourceStats] = useState(null)
  const [networkStats, setNetworkStats] = useState(null)
  const [pending, setPending]           = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardApi.overview(),
      dashboardApi.usage({ days: 14, granularity: 'day' }),
      dashboardApi.students(),
      dashboardApi.resources(),
      dashboardApi.network(),
    ]).then(([ov, us, st, rs, nw]) => {
      setOverview(ov.data)
      setUsageData(us.data)
      setStudentStats(st.data)
      setResourceStats(rs.data)
      setNetworkStats(nw.data)
      setPending(rs.data.pending_validation || [])
    }).catch(() => toast.error('Erreur de chargement du tableau de bord.'))
    .finally(() => setLoading(false))
  }, [])

  const handleValidate = async (id) => {
    await resourcesApi.validate(id)
    setPending(p => p.filter(r => r.id !== id))
    toast.success('Ressource validée.')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={22} className="animate-spin text-gray-400" />
    </div>
  )

  // ── Build chart datasets ──────────────────────────────────────────────────

  // Usage timeline — group by date, sum views
  const usageDates = [...new Set(usageData.map(d => d.period?.slice(0, 10)))].sort()
  const viewsPerDay = usageDates.map(date =>
    usageData.filter(d => d.period?.startsWith(date) && d.event_type === 'view')
      .reduce((s, d) => s + d.count, 0)
  )

  const usageChartData = {
    labels: usageDates.map(d => new Date(d).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short' })),
    datasets: [{
      label: 'Vues par jour',
      data: viewsPerDay,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      tension: 0.4, fill: true, pointRadius: 4,
    }],
  }

  // Level distribution (doughnut)
  const levelData = {
    labels: (studentStats?.level_distribution || []).map(d => ({
      beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé'
    }[d.level] || d.level)),
    datasets: [{
      data: (studentStats?.level_distribution || []).map(d => d.count),
      backgroundColor: CHART_COLORS,
      borderWidth: 2, borderColor: '#fff',
    }],
  }

  // Format distribution (bar)
  const formatData = {
    labels: (overview?.resources?.by_format || []).map(d => d.format?.toUpperCase()),
    datasets: [{
      label: 'Ressources',
      data: (overview?.resources?.by_format || []).map(d => d.count),
      backgroundColor: CHART_COLORS,
      borderRadius: 6,
    }],
  }

  // Network timeline
  const netLabels = (networkStats?.timeline || []).map(d =>
    new Date(d.period).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short' })
  )
  const networkChartData = {
    labels: netLabels,
    datasets: [{
      label: 'Débit moy. (kbps)',
      data: (networkStats?.timeline || []).map(d => Math.round(d.avg_download)),
      borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)',
      tension: 0.4, fill: true,
    }, {
      label: 'Latence moy. (ms)',
      data: (networkStats?.timeline || []).map(d => Math.round(d.avg_latency)),
      borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',
      tension: 0.4, fill: false,
    }],
  }

  const chartOptions = { responsive: true, plugins: { legend: { position: 'bottom' } } }

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow mb-3">Administration</p>
        <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
          Tableau de bord
        </h1>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users}      label="Étudiants"            value={overview?.users?.students}                       sub={`+${overview?.users?.new_last_7_days ?? 0} cette semaine`} />
        <KpiCard icon={BookOpen}   label="Ressources"           value={overview?.resources?.validated}                  sub={`${overview?.resources?.pending ?? 0} en attente`} />
        <KpiCard icon={TrendingUp} label="Interactions · 30j"   value={overview?.interactions?.total_last_30_days} />
        <KpiCard icon={Star}       label="Note moyenne"         value={overview?.feedback?.avg_rating?.toFixed(2)}      sub={`${overview?.feedback?.total_ratings ?? 0} notes`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <SectionTitle>Activité — vues par jour (14 jours)</SectionTitle>
          <Line data={usageChartData} options={chartOptions} />
        </div>
        <div className="card">
          <SectionTitle>Niveaux des étudiants</SectionTitle>
          <Doughnut data={levelData} options={chartOptions} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <SectionTitle>Ressources par format</SectionTitle>
          <Bar data={formatData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
        </div>
        <div className="card">
          <SectionTitle>Qualité réseau (24h)</SectionTitle>
          {networkStats?.timeline?.length > 0
            ? <Line data={networkChartData} options={chartOptions} />
            : <p className="text-sm text-gray-400 text-center py-10">Aucune donnée réseau disponible.</p>
          }
        </div>
      </div>

      {/* Pending validation */}
      {pending.length > 0 && (
        <div className="card">
          <SectionTitle>Ressources en attente de validation ({pending.length})</SectionTitle>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <AlertCircle size={16} className="text-yellow-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-gray-500">
                    par {r.uploaded_by__username} · {r.format?.toUpperCase()} · {r.level}
                  </p>
                </div>
                <button onClick={() => handleValidate(r.id)} className="btn-primary text-xs px-3 py-1.5">
                  <CheckCircle size={13} /> Valider
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top resources table */}
      <div className="card">
        <SectionTitle>Top ressources (par vues)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Titre</th>
                <th className="pb-2 pr-4 font-medium">Format</th>
                <th className="pb-2 pr-4 font-medium">Niveau</th>
                <th className="pb-2 pr-4 font-medium">Vues</th>
                <th className="pb-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(resourceStats?.top_viewed || []).map(r => (
                <tr key={r.id}>
                  <td className="py-2 pr-4 font-medium text-gray-800 max-w-[200px] truncate">{r.title}</td>
                  <td className="py-2 pr-4"><span className="badge-blue">{r.format?.toUpperCase()}</span></td>
                  <td className="py-2 pr-4 capitalize text-gray-600">{r.level}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.view_count}</td>
                  <td className="py-2 text-yellow-500 font-medium">
                    {r.average_rating?.toFixed(1)} ★
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student top */}
      <div className="card">
        <SectionTitle>Étudiants les plus actifs</SectionTitle>
        <div className="space-y-2">
          {(studentStats?.top_students_by_time || []).map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-300 w-5">{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-xs font-semibold text-white">
                {(s.user__first_name?.[0] || s.user__username?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {s.user__first_name} {s.user__last_name}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} /> {Math.round(s.total_time_spent / 60)} min
              </div>
              <span className="badge-blue capitalize text-xs">{s.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
