import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExerciseRenderer from './three/ExerciseRenderer'
import ExerciseVideoLoop from './components/ExerciseVideoLoop'
import calistenichsConfig from './config/calistenichs.json'
import pilatesConfig from './config/pilates.json'

const TRAINING_CONFIGS = {
  calistenichs: {
    label: 'Calistenichs',
    config: calistenichsConfig
  },
  pilates: {
    label: 'Pilates',
    config: pilatesConfig
  }
}

function formatTime(totalSeconds) {
  const value = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function parseYouTubeVideoId(url = '') {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '')
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || ''
    return ''
  } catch {
    return ''
  }
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api'

function ensureYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    const existing = document.querySelector(`script[src="${YT_API_SRC}"]`)
    if (existing) return
    const script = document.createElement('script')
    script.src = YT_API_SRC
    script.async = true
    document.head.appendChild(script)
  })
}

function getEditMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('edit') === '1'
}

function getSplashModeFromUrl() {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('splash')
  if (value == null) return null
  const normalized = String(value).trim().toLowerCase()
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true
  return null
}

function scaleReps(reps, factor) {
  if (typeof reps !== 'string') return reps
  return reps.replace(/\d+(\.\d+)?/g, (match) => {
    const num = Number(match)
    if (!Number.isFinite(num)) return match
    return String(Math.max(1, Math.round(num * factor)))
  })
}

function normalizeCard(card, classKey) {
  return {
    ...card,
    classKey,
    viewerType: card.viewerType || '3d'
  }
}

function orderByClass(cards) {
  const rank = { warmup: 1, esercizio: 2, stretching: 3 }
  return [...cards].sort((a, b) => (rank[a.classKey] || 99) - (rank[b.classKey] || 99))
}

function sanitizeCard(card) {
  const base = { ...card }
  delete base.setsScaled
  delete base.durationScaledSec
  delete base.repsScaled
  delete base.video
  delete base.videoSegment
  return base
}

function cardsFromAllenamento(allenamento) {
  const fromCards = Array.isArray(allenamento?.cards) ? allenamento.cards : null
  if (fromCards?.length) {
    return orderByClass(
      fromCards.map((card) => normalizeCard({ ...card }, card.classKey || 'esercizio'))
    )
  }

  const warmup = (allenamento?.warmup || []).map((c) => normalizeCard({ ...c }, 'warmup'))
  const esercizi = (allenamento?.esercizi || []).map((c) => normalizeCard({ ...c }, 'esercizio'))
  const stretching = (allenamento?.stretching || []).map((c) => normalizeCard({ ...c }, 'stretching'))
  return orderByClass([...warmup, ...esercizi, ...stretching])
}

function getProgramStorageKey(trainingKey) {
  return `ginnastica.program.json.${trainingKey}`
}

function getSegmentsStorageKey(trainingKey) {
  return `ginnastica.program.videoSegments.${trainingKey}`
}

function getCameraViewsStorageKey(trainingKey) {
  return `ginnastica.program.cameraViews.${trainingKey}`
}

function readSavedProgramCards(trainingKey) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getProgramStorageKey(trainingKey))
      || (trainingKey === 'calistenichs' ? window.localStorage.getItem('ginnastica.program.json') : null)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return cardsFromAllenamento(parsed?.allenamento)
  } catch {
    return null
  }
}

function toExportProgram(cards, levels, videoSources = []) {
  const normalizedCards = orderByClass(cards.map(sanitizeCard))
  return {
    videoSources,
    allenamento: {
      livelli: levels,
      cards: normalizedCards,
      warmup: normalizedCards.filter((c) => c.classKey === 'warmup').map(sanitizeCard),
      esercizi: normalizedCards.filter((c) => c.classKey === 'esercizio').map(sanitizeCard),
      stretching: normalizedCards.filter((c) => c.classKey === 'stretching').map(sanitizeCard)
    }
  }
}

function readStoredVideoSegments(trainingKey) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(getSegmentsStorageKey(trainingKey))
      || (trainingKey === 'calistenichs' ? window.localStorage.getItem('ginnastica.program.videoSegments') : null)
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }

    const programRaw = window.localStorage.getItem(getProgramStorageKey(trainingKey))
      || (trainingKey === 'calistenichs' ? window.localStorage.getItem('ginnastica.program.json') : null)
    if (!programRaw) return {}
    const programParsed = JSON.parse(programRaw)
    const segments = programParsed?.videoSegments
    return segments && typeof segments === 'object' ? segments : {}
  } catch {
    return {}
  }
}

function readStoredCameraViews(trainingKey) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(getCameraViewsStorageKey(trainingKey))
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }

    const programRaw = window.localStorage.getItem(getProgramStorageKey(trainingKey))
      || (trainingKey === 'calistenichs' ? window.localStorage.getItem('ginnastica.program.json') : null)
    if (!programRaw) return {}
    const programParsed = JSON.parse(programRaw)
    const cameraViews = programParsed?.cameraViews
    return cameraViews && typeof cameraViews === 'object' ? cameraViews : {}
  } catch {
    return {}
  }
}

function normalizeCameraView(cameraView) {
  if (!cameraView || typeof cameraView !== 'object') return null
  const camera = Array.isArray(cameraView.camera) ? cameraView.camera.map(Number) : null
  const target = Array.isArray(cameraView.target) ? cameraView.target.map(Number) : null
  if (!camera || !target || camera.length !== 3 || target.length !== 3) return null
  if (![...camera, ...target].every((v) => Number.isFinite(v))) return null
  return {
    camera: camera.map((v) => Number(v.toFixed(3))),
    target: target.map((v) => Number(v.toFixed(3)))
  }
}

function getSavedVideoSegment(cardId, defaultVideoUrl, storedSegments = {}) {
  const fromProgram = storedSegments?.[cardId]
  if (fromProgram && typeof fromProgram === 'object') {
    const start = Number.isFinite(Number(fromProgram.start)) ? Number(fromProgram.start) : 0
    const end = Number.isFinite(Number(fromProgram.end)) ? Number(fromProgram.end) : start + 20
    return {
      url: typeof fromProgram.videoUrl === 'string' && fromProgram.videoUrl ? fromProgram.videoUrl : defaultVideoUrl || '',
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : Math.max(1, (Number.isFinite(start) ? start : 0) + 20)
    }
  }

  if (typeof window === 'undefined') return { url: defaultVideoUrl, start: 0, end: 20 }
  try {
    const raw = window.localStorage.getItem(`ginnastica.videoLoop.${cardId}`)
    if (!raw) return { url: defaultVideoUrl, start: 0, end: 20 }
    const parsed = JSON.parse(raw)
    const start = Number.isFinite(Number(parsed.start)) ? Number(parsed.start) : 0
    const end = Number.isFinite(Number(parsed.end)) ? Number(parsed.end) : start + 20
    return {
      url: typeof parsed.videoUrl === 'string' && parsed.videoUrl ? parsed.videoUrl : defaultVideoUrl || '',
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : Math.max(1, (Number.isFinite(start) ? start : 0) + 20)
    }
  } catch {
    return { url: defaultVideoUrl, start: 0, end: 20 }
  }
}

function getSavedCameraView(cardId, animationType, storedCameraViews = {}) {
  const fromStored = normalizeCameraView(storedCameraViews?.[cardId])
  if (fromStored) return fromStored
  if (typeof window === 'undefined') return null

  try {
    const legacyByCardRaw = window.localStorage.getItem(`ginnastica.camera.card.${cardId}`)
    if (legacyByCardRaw) {
      const legacyByCard = normalizeCameraView(JSON.parse(legacyByCardRaw))
      if (legacyByCard) return legacyByCard
    }
  } catch {
    // ignore malformed legacy payload
  }

  try {
    const legacyByTypeRaw = window.localStorage.getItem(`ginnastica.camera.${animationType}`)
    if (legacyByTypeRaw) {
      const legacyByType = normalizeCameraView(JSON.parse(legacyByTypeRaw))
      if (legacyByType) return legacyByType
    }
  } catch {
    // ignore malformed legacy payload
  }
  return null
}

function SegmentVideoViewer({ cardId, videoSegment }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const loopRef = useRef(null)
  const [playerReady, setPlayerReady] = useState(false)
  const videoId = parseYouTubeVideoId(videoSegment?.url || '')
  const start = Math.max(0, Number(videoSegment?.start || 0))
  const end = Math.max(start + 1, Number(videoSegment?.end || start + 20))

  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined
    let cancelled = false
    setPlayerReady(false)

    ensureYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return
      if (playerRef.current?.destroy) playerRef.current.destroy()

      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          playsinline: 1,
          autoplay: 1,
          mute: 1
        },
        events: {
          onReady: () => {
            const p = playerRef.current
            if (!p?.seekTo) return
            p.seekTo(start, true)
            p.playVideo()
            setPlayerReady(true)
          }
        }
      })
    })

    return () => {
      cancelled = true
      if (loopRef.current) {
        window.clearInterval(loopRef.current)
        loopRef.current = null
      }
      if (playerRef.current?.destroy) playerRef.current.destroy()
      playerRef.current = null
    }
  }, [videoId, start])

  useEffect(() => {
    if (!playerReady || !playerRef.current?.getCurrentTime) return undefined
    if (loopRef.current) {
      window.clearInterval(loopRef.current)
      loopRef.current = null
    }
    loopRef.current = window.setInterval(() => {
      const p = playerRef.current
      if (!p?.getCurrentTime || !p?.seekTo) return
      const now = p.getCurrentTime()
      if (now >= end) {
        p.seekTo(start, true)
        p.playVideo?.()
      }
    }, 200)

    return () => {
      if (loopRef.current) {
        window.clearInterval(loopRef.current)
        loopRef.current = null
      }
    }
  }, [start, end, cardId, videoId, playerReady])

  if (!videoId) return <div className="figure-card">Video non configurato</div>
  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
}

function CardViewer({ card }) {
  if (card.viewerType === 'video') {
    return (
      <div className="figure-card figure-card-3d">
        <SegmentVideoViewer cardId={card.id} videoSegment={card.videoSegment} />
      </div>
    )
  }
  return (
    <ExerciseRenderer
      cardId={card.id}
      type={card.animationType}
      cameraView={card.cameraView}
      onCameraSaved={(payload) => card.onCameraSaved?.(card.id, payload)}
      clipName={card.clipName}
      onClipSelected={(value) => card.onClipSelected?.(card.id, value)}
    />
  )
}

function ProgramCard({ card }) {
  return (
    <section className="panel compact-panel detail program-card">
      <div className="detail-head">
        <div className="card-meta-col">
          <p className="hint">Classe: {card.classKey}</p>
          <div className="title-inline">
            <h3>{card.name}</h3>
            <p className="timer-chip">Timer scheda: {formatTime(card.durationScaledSec)}</p>
          </div>
          <p className="hint">{card.type} • {card.setsScaled} serie • {card.repsScaled || card.reps}</p>
          <p className="hint">Clip FBX: {card.clipName || '-'}</p>

          <div className="vertical-sections">
            <article>
              <h4>Esecuzione</h4>
              <ul>{(card.execution || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <h4>Errori</h4>
              <ul>{(card.mistakes || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <h4>Respirazione</h4>
              <p>{card.breathing}</p>
            </article>
          </div>
        </div>
        <CardViewer card={card} />
      </div>
    </section>
  )
}

export default function App() {
  const [activeView, setActiveView] = useState('trainer')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'maschio'
    const saved = window.localStorage.getItem('ginnastica.theme')
    return saved === 'femmina' ? 'femmina' : 'maschio'
  })
  const [trainingKey, setTrainingKey] = useState(() => {
    if (typeof window === 'undefined') return 'calistenichs'
    const saved = window.localStorage.getItem('ginnastica.training.key')
    return TRAINING_CONFIGS[saved] ? saved : 'calistenichs'
  })
  const [level, setLevel] = useState('base')
  const [playMode, setPlayMode] = useState(false)
  const [playRunning, setPlayRunning] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [currentRemaining, setCurrentRemaining] = useState(0)

  const isEditMode = getEditMode()
  const logoSrc = `${import.meta.env.BASE_URL}decathlon.svg`
  const splashImageSrc = `${import.meta.env.BASE_URL}sports-icons-vector.jpg`

  const appConfig = TRAINING_CONFIGS[trainingKey]?.config || calistenichsConfig
  const trainingLabel = TRAINING_CONFIGS[trainingKey]?.label || trainingKey
  const allCfg = appConfig?.allenamento || {}
  const defaultVideoUrl = appConfig.videoSources?.[0] || ''
  const [storedSegments, setStoredSegments] = useState({})
  const [storedCameraViews, setStoredCameraViews] = useState({})
  const levels = allCfg.livelli || {}
  const levelCfg = levels[level] || Object.values(levels)[0] || { setMultiplier: 1, durationMultiplier: 1 }
  const splashUrlMode = getSplashModeFromUrl()
  const splashEnabled = splashUrlMode ?? (appConfig?.ui?.splashEnabled !== false)
  const splashDurationMs = Math.min(3000, Math.max(0, Number(appConfig?.ui?.splashDurationMs ?? 2000)))
  const [showSplash, setShowSplash] = useState(() => splashEnabled)

  const [programCardsBase, setProgramCardsBase] = useState([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ginnastica.training.key', trainingKey)
    }

    const saved = readSavedProgramCards(trainingKey)
    const fromConfig = cardsFromAllenamento(allCfg)
    setProgramCardsBase(saved?.length ? saved : fromConfig)

    const segments = readStoredVideoSegments(trainingKey)
    setStoredSegments(segments)
    const cameraViews = readStoredCameraViews(trainingKey)
    setStoredCameraViews(cameraViews)
    setPlayMode(false)
    setPlayRunning(false)
    setPlayIndex(0)

  }, [trainingKey, allCfg])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('ginnastica.theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const levelKeys = Object.keys(levels)
    if (levelKeys.length && !levels[level]) setLevel(levelKeys[0])
  }, [levels, level])

  useEffect(() => {
    if (!showSplash) return undefined
    const timeoutId = window.setTimeout(() => setShowSplash(false), splashDurationMs)
    return () => window.clearTimeout(timeoutId)
  }, [showSplash, splashDurationMs])

  const programCards = useMemo(() => {
    const setMultiplier = levelCfg?.setMultiplier || 1
    const durationMultiplier = levelCfg?.durationMultiplier || 1
    return orderByClass(
      programCardsBase.map((card) => ({
        ...card,
        videoSegment: getSavedVideoSegment(card.id, defaultVideoUrl, storedSegments),
        cameraView: getSavedCameraView(card.id, card.animationType, storedCameraViews),
        setsScaled: Math.max(1, Math.round((card.sets || 1) * setMultiplier)),
        durationScaledSec: Math.max(20, Math.round((card.durationSec || 60) * durationMultiplier)),
        repsScaled: scaleReps(card.reps || '', durationMultiplier)
      }))
    )
  }, [programCardsBase, levelCfg, defaultVideoUrl, storedSegments, storedCameraViews])

  const [selectedCardId, setSelectedCardId] = useState(programCards[0]?.id || '')

  useEffect(() => {
    if (!programCards.some((c) => c.id === selectedCardId)) setSelectedCardId(programCards[0]?.id || '')
  }, [programCards, selectedCardId])

  const selectedCard = programCards.find((c) => c.id === selectedCardId) || programCards[0]

  const totalProgramSec = useMemo(
    () => programCards.reduce((sum, item) => sum + item.durationScaledSec, 0),
    [programCards]
  )

  useEffect(() => {
    if (!playMode) {
      setPlayIndex(0)
      setTotalRemaining(totalProgramSec)
      setCurrentRemaining(selectedCard?.durationScaledSec || 0)
      return
    }
    if (currentRemaining <= 0) setCurrentRemaining(programCards[playIndex]?.durationScaledSec || 0)
  }, [playMode, totalProgramSec, programCards, playIndex, currentRemaining, selectedCard])

  useEffect(() => {
    if (!playMode || !playRunning) return undefined
    const id = window.setInterval(() => {
      setTotalRemaining((v) => Math.max(0, v - 1))
      setCurrentRemaining((remaining) => {
        if (remaining > 1) return remaining - 1
        setPlayIndex((index) => {
          const next = index + 1
          if (next >= programCards.length) {
            setPlayRunning(false)
            setPlayMode(false)
            return 0
          }
          setCurrentRemaining(programCards[next].durationScaledSec)
          setSelectedCardId(programCards[next].id)
          return next
        })
        return 0
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [playMode, playRunning, programCards])

  const currentCard = playMode ? programCards[playIndex] : selectedCard

  const startPlay = () => {
    if (!programCards.length) return
    setPlayMode(true)
    setPlayRunning(true)
    setPlayIndex(0)
    setSelectedCardId(programCards[0].id)
    setTotalRemaining(totalProgramSec)
    setCurrentRemaining(programCards[0].durationScaledSec)
  }

  const stopPlay = () => {
    setPlayMode(false)
    setPlayRunning(false)
    setPlayIndex(0)
    setTotalRemaining(totalProgramSec)
    setCurrentRemaining(selectedCard?.durationScaledSec || 0)
  }

  const handleCameraSaved = useCallback((cardId, viewPayload) => {
    const normalized = normalizeCameraView(viewPayload)
    if (!normalized) return
    setStoredCameraViews((prev) => {
      const next = {
        ...prev,
        [cardId]: {
          ...normalized,
          savedAt: new Date().toISOString()
        }
      }
      try {
        window.localStorage.setItem(getCameraViewsStorageKey(trainingKey), JSON.stringify(next))
        window.localStorage.setItem(`ginnastica.camera.card.${cardId}`, JSON.stringify(next[cardId]))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [trainingKey])

  const handleClipSelected = useCallback((cardId, clipName) => {
    if (!clipName) return
    setProgramCardsBase((cards) => cards.map((c) => (c.id === cardId ? { ...c, clipName } : c)))
  }, [])

  const saveProgramJson = () => {
    const storageSegments = readStoredVideoSegments(trainingKey)
    const computedSegments = {}
    for (const card of programCards) {
      const seg = card.videoSegment || {}
      computedSegments[card.id] = {
        videoUrl: seg.url || '',
        start: Number(seg.start ?? 0),
        end: Number(seg.end ?? 20)
      }
    }
    const videoSegments = { ...computedSegments, ...storageSegments }
    window.localStorage.setItem(getSegmentsStorageKey(trainingKey), JSON.stringify(videoSegments))
    setStoredSegments(videoSegments)
    const storageCameraViews = readStoredCameraViews(trainingKey)
    const computedCameraViews = {}
    for (const card of programCards) {
      const view = normalizeCameraView(card.cameraView)
      if (!view) continue
      computedCameraViews[card.id] = view
    }
    const cameraViews = { ...storageCameraViews, ...computedCameraViews }
    window.localStorage.setItem(getCameraViewsStorageKey(trainingKey), JSON.stringify(cameraViews))
    setStoredCameraViews(cameraViews)

    const payload = {
      ...toExportProgram(programCardsBase, levels, appConfig.videoSources || []),
      videoSegments,
      cameraViews
    }
    localStorage.setItem(getProgramStorageKey(trainingKey), JSON.stringify(payload))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trainingKey}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const videoEditorCard = selectedCard
    ? {
      ...selectedCard,
      video: selectedCard.videoSegment?.url ? selectedCard.videoSegment : { url: appConfig.videoSources?.[0] || '', start: 0, end: 20 }
    }
    : null

  return (
    <main className="layout compact-layout">
      {showSplash ? (
        <div
          className="splash-screen"
          role="button"
          tabIndex={0}
          aria-label="Chiudi splash"
          onClick={() => setShowSplash(false)}
          onTouchStart={() => setShowSplash(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowSplash(false)
          }}
        >
          <img src={splashImageSrc} alt="Sports splash" className="splash-image" />
        </div>
      ) : null}
      <header className="hero compact-hero">
        <div className="brand-row">
          <img src={logoSrc} alt="Decathlon" className="brand-logo-img" />
          <h1>Trainer</h1>
          <div className="burger-wrap">
            <button type="button" className="burger-btn" aria-label="Apri menu sezioni" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            {menuOpen ? (
              <div className="burger-menu">
                <button type="button" className={activeView === 'trainer' ? 'active' : ''} onClick={() => { setActiveView('trainer'); setMenuOpen(false) }}>Trainer</button>
                <button type="button" className={activeView === 'video' ? 'active' : ''} onClick={() => { setActiveView('video'); setMenuOpen(false) }}>Video Editor</button>
                {activeView === 'trainer' ? (
                  <label className="burger-level">
                    Training
                    <select value={trainingKey} onChange={(e) => setTrainingKey(e.target.value)}>
                      {Object.entries(TRAINING_CONFIGS).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {activeView === 'trainer' ? (
                  <label className="burger-level">
                    Livello
                    <select value={level} onChange={(e) => setLevel(e.target.value)}>
                      {Object.entries(levels).map(([key, value]) => (
                        <option key={key} value={key}>{value.label || key}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="burger-level">
                  Tema
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="maschio">Maschio</option>
                    <option value="femmina">Femmina</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {activeView === 'trainer' ? (
        <>
          <section className="timer-strip">
            <div className="timer-metrics">
              <div><strong>Training:</strong> {trainingLabel}</div>
              <div><strong>Totale:</strong> {formatTime(totalRemaining)}</div>
              <div><strong>Scheda:</strong> {formatTime(currentRemaining)}</div>
              <div><strong>Attuale:</strong> {currentCard?.name || 'N/A'}</div>
            </div>
          </section>

          <section className="panel compact-panel card-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                const idx = Math.max(0, programCards.findIndex((c) => c.id === selectedCardId) - 1)
                setSelectedCardId(programCards[idx]?.id || '')
              }}
            >
              ‹
            </button>
            <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)}>
              {programCards.map((card) => (
                <option key={card.id} value={card.id}>{card.classKey} · {card.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                const idx = Math.min(programCards.length - 1, programCards.findIndex((c) => c.id === selectedCardId) + 1)
                setSelectedCardId(programCards[idx]?.id || '')
              }}
            >
              ›
            </button>
            <div className="card-nav-play" aria-label="Controlli playback">
              {!playMode ? (
                <button type="button" className="icon-btn" title="Play" aria-label="Play" onClick={startPlay}>▶</button>
              ) : (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    title={playRunning ? 'Pausa' : 'Continua'}
                    aria-label={playRunning ? 'Pausa' : 'Continua'}
                    onClick={() => setPlayRunning((v) => !v)}
                  >
                    {playRunning ? '❚❚' : '▶'}
                  </button>
                  <button type="button" className="icon-btn" title="Stop" aria-label="Stop" onClick={stopPlay}>■</button>
                </>
              )}
            </div>
          </section>

          {playMode ? (
            currentCard ? <ProgramCard card={{ ...currentCard, onCameraSaved: handleCameraSaved, onClipSelected: handleClipSelected }} /> : null
          ) : (
            selectedCard ? <ProgramCard card={{ ...selectedCard, onCameraSaved: handleCameraSaved, onClipSelected: handleClipSelected }} /> : null
          )}

          {isEditMode && selectedCard ? (
            <section className="panel compact-panel editor-panel">
              <h3>Editor Scheda</h3>
              <div className="editor-grid">
                <label>Nome<input value={selectedCard.name} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, name: e.target.value } : c))} /></label>
                <label>Classe
                  <select value={selectedCard.classKey} onChange={(e) => setProgramCardsBase((cards) => orderByClass(cards.map((c) => c.id === selectedCard.id ? { ...c, classKey: e.target.value } : c)))}>
                    <option value="warmup">warmup</option>
                    <option value="esercizio">esercizio</option>
                    <option value="stretching">stretching</option>
                  </select>
                </label>
                <label>Viewer
                  <select value={selectedCard.viewerType} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, viewerType: e.target.value } : c))}>
                    <option value="3d">3d</option>
                    <option value="video">video</option>
                  </select>
                </label>
                <label>animationType<input value={selectedCard.animationType} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, animationType: e.target.value } : c))} /></label>
                <label>Clip FBX<input value={selectedCard.clipName || ''} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, clipName: e.target.value } : c))} /></label>
                <label>Type<input value={selectedCard.type} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, type: e.target.value } : c))} /></label>
                <label>Durata (sec)<input type="number" value={selectedCard.durationSec} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, durationSec: Number(e.target.value) || 0 } : c))} /></label>
                <label>Serie<input type="number" value={selectedCard.sets} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, sets: Number(e.target.value) || 1 } : c))} /></label>
                <label>Reps<input value={selectedCard.reps} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, reps: e.target.value } : c))} /></label>
                <label>Video URL (da segmento)<input value={selectedCard.videoSegment?.url || ''} readOnly /></label>
                <label>Video Start (da Video Editor)<input type="number" value={selectedCard.videoSegment?.start || 0} readOnly /></label>
                <label>Video End (da Video Editor)<input type="number" value={selectedCard.videoSegment?.end || 20} readOnly /></label>
              </div>
              <div className="editor-actions">
                <button type="button" onClick={saveProgramJson}>Salva JSON Programma</button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeView === 'video' ? (
        <section className="panel compact-panel detail">
          <h2>Video Editor</h2>
          <label>
            Scheda
            <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)}>
              {programCards.map((card) => (
                <option key={card.id} value={card.id}>{card.classKey} · {card.name}</option>
              ))}
            </select>
          </label>
          {videoEditorCard ? <ExerciseVideoLoop exercise={videoEditorCard} videoSources={appConfig.videoSources || []} /> : null}
        </section>
      ) : null}

      <footer className="app-footer">
        <div className="brand-logo" aria-hidden>GT</div>
        <span>Trainer</span>
      </footer>
    </main>
  )
}
