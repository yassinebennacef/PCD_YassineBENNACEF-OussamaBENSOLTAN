import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { resourcesApi, feedbackApi, authApi, contextApi, llmApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useCompleted } from '../context/CompletedContext'
import { useBookmarked } from '../context/BookmarkedContext'
import {
  Star, Eye, Download, ChevronLeft, ChevronRight,
  MessageSquare, Send, Loader2, ExternalLink, FileText, Plus, Minus,
  Play, Pause, Volume1, Volume2, VolumeX, Maximize2, Minimize2,
  RotateCcw, RotateCw, WifiOff, Wifi, Sparkles, BookOpen, ChevronDown, ChevronUp, CheckCircle2, Circle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker — bundled with pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function netStatus(kbps) {
  if (!kbps) return null
  if (kbps < 512)  return 'very_slow'
  if (kbps < 2048) return 'slow'
  return 'good'
}

function VideoPlayer({
  src, poster, onFirstPlay, onEnd,
  initialPosition = 0, networkQuality = null, onPositionUpdate = null,
}) {
  const videoRef        = useRef(null)
  const progressRef     = useRef(null)
  const containerRef    = useRef(null)
  const hideTimer       = useRef(null)
  const saveTimer       = useRef(null)
  const playedOnce      = useRef(false)
  const isDragging      = useRef(false)
  const initPosRef      = useRef(initialPosition)

  const [playing,          setPlaying]         = useState(false)
  const [currentTime,      setCurrentTime]     = useState(0)
  const [duration,         setDuration]        = useState(0)
  const [volume,           setVolume]          = useState(1)
  const [muted,            setMuted]           = useState(false)
  const [fullscreen,       setFullscreen]      = useState(false)
  const [buffering,        setBuffering]       = useState(true)
  const [error,            setError]           = useState(false)
  const [showControls,     setShowControls]    = useState(true)
  const [speed,            setSpeed]           = useState(1)
  const [showSpeeds,       setShowSpeeds]      = useState(false)
  const [showResumeBanner, setShowResumeBanner] = useState(false)

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      if (!playedOnce.current) { playedOnce.current = true; onFirstPlay?.() }
    } else {
      v.pause()
    }
  }, [onFirstPlay])

  // --- Seek: pointer capture so dragging works even off the bar ---
  const seekFromEvent = (e) => {
    const v   = videoRef.current
    const bar = progressRef.current
    if (!v || !bar) return
    const rect  = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = ratio * (v.duration || 0)
    setCurrentTime(v.currentTime)
  }

  const handlePointerDown = (e) => {
    isDragging.current = true
    progressRef.current.setPointerCapture(e.pointerId)
    seekFromEvent(e)
  }

  const handlePointerMove = (e) => {
    if (isDragging.current) seekFromEvent(e)
  }

  const handlePointerUp = () => { isDragging.current = false }

  // --- Skip ±5 s ---
  const skip = (delta) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
  }

  // --- Volume ---
  const handleVolume = (e) => {
    const v   = videoRef.current
    const vol = parseFloat(e.target.value)
    v.volume = vol
    v.muted  = vol === 0
    setVolume(vol)
    setMuted(vol === 0)
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  // --- Speed ---
  const applySpeed = (s) => {
    const v = videoRef.current
    if (v) v.playbackRate = s
    setSpeed(s)
    setShowSpeeds(false)
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    applySpeed(next)
  }

  // --- Fullscreen ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  // --- Controls auto-hide ---
  const revealControls = () => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !showSpeeds)
        setShowControls(false)
    }, 3000)
  }

  // --- Native video events ---
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const on  = (ev, fn) => v.addEventListener(ev, fn)
    const off = (ev, fn) => v.removeEventListener(ev, fn)

    const onMeta    = () => {
      setDuration(v.duration)
      const pos = initPosRef.current
      if (pos > 5) {
        v.currentTime = pos
        setCurrentTime(pos)
        setShowResumeBanner(true)
        setTimeout(() => setShowResumeBanner(false), 8000)
      }
    }
    const onTime    = () => { if (!isDragging.current) setCurrentTime(v.currentTime) }
    const onPlay    = () => { setPlaying(true);  revealControls() }
    const onPause   = () => {
      setPlaying(false)
      setShowControls(true)
      onPositionUpdate?.(Math.floor(v.currentTime))
    }
    const onEnded   = () => {
      setPlaying(false)
      setShowControls(true)
      onPositionUpdate?.(0)
      onEnd?.()
    }
    const onWait    = () => setBuffering(true)
    const onCanPlay = () => setBuffering(false)
    const onErr     = () => setError(true)
    const onFull    = () => setFullscreen(!!document.fullscreenElement)

    on('loadedmetadata', onMeta)
    on('timeupdate',     onTime)
    on('play',           onPlay)
    on('pause',          onPause)
    on('ended',          onEnded)
    on('waiting',        onWait)
    on('canplay',        onCanPlay)
    on('error',          onErr)
    document.addEventListener('fullscreenchange', onFull)

    return () => {
      off('loadedmetadata', onMeta)
      off('timeupdate',     onTime)
      off('play',           onPlay)
      off('pause',          onPause)
      off('ended',          onEnded)
      off('waiting',        onWait)
      off('canplay',        onCanPlay)
      off('error',          onErr)
      document.removeEventListener('fullscreenchange', onFull)
      clearTimeout(hideTimer.current)
    }
  }, [onEnd])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space')      { e.preventDefault(); togglePlay() }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); skip(-5) }
      if (e.code === 'ArrowRight') { e.preventDefault(); skip(5) }
      if (e.code === 'KeyM')       toggleMute()
      if (e.code === 'KeyF')       toggleFullscreen()
      if (e.code === 'KeyS')       cycleSpeed()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [togglePlay, speed])

  // --- Periodic position save every 5 s while playing ---
  useEffect(() => {
    if (playing && onPositionUpdate) {
      saveTimer.current = setInterval(() => {
        const v = videoRef.current
        if (v) onPositionUpdate(Math.floor(v.currentTime))
      }, 5000)
    } else {
      clearInterval(saveTimer.current)
    }
    return () => clearInterval(saveTimer.current)
  }, [playing, onPositionUpdate])

  // --- Save position on unmount ---
  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v && onPositionUpdate && v.currentTime > 5) {
        onPositionUpdate(Math.floor(v.currentTime))
      }
    }
  }, [onPositionUpdate])

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  if (error) return (
    <div className="aspect-video bg-gray-900 rounded-xl flex flex-col items-center justify-center gap-2">
      <p className="text-gray-400 text-sm">Impossible de lire la vidéo.</p>
      <a href={src} download className="text-xs text-gray-500 underline">Télécharger</a>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden select-none"
      onMouseMove={revealControls}
      onMouseLeave={() => { if (playing) setShowControls(false); setShowSpeeds(false) }}
    >
      {/* Network quality banner */}
      {(() => {
        const ns = netStatus(networkQuality?.download_kbps)
        if (!ns || ns === 'good') return null
        return (
          <div className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-1.5 text-xs font-medium
            ${ns === 'very_slow' ? 'bg-red-600/90' : 'bg-orange-500/90'} text-white`}>
            {ns === 'very_slow' ? <WifiOff size={12} /> : <Wifi size={12} />}
            {ns === 'very_slow'
              ? `Connexion très lente (${Math.round(networkQuality.download_kbps)} kbps) — Téléchargez la vidéo pour une meilleure expérience.`
              : `Connexion limitée (${Math.round(networkQuality.download_kbps)} kbps) — La vidéo pourrait se mettre en pause.`
            }
          </div>
        )
      })()}

      {/* Resume banner */}
      {showResumeBanner && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2
          bg-gray-900/90 text-white text-xs px-3 py-2 rounded-full shadow-lg pointer-events-auto">
          <RotateCcw size={12} />
          Reprise à {fmt(initialPosition)}
          <button onClick={() => setShowResumeBanner(false)}
            className="ml-1 text-white/50 hover:text-white leading-none">×</button>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        preload={netStatus(networkQuality?.download_kbps) === 'very_slow' ? 'none' : 'metadata'}
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={40} className="animate-spin text-white/60" />
        </div>
      )}

      {/* Big play overlay when paused */}
      {!playing && !buffering && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors"
          aria-label="Lire la vidéo"
        >
          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
            <Play size={28} className="text-gray-900 ml-1" />
          </div>
        </button>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 pb-3 pt-10
          bg-gradient-to-t from-black/80 via-black/30 to-transparent
          transition-opacity duration-300
          ${showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Seek bar — larger hit area, pointer-capture drag */}
        <div className="w-full py-2 cursor-pointer group/seek"
          ref={progressRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider" aria-label="Progression" aria-valuenow={Math.round(pct)}
        >
          <div className="w-full h-1 group-hover/seek:h-[5px] bg-white/25 rounded-full transition-all duration-150 relative">
            <div className="h-full bg-white rounded-full relative" style={{ width: `${pct}%` }}>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md
                scale-0 group-hover/seek:scale-100 transition-transform pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center gap-2">

          {/* Rewind 5s */}
          <button onClick={() => skip(-5)}
            className="text-white hover:text-gray-200 transition-colors flex items-center gap-0.5"
            aria-label="Reculer 5 secondes"
          >
            <RotateCcw size={15} />
            <span className="text-[10px] font-semibold leading-none">5</span>
          </button>

          {/* Play / Pause */}
          <button onClick={togglePlay} className="text-white hover:text-gray-200 transition-colors mx-0.5" aria-label={playing ? 'Pause' : 'Lire'}>
            {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          {/* Forward 5s */}
          <button onClick={() => skip(5)}
            className="text-white hover:text-gray-200 transition-colors flex items-center gap-0.5"
            aria-label="Avancer 5 secondes"
          >
            <span className="text-[10px] font-semibold leading-none">5</span>
            <RotateCw size={15} />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol ml-1">
            <button onClick={toggleMute} className="text-white hover:text-gray-200 transition-colors" aria-label="Muet">
              {muted || volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolume}
              className="w-0 group-hover/vol:w-16 overflow-hidden transition-all duration-200 h-1 accent-white cursor-pointer"
              aria-label="Volume"
            />
          </div>

          {/* Timestamp */}
          <span className="text-white/70 text-xs tabular-nums ml-auto">
            {fmt(currentTime)} <span className="text-white/30">/</span> {fmt(duration)}
          </span>

          {/* Speed picker */}
          <div className="relative">
            {showSpeeds && (
              <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 rounded-lg overflow-hidden shadow-xl border border-white/10 min-w-[72px]">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => applySpeed(s)}
                    className={`w-full px-3 py-1.5 text-xs text-left transition-colors
                      ${speed === s ? 'bg-white/15 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  >
                    {s === 1 ? 'Normal' : `${s}×`}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowSpeeds(v => !v)}
              className="text-white/70 hover:text-white transition-colors text-xs font-semibold tabular-nums px-1 py-0.5 rounded hover:bg-white/10"
              aria-label="Vitesse de lecture"
            >
              {speed === 1 ? '1×' : `${speed}×`}
            </button>
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-gray-200 transition-colors" aria-label="Plein écran">
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function PdfViewer({ src }) {
  const [numPages, setNumPages]   = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale]         = useState(1)
  const [error, setError]         = useState(false)
  const [width, setWidth]         = useState(0)
  const wrapRef                   = useRef(null)

  const proxied = src ? src.replace(/^https?:\/\/[^/]+/, '') : ''

  // Memoize file prop so react-pdf doesn't refetch on every render
  const fileProp = useMemo(() => ({ url: proxied }), [proxied])

  useEffect(() => {
    const update = () => {
      if (wrapRef.current) setWidth(wrapRef.current.clientWidth - 32) // padding
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  if (!proxied) return null

  const goPrev   = () => setPageNumber(p => Math.max(1, p - 1))
  const goNext   = () => setPageNumber(p => Math.min(numPages || 1, p + 1))
  const zoomIn   = () => setScale(s => Math.min(3, +(s + 0.1).toFixed(2)))
  const zoomOut  = () => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(2)))
  const openTab  = () => window.open(proxied, '_blank', 'noopener,noreferrer')

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-gray-500" />
          <span className="text-gray-500 font-medium">Document PDF</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Page nav */}
          {numPages && (
            <div className="flex items-center gap-1">
              <button onClick={goPrev} disabled={pageNumber <= 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-default transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="tabular-nums text-gray-700 font-medium min-w-[3.5rem] text-center">
                {pageNumber} / {numPages}
              </span>
              <button onClick={goNext} disabled={pageNumber >= numPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-default transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
            <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-200 transition-colors">
              <Minus size={13} />
            </button>
            <span className="tabular-nums text-gray-700 font-medium min-w-[2.5rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-200 transition-colors">
              <Plus size={13} />
            </button>
          </div>

          {/* Open in tab */}
          <button onClick={openTab}
            className="border-l border-gray-200 pl-3 text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
            <ExternalLink size={12} /> Onglet
          </button>
        </div>
      </div>

      {/* Document area */}
      <div ref={wrapRef} className="bg-gray-100 overflow-auto flex justify-center p-4"
        style={{ maxHeight: '80vh', minHeight: '420px' }}>
        {error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center">
              <FileText size={26} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 max-w-xs">
              Impossible de charger ce PDF dans la page.
            </p>
            <button onClick={openTab} className="btn-primary inline-flex items-center gap-2">
              <ExternalLink size={14} /> Ouvrir dans un onglet
            </button>
            <a href={proxied} download
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              <Download size={12} /> Télécharger
            </a>
          </div>
        ) : (
          <Document
            file={fileProp}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError(true)}
            loading={
              <div className="flex items-center gap-2 text-sm text-gray-400 py-12">
                <Loader2 size={16} className="animate-spin" /> Chargement du PDF…
              </div>
            }
            error={
              <div className="text-sm text-gray-500 py-12">Impossible de charger le PDF.</div>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={width > 0 ? width * scale : undefined}
              renderTextLayer
              renderAnnotationLayer
              loading={
                <div className="flex items-center gap-2 text-sm text-gray-400 py-12">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              }
              className="shadow-lg"
            />
          </Document>
        )}
      </div>
    </div>
  )
}

function StarRating({ value, onChange, readonly = false, size = 20 }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className="transition-colors disabled:cursor-default"
        >
          <Star
            size={size}
            className={`${(hover || value) >= n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} transition-colors`}
          />
        </button>
      ))}
    </div>
  )
}

function Comment({ comment, currentUser, onDelete }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-xs font-semibold text-white shrink-0">
        {(comment.full_name?.[0] || comment.username?.[0] || '?').toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{comment.full_name || comment.username}</span>
          <span className="text-xs text-gray-400">
            {new Date(comment.created_at).toLocaleDateString('fr-TN')}
          </span>
        </div>
        <p className="text-sm text-gray-700 mt-0.5">{comment.text}</p>
      </div>
      {currentUser?.username === comment.username && (
        <button onClick={() => onDelete(comment.id)} className="text-gray-300 hover:text-red-400 transition-colors">
          ×
        </button>
      )}
    </div>
  )
}

const LEVEL_LABELS = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }

export default function ResourceDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { completedIds, toggleCompleted }   = useCompleted()
  const { bookmarkedIds, toggleBookmarked } = useBookmarked()
  const [resource,        setResource]       = useState(null)
  const [rating,          setRating]         = useState(0)
  const [comments,        setComments]       = useState([])
  const [newComment,      setNewComment]     = useState('')
  const [loading,         setLoading]        = useState(true)
  const [submitting,      setSubmitting]     = useState(false)
  const [videoState,      setVideoState]     = useState(null)
  const [simplified,      setSimplified]     = useState(null)
  const [loadingSimplify,  setLoadingSimplify]  = useState(false)
  const [showSimplified,   setShowSimplified]   = useState(false)
  const [showResumeMenu,   setShowResumeMenu]   = useState(false)
  const [loadingPdf,       setLoadingPdf]       = useState(false)
  const [videoGenStatus,   setVideoGenStatus]   = useState(null)
  const [generatedVideoUrl,setGeneratedVideoUrl]= useState(null)
  const [videoGenError,    setVideoGenError]    = useState(null)
  const generatedVideoRef = useRef(null)

  useEffect(() => {
    Promise.all([
      resourcesApi.detail(id),
      feedbackApi.comments(id),
    ]).then(([res, cmt]) => {
      setResource(res.data)
      const cmtData = cmt.data
      setComments(Array.isArray(cmtData) ? cmtData : cmtData.results ?? [])
      if (res.data?.format === 'video') {
        authApi.videoState(id).then(r => setVideoState(r.data)).catch(() => {})
      }
    }).catch(() => {
      setResource(null)
    }).finally(() => setLoading(false))

    contextApi.logInteraction({ resource: id, event_type: 'view' }).catch(() => {})

    llmApi.videoStatus(id).then(({ data }) => {
      if (data.status === 'ready') {
        setVideoGenStatus('ready')
        setGeneratedVideoUrl(data.url)
      } else if (data.status === 'generating') {
        setVideoGenStatus('generating')
      }
    }).catch(() => {})
  }, [id])

  useEffect(() => {
    if (videoGenStatus !== 'generating') return
    const interval = setInterval(() => {
      llmApi.videoStatus(id).then(({ data }) => {
        if (data.status === 'ready') {
          setVideoGenStatus('ready')
          setGeneratedVideoUrl(data.url)
          toast.success('Vidéo simplifiée prête !')
        } else if (data.status === 'failed') {
          setVideoGenStatus('failed')
          setVideoGenError(data.error || 'Erreur inconnue')
          toast.error(data.error || 'Échec de la génération.', { duration: 10000 })
        }
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [videoGenStatus, id])

  const handleGenerateVideo = async () => {
    setShowResumeMenu(false)
    if (videoGenStatus === 'ready') {
      setTimeout(() => generatedVideoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      return
    }
    if (videoGenStatus === 'generating') return
    try {
      const { data } = await llmApi.generateVideo(id)
      if (data.status === 'ready') {
        setVideoGenStatus('ready')
        setGeneratedVideoUrl(data.url)
      } else {
        setVideoGenStatus('generating')
        toast('Génération de la vidéo en cours… (2-5 min)', { icon: '🎬', duration: 6000 })
      }
    } catch {
      toast.error('Impossible de démarrer la génération.')
    }
  }

  const handlePositionUpdate = useCallback((seconds) => {
    authApi.updateProgress(id, { last_position_seconds: seconds }).catch(() => {})
  }, [id])

  const handleSimplify = async () => {
    if (simplified) { setShowSimplified(v => !v); return }
    setLoadingSimplify(true)
    setShowSimplified(true)
    try {
      const level = videoState?.student_level || 'beginner'
      const { data } = await llmApi.simplify(id, level)
      setSimplified(data.text)
    } catch {
      setSimplified('Impossible de générer la version simplifiée pour le moment.')
    } finally {
      setLoadingSimplify(false)
    }
  }

  const handlePdfSummary = async () => {
    setLoadingPdf(true)
    setShowResumeMenu(false)
    toast('Génération de la fiche en cours…', { icon: '⏳', duration: 8000 })
    try {
      const level = videoState?.student_level || 'beginner'
      const { data } = await llmApi.detailedSummary(id, level)
      const levelLabel = LEVEL_LABELS[level] || level

      // Convert markdown-style headings to HTML
      const formatted = data.text
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')

      const win = window.open('', '_blank')
      win.document.write(`<!DOCTYPE html><html lang="fr"><head>
        <meta charset="UTF-8">
        <title>Fiche — ${resource.title}</title>
        <style>
          *{box-sizing:border-box}
          body{font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:40px auto;padding:0 28px;color:#1a1a1a;line-height:1.75;font-size:14px}
          h1{font-size:28px;font-weight:800;margin:0 0 6px;color:#111}
          .meta{color:#666;font-size:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111}
          h2{font-size:16px;font-weight:700;margin:28px 0 10px;padding:6px 12px;background:#f3f4f6;border-left:4px solid #111;border-radius:0 6px 6px 0}
          h3{font-size:14px;font-weight:600;margin:18px 0 6px;color:#333}
          p{margin:0 0 12px}
          ul{margin:0 0 14px;padding-left:20px}
          li{margin-bottom:5px}
          strong{font-weight:600}
          .footer{margin-top:48px;color:#bbb;font-size:11px;border-top:1px solid #eee;padding-top:12px;display:flex;justify-content:space-between}
          @media print{body{margin:0;max-width:100%} .footer{position:fixed;bottom:0;left:0;right:0;padding:8px 28px}}
        </style>
      </head><body>
        <h1>${resource.title}</h1>
        <div class="meta">
          Niveau : <strong>${levelLabel}</strong> &nbsp;·&nbsp;
          Catégorie : <strong>${resource.category?.name || '–'}</strong> &nbsp;·&nbsp;
          Format : <strong>${(resource.format || '').toUpperCase()}</strong>
        </div>
        <div>${formatted}</div>
        <div class="footer">
          <span>Généré par PILearn · ${new Date().toLocaleDateString('fr-TN')}</span>
          <span>${data.provider}</span>
        </div>
      </body></html>`)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Impossible de générer la fiche PDF.')
    } finally {
      setLoadingPdf(false)
    }
  }


  const handleRate = async (score) => {
    setRating(score)
    await feedbackApi.rate(id, score)
    toast.success('Note enregistrée !')
    const res = await resourcesApi.detail(id)
    setResource(res.data)
  }

  const handleBookmark = async () => {
    const result = await toggleBookmarked(Number(id))
    if (result === true)  toast.success('Ajouté aux favoris !')
    if (result === false) toast('Retiré des favoris.')
  }

  const handleComplete = async () => {
    const result = await toggleCompleted(Number(id))
    if (result === true)  toast.success('Marqué comme complété !')
    if (result === false) toast('Retiré des complétés.')
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const { data } = await feedbackApi.addComment(id, newComment.trim())
      setComments(c => [data, ...c])
      setNewComment('')
    } catch {
      toast.error('Erreur lors de l\'envoi du commentaire.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    await feedbackApi.deleteComment(commentId)
    setComments(c => c.filter(x => x.id !== commentId))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={22} className="animate-spin text-gray-400" />
    </div>
  )

  if (!resource) return (
    <div className="max-w-2xl py-16">
      <p className="eyebrow mb-3">Erreur</p>
      <h1 className="font-serif text-4xl text-gray-900 mb-3">Ressource introuvable.</h1>
      <p className="text-sm text-gray-500 mb-6">Le lien que vous avez suivi n'existe plus, ou a été déplacé.</p>
      <Link to="/resources" className="btn-primary inline-flex">← Retour au catalogue</Link>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto" onClick={() => setShowResumeMenu(false)}>
      {/* Back */}
      <Link to="/resources" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ChevronLeft size={15} /> Retour aux ressources
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header — editorial, no card */}
          <header>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="eyebrow mb-3" onClick={() => setShowResumeMenu(false)}>
                  {resource.format?.toUpperCase()}
                  {resource.level && <> · <span className="text-gray-700">{({beginner:'Débutant',intermediate:'Intermédiaire',advanced:'Avancé'}[resource.level]) || resource.level}</span></>}
                  {resource.category?.name && <> · <span className="text-gray-700">{resource.category.name}</span></>}
                </p>
                <h1 className="font-serif text-[36px] sm:text-[42px] text-gray-900 leading-[1.05]">
                  {resource.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                {/* Résumer dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowResumeMenu(v => !v) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                  >
                    {loadingPdf
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Sparkles size={13} className="text-purple-500" />
                    }
                    Résumer
                    <ChevronDown size={12} className="text-gray-400" />
                  </button>

                  {showResumeMenu && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 w-52 overflow-hidden">
                      <button
                        onClick={handlePdfSummary}
                        disabled={loadingPdf}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {loadingPdf
                          ? <Loader2 size={14} className="animate-spin text-gray-400" />
                          : <FileText size={14} className="text-red-500" />
                        }
                        Résumé PDF
                      </button>
                      <button
                        onClick={handleGenerateVideo}
                        disabled={videoGenStatus === 'generating'}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100 disabled:opacity-50"
                      >
                        {videoGenStatus === 'generating'
                          ? <Loader2 size={14} className="animate-spin text-gray-400" />
                          : <Play size={14} className="text-blue-500" />
                        }
                        {videoGenStatus === 'ready' ? 'Voir la vidéo simplifiée' : 'Version simplifiée'}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleComplete}
                  title={completedIds.has(Number(id)) ? 'Retirer des complétés' : 'Marquer comme complété'}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {completedIds.has(Number(id))
                    ? <CheckCircle2 size={20} className="text-emerald-500" />
                    : <Circle size={20} className="text-gray-400" />
                  }
                </button>
                <button
                  onClick={handleBookmark}
                  title={bookmarkedIds.has(Number(id)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Star
                    size={20}
                    className={bookmarkedIds.has(Number(id))
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-400'}
                  />
                </button>
              </div>
            </div>

            {resource.description && (
              <p className="text-[15px] text-gray-600 leading-relaxed mt-4 max-w-2xl">
                {resource.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-5 text-sm text-gray-500 mt-6 pt-5 border-t border-gray-200">
              <span className="flex items-center gap-1.5"><Eye size={13} /> {resource.view_count} vues</span>
              <span className="flex items-center gap-1.5"><Download size={13} /> {resource.download_count} téléchargements</span>
              <div className="flex items-center gap-1.5">
                <StarRating value={resource.average_rating} readonly size={13} />
                <span className="tabular-nums">{resource.average_rating?.toFixed(1)} <span className="text-gray-400">({resource.rating_count})</span></span>
              </div>
            </div>
          </header>


          {/* Video player */}
          {resource.format === 'video' && resource.file && (
            <VideoPlayer
              src={resource.file}
              poster={resource.thumbnail || undefined}
              initialPosition={videoState?.last_position_seconds ?? 0}
              networkQuality={videoState?.network_quality ?? null}
              onPositionUpdate={handlePositionUpdate}
              onFirstPlay={() => contextApi.logInteraction({ resource: id, event_type: 'view' }).catch(() => {})}
              onEnd={() => contextApi.logInteraction({ resource: id, event_type: 'complete' }).catch(() => {})}
            />
          )}

          {/* Simplified content panel */}
          {resource.format === 'video' && showSimplified && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
              <button
                onClick={() => setShowSimplified(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sparkles size={14} className="text-blue-500" />
                  Version simplifiée — niveau {LEVEL_LABELS[videoState?.student_level] || 'débutant'}
                </span>
                {showSimplified ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <div className="px-4 pb-4 text-sm text-blue-900 leading-relaxed border-t border-blue-200">
                {loadingSimplify ? (
                  <div className="flex items-center gap-2 py-4 text-blue-600">
                    <Loader2 size={15} className="animate-spin" /> Génération en cours…
                  </div>
                ) : (
                  <p className="pt-3 whitespace-pre-line">{simplified}</p>
                )}
              </div>
            </div>
          )}

          {/* PDF viewer */}
          {resource.format === 'pdf' && resource.file && (
            <PdfViewer src={resource.file} />
          )}

          {/* Generated simplified video */}
          {videoGenStatus === 'generating' && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-6 flex items-center justify-center gap-3 text-purple-700">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-medium">Génération de la vidéo simplifiée en cours… (2–5 min)</span>
            </div>
          )}

          {videoGenStatus === 'failed' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">Échec de la génération</span>
                <button onClick={() => { setVideoGenStatus(null); setVideoGenError(null) }} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
              {videoGenError && <p className="text-xs text-red-600 font-mono break-all mt-1">{videoGenError}</p>}
            </div>
          )}

          {videoGenStatus === 'ready' && generatedVideoUrl && (
            <div ref={generatedVideoRef} className="rounded-xl border border-purple-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-purple-50 border-b border-purple-200">
                <span className="text-sm font-medium text-purple-800 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-500" />
                  Vidéo simplifiée par IA
                </span>
                <button onClick={() => setVideoGenStatus(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>
              <div className="p-4">
                <VideoPlayer src={generatedVideoUrl} />
              </div>
            </div>
          )}

          {/* Rating section */}
          <div className="card">
            <h3 className="font-serif text-xl text-gray-900 mb-3">Votre note</h3>
            <StarRating value={rating} onChange={handleRate} />
          </div>

          {/* Comments */}
          <div className="card">
            <h3 className="font-serif text-xl text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-gray-500" /> Commentaires
              <span className="text-sm text-gray-400 font-sans font-normal">· {comments.length}</span>
            </h3>

            <form onSubmit={handleComment} className="flex gap-2 mb-5">
              <input
                className="input flex-1 text-sm"
                placeholder="Laisser un commentaire..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <button type="submit" disabled={submitting} className="btn-primary px-3">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </form>

            <div className="space-y-4">
              {comments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Aucun commentaire pour l'instant. Soyez le premier !
                </p>
              )}
              {comments.map(c => (
                <Comment key={c.id} comment={c} currentUser={user} onDelete={handleDeleteComment} />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Download / Access */}
          <div className="card space-y-3">
            <p className="eyebrow">Accès</p>
            {resource.file && (() => {
              const inline = ['video', 'pdf'].includes(resource.format)
              const label  = resource.format === 'video' ? 'Télécharger la vidéo'
                           : resource.format === 'pdf'   ? 'Télécharger le PDF'
                           : 'Télécharger'
              return (
                <a
                  href={resource.file}
                  download
                  onClick={() => contextApi.logInteraction({ resource: id, event_type: 'download' }).catch(() => {})}
                  className={`${inline ? 'btn-secondary' : 'btn-primary'} w-full justify-center text-sm`}
                >
                  <Download size={15} /> {label}
                </a>
              )
            })()}
            {resource.external_url && (
              <a href={resource.external_url} target="_blank" rel="noreferrer"
                className="btn-secondary w-full justify-center text-sm">
                <ExternalLink size={15} /> Ouvrir en ligne
              </a>
            )}
          </div>

          {/* DCAT Metadata */}
          <div className="card text-xs space-y-2">
            <p className="eyebrow mb-2">Métadonnées · DCAT</p>
            {[
              ['Éditeur', resource.dcat_publisher],
              ['Licence', resource.dcat_license],
              ['Date de publication', resource.dcat_issued],
              ['Mis à jour', resource.dcat_modified],
              ['Identifiant', resource.dcat_identifier],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 shrink-0">{k}:</span>
                <span className="text-gray-700 break-all">{v}</span>
              </div>
            ))}
            {resource.dcat_keywords?.length > 0 && (
              <div>
                <span className="text-gray-500">Mots-clés: </span>
                <span className="text-gray-700">{resource.dcat_keywords.join(', ')}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
