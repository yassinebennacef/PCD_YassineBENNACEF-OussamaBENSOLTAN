import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { resourcesApi } from '../services/api'
import { Upload, Loader2, FileText, Link as LinkIcon, CheckCircle2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const LEVELS    = [{ v: 'beginner', l: 'Débutant' }, { v: 'intermediate', l: 'Intermédiaire' }, { v: 'advanced', l: 'Avancé' }]
const FORMATS   = [{ v: 'pdf', l: 'PDF' }, { v: 'video', l: 'Vidéo' }, { v: 'audio', l: 'Audio' }, { v: 'html', l: 'Web' }, { v: 'zip', l: 'Archive' }, { v: 'other', l: 'Autre' }]
const LANGUAGES = [{ v: 'fr', l: 'Français' }, { v: 'ar', l: 'Arabe' }, { v: 'en', l: 'Anglais' }]

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function UploadResourcePage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading]         = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [created, setCreated] = useState(null)
  const [form, setForm] = useState({
    title: '', description: '',
    level: 'beginner', format: 'pdf', language: 'fr',
    category: '', tags: '',
    dcat_publisher: '', dcat_license: '', dcat_keywords: '',
  })
  const [file, setFile] = useState(null)
  const [externalUrl, setExternalUrl] = useState('')
  const [uploadMode, setUploadMode] = useState('file')   // 'file' | 'url'

  useEffect(() => {
    resourcesApi.categories().then(r => {
      const d = r.data
      setCategories(Array.isArray(d) ? d : d.results || [])
    }).catch(() => setCategories([]))
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (uploadMode === 'file' && !file) {
      toast.error('Veuillez sélectionner un fichier.')
      return
    }

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
    if (uploadMode === 'file' && file) fd.append('file', file)
    if (uploadMode === 'url') fd.append('external_url', externalUrl)

    // Convert comma-separated tags/keywords to JSON
    if (form.tags) fd.set('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)))
    if (form.dcat_keywords) fd.set('dcat_keywords', JSON.stringify(form.dcat_keywords.split(',').map(t => t.trim()).filter(Boolean)))

    setLoading(true)
    setUploadPercent(0)
    try {
      const { data } = await resourcesApi.create(fd, (evt) => {
        if (evt.total) setUploadPercent(Math.round((evt.loaded / evt.total) * 100))
      })
      setCreated(data)
    } catch (err) {
      const errors = err.response?.data
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m))
      else toast.error('Erreur lors de l\'ajout.')
    } finally {
      setLoading(false)
      setUploadPercent(0)
    }
  }

  if (created) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h1 className="font-serif text-4xl text-gray-900 mb-3">Ressource soumise !</h1>
        <p className="text-gray-500 text-sm mb-2">
          <span className="font-medium text-gray-800">{created.title}</span> a été ajoutée avec succès.
        </p>
        <p className="text-gray-400 text-xs mb-8">
          Elle sera visible dans le catalogue après validation par un administrateur.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setCreated(null)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Upload size={15} /> Ajouter une autre ressource
          </button>
          <Link to="/resources" className="btn-primary inline-flex items-center gap-2">
            Voir le catalogue <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <p className="eyebrow mb-3">Contribution</p>
        <h1 className="font-serif text-[40px] sm:text-5xl text-gray-900 leading-[1.05]">
          Ajouter une ressource
        </h1>
        <p className="text-sm text-gray-500 mt-3 max-w-xl">
          Partagez un document, une vidéo ou un lien avec la communauté Learnly.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800">Informations générales</h2>

          <Field label="Titre" required>
            <input className="input" value={form.title} onChange={set('title')} required />
          </Field>

          <Field label="Description">
            <textarea className="input min-h-[90px] resize-y" value={form.description} onChange={set('description')} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Niveau">
              <select className="input text-sm" value={form.level} onChange={set('level')}>
                {LEVELS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </Field>
            <Field label="Format" required>
              <select className="input text-sm" value={form.format} onChange={set('format')}>
                {FORMATS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </Field>
            <Field label="Langue">
              <select className="input text-sm" value={form.language} onChange={set('language')}>
                {LANGUAGES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Catégorie">
            <select className="input text-sm" value={form.category} onChange={set('category')}>
              <option value="">— Choisir —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Tags (séparés par des virgules)">
            <input className="input" value={form.tags} onChange={set('tags')}
              placeholder="ex: algèbre, matrices, linux" />
          </Field>
        </div>

        {/* File / URL */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800">Contenu</h2>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {[['file', <FileText size={14} />, 'Fichier local'], ['url', <LinkIcon size={14} />, 'URL externe']].map(([mode, icon, label]) => (
              <button
                key={mode} type="button"
                onClick={() => setUploadMode(mode)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 font-medium transition-colors ${
                  uploadMode === mode ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {uploadMode === 'file' ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <input
                type="file" id="file-upload"
                className="sr-only"
                onChange={e => setFile(e.target.files[0])}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Cliquer pour choisir un fichier'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {file
                    ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                    : 'PDF, vidéo, audio, ZIP — aucune limite de taille'}
                </p>
              </label>
            </div>
          ) : (
            <Field label="URL de la ressource" required>
              <input className="input" type="url" value={externalUrl}
                onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." required={uploadMode === 'url'} />
            </Field>
          )}
        </div>

        {/* DCAT Metadata */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800">Métadonnées DCAT <span className="text-gray-400 font-normal text-sm">(optionnel)</span></h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Éditeur">
              <input className="input text-sm" value={form.dcat_publisher} onChange={set('dcat_publisher')} />
            </Field>
            <Field label="Licence">
              <input className="input text-sm" value={form.dcat_license} onChange={set('dcat_license')}
                placeholder="CC BY 4.0" />
            </Field>
          </div>
          <Field label="Mots-clés DCAT (séparés par des virgules)">
            <input className="input text-sm" value={form.dcat_keywords} onChange={set('dcat_keywords')} />
          </Field>
        </div>

        <div className="space-y-2">
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
            {loading
              ? uploadPercent > 0 && uploadPercent < 100
                ? `Envoi… ${uploadPercent}%`
                : 'Traitement en cours…'
              : 'Publier la ressource'}
          </button>

          {loading && uploadPercent > 0 && (
            <div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gray-900 rounded-full transition-all duration-200"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center mt-1.5">
                {uploadPercent < 100 ? `${uploadPercent}% envoyé` : 'Finalisation…'}
              </p>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
