import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExerciseRenderer from './three/ExerciseRenderer'
import ExerciseVideoLoop from './components/ExerciseVideoLoop'
import calistenichsConfig from './config/calistenichs.json'
import pilatesConfig from './config/pilates.json'
import modelsConfig from './config/models.json'

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

const PROFILE_STORAGE_KEY = 'ginnastica.profile'
const SETUP_STEP_STORAGE_KEY = 'ginnastica.setup.step'

function formatTime(totalSeconds) {
  const value = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
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

function isMobileLikeDevice() {
  if (typeof window === 'undefined') return false
  const byTouch = navigator.maxTouchPoints > 0
  const byWidth = window.matchMedia?.('(max-width: 900px)')?.matches
  return Boolean(byTouch && byWidth)
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
  return base
}

function cardsFromAllenamento(allenamento, legacy = {}) {
  const legacyVideoSegments = legacy?.videoSegments || {}
  const legacyCameraViews = legacy?.cameraViews || {}
  const enrich = (card, classKey) => {
    const normalized = normalizeCard({ ...card }, classKey)
    const legacyVideo = legacyVideoSegments?.[normalized.id]
    const legacyCamera = legacyCameraViews?.[normalized.id]
    if (!normalized.videoSegment && normalized.video) normalized.videoSegment = normalized.video
    if (!normalized.videoSegment && legacyVideo) {
      normalized.videoSegment = {
        url: legacyVideo.videoUrl || '',
        start: Number(legacyVideo.start ?? 0),
        end: Number(legacyVideo.end ?? 20)
      }
    }
    if (!normalized.cameraView && legacyCamera) {
      normalized.cameraView = {
        camera: legacyCamera.camera,
        target: legacyCamera.target
      }
    }
    return normalized
  }

  const fromCards = Array.isArray(allenamento?.cards) ? allenamento.cards : null
  if (fromCards?.length) {
    return orderByClass(
      fromCards.map((card) => enrich(card, card.classKey || 'esercizio'))
    )
  }

  const warmup = (allenamento?.warmup || []).map((c) => enrich(c, 'warmup'))
  const esercizi = (allenamento?.esercizi || []).map((c) => enrich(c, 'esercizio'))
  const stretching = (allenamento?.stretching || []).map((c) => enrich(c, 'stretching'))
  return orderByClass([...warmup, ...esercizi, ...stretching])
}

function getProgramStorageKey(trainingKey) {
  return `ginnastica.program.json.${trainingKey}`
}

function readSavedProgram(trainingKey) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getProgramStorageKey(trainingKey))
      || (trainingKey === 'calistenichs' ? window.localStorage.getItem('ginnastica.program.json') : null)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function readSavedProgramCards(trainingKey) {
  const saved = readSavedProgram(trainingKey)
  if (!saved) return null
  return cardsFromAllenamento(saved?.allenamento, saved)
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

function getSavedVideoSegment(card, defaultVideoUrl) {
  const fromCard = card?.videoSegment || card?.video
  if (fromCard && typeof fromCard === 'object') {
    const start = Number.isFinite(Number(fromCard.start)) ? Number(fromCard.start) : 0
    const end = Number.isFinite(Number(fromCard.end)) ? Number(fromCard.end) : start + 20
    const url = typeof fromCard.url === 'string' ? fromCard.url : fromCard.videoUrl
    return {
      url: url || defaultVideoUrl || '',
      start,
      end: Math.max(start + 1, end)
    }
  }
  if (typeof window === 'undefined') return { url: defaultVideoUrl, start: 0, end: 20 }
  try {
    const raw = window.localStorage.getItem(`ginnastica.videoLoop.${card?.id}`)
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

function getSavedCameraView(cardId, storedCameraViews = {}) {
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

  return null
}

function readSavedProfile() {
  if (typeof window === 'undefined') {
    return {
      nome: '',
      cognome: '',
      alias: '',
      email: '',
      sesso: 'maschio'
    }
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return { nome: '', cognome: '', alias: '', email: '', sesso: 'maschio' }
    const parsed = JSON.parse(raw)
    return {
      nome: typeof parsed?.nome === 'string' ? parsed.nome : '',
      cognome: typeof parsed?.cognome === 'string' ? parsed.cognome : '',
      alias: typeof parsed?.alias === 'string' ? parsed.alias : '',
      email: typeof parsed?.email === 'string' ? parsed.email : '',
      sesso: typeof parsed?.sesso === 'string' ? parsed.sesso : 'maschio'
    }
  } catch {
    return { nome: '', cognome: '', alias: '', email: '', sesso: 'maschio' }
  }
}

function CardViewer({ card }) {
  const handleVideoSegmentChange = useCallback(
    (segment) => card.onVideoSegmentChange?.(card.id, segment),
    [card.id, card.onVideoSegmentChange]
  )
  const handleCameraSaved = useCallback(
    (payload) => card.onCameraSaved?.(card.id, payload),
    [card.id, card.onCameraSaved]
  )
  const handleClipSelected = useCallback(
    (value) => card.onClipSelected?.(card.id, value),
    [card.id, card.onClipSelected]
  )
  const handleClipOptions = useCallback(
    (clips) => card.onClipOptions?.(card.id, clips),
    [card.id, card.onClipOptions]
  )
  const handleModelAssetSelected = useCallback(
    (assetPath) => card.onModelAssetSelected?.(card.id, assetPath),
    [card.id, card.onModelAssetSelected]
  )

  if (card.viewerType === 'video') {
    const exerciseVideo = {
      ...card,
      video: card.videoSegment || { url: '', start: 0, end: 20 }
    }
    if (card.isEditMode) {
      return (
        <div className="figure-panel figure-panel-video">
          <ExerciseVideoLoop
            key={`video-${card.id}`}
            exercise={exerciseVideo}
            videoSources={card.videoSources || []}
            onSegmentChange={handleVideoSegmentChange}
            editable
          />
        </div>
      )
    }
    return (
      <div className="figure-card figure-card-3d">
        <ExerciseVideoLoop
          key={`video-${card.id}`}
          exercise={exerciseVideo}
          videoSources={card.videoSources || []}
          onSegmentChange={undefined}
          editable={false}
        />
      </div>
    )
  }
  return (
    <ExerciseRenderer
      cardId={card.id}
      cameraView={card.cameraView}
      onCameraSaved={handleCameraSaved}
      clipName={card.clipName}
      onClipSelected={handleClipSelected}
      onClipOptions={handleClipOptions}
      theme={card.theme}
      modelAsset={card.modelAsset}
      modelOptions={card.modelOptions || []}
      onModelAssetSelected={handleModelAssetSelected}
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
  const [profile, setProfile] = useState(() => readSavedProfile())
  const [setupStep, setSetupStep] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = Number(window.localStorage.getItem(SETUP_STEP_STORAGE_KEY))
    if (!Number.isFinite(saved)) return 0
    return Math.min(3, Math.max(0, Math.floor(saved)))
  })
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
  const [videoSources, setVideoSources] = useState(appConfig.videoSources || [])
  const [newVideoSource, setNewVideoSource] = useState('')
  const defaultVideoUrl = videoSources?.[0] || ''
  const [clipOptionsByCard, setClipOptionsByCard] = useState({})
  const lastCameraSignatureByCardRef = useRef({})
  const levels = allCfg.livelli || {}
  const modelOptions = useMemo(
    () => [...new Set((modelsConfig?.models || []).filter((value) => typeof value === 'string' && value.endsWith('.fbx')))],
    []
  )
  const levelCfg = levels[level] || Object.values(levels)[0] || { setMultiplier: 1, durationMultiplier: 1 }
  const splashUrlMode = getSplashModeFromUrl()
  const splashEnabled = splashUrlMode ?? (appConfig?.ui?.splashEnabled !== false)
  const splashDurationMs = Math.min(3000, Math.max(0, Number(appConfig?.ui?.splashDurationMs ?? 2000)))
  const [showSplash, setShowSplash] = useState(() => splashEnabled)
  const [mobileFullscreenAttempted, setMobileFullscreenAttempted] = useState(false)

  const [programCardsBase, setProgramCardsBase] = useState([])
  const latestVideoByCardRef = useRef({})
  const latestClipByCardRef = useRef({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ginnastica.training.key', trainingKey)
    }

    const savedProgram = readSavedProgram(trainingKey)
    const saved = savedProgram ? cardsFromAllenamento(savedProgram?.allenamento, savedProgram) : null
    const fromConfig = cardsFromAllenamento(allCfg)
    setProgramCardsBase(saved?.length ? saved : fromConfig)
    const savedSources = Array.isArray(savedProgram?.videoSources) ? savedProgram.videoSources : null
    setVideoSources(savedSources?.length ? savedSources : (appConfig.videoSources || []))
    setNewVideoSource('')
    setPlayMode(false)
    setPlayRunning(false)
    setPlayIndex(0)

  }, [trainingKey, allCfg, appConfig.videoSources])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('ginnastica.theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SETUP_STEP_STORAGE_KEY, String(setupStep))
  }, [setupStep])

  useEffect(() => {
    const levelKeys = Object.keys(levels)
    if (levelKeys.length && !levels[level]) setLevel(levelKeys[0])
  }, [levels, level])

  useEffect(() => {
    if (!showSplash) return undefined
    const timeoutId = window.setTimeout(() => setShowSplash(false), splashDurationMs)
    return () => window.clearTimeout(timeoutId)
  }, [showSplash, splashDurationMs])

  useEffect(() => {
    if (mobileFullscreenAttempted) return undefined
    if (!isMobileLikeDevice()) return undefined

    const target = document.documentElement
    const requestFullscreen =
      target.requestFullscreen
      || target.webkitRequestFullscreen
      || target.msRequestFullscreen
    if (typeof requestFullscreen !== 'function') return undefined

    const tryEnterFullscreen = () => {
      if (document.fullscreenElement) return
      Promise.resolve(requestFullscreen.call(target)).catch(() => {})
      setMobileFullscreenAttempted(true)
    }

    window.addEventListener('pointerdown', tryEnterFullscreen, { once: true })
    return () => {
      window.removeEventListener('pointerdown', tryEnterFullscreen)
    }
  }, [mobileFullscreenAttempted])

  const programCards = useMemo(() => {
    const setMultiplier = levelCfg?.setMultiplier || 1
    const durationMultiplier = levelCfg?.durationMultiplier || 1
    return orderByClass(
      programCardsBase.map((card) => ({
        ...card,
        videoSegment: getSavedVideoSegment(card, defaultVideoUrl),
        cameraView: normalizeCameraView(card.cameraView) || getSavedCameraView(card.id),
        setsScaled: Math.max(1, Math.round((card.sets || 1) * setMultiplier)),
        durationScaledSec: Math.max(20, Math.round((card.durationSec || 60) * durationMultiplier)),
        repsScaled: scaleReps(card.reps || '', durationMultiplier)
      }))
    )
  }, [programCardsBase, levelCfg, defaultVideoUrl])

  const [selectedCardId, setSelectedCardId] = useState(programCards[0]?.id || '')

  useEffect(() => {
    if (!programCards.some((c) => c.id === selectedCardId)) setSelectedCardId(programCards[0]?.id || '')
  }, [programCards, selectedCardId])

  const selectedCard = programCards.find((c) => c.id === selectedCardId) || programCards[0]

  const commitCardDraft = useCallback((cardId) => {
    if (!cardId) return
    const pendingVideo = latestVideoByCardRef.current[cardId]
    const pendingClip = latestClipByCardRef.current[cardId]
    if (!pendingVideo && !pendingClip) return

    setProgramCardsBase((cards) => cards.map((c) => {
      if (c.id !== cardId) return c
      let next = c
      if (pendingVideo) {
        const current = c.videoSegment || {}
        const sameVideo =
          String(current.url || '') === String(pendingVideo.url || '')
          && Number(current.start ?? 0) === Number(pendingVideo.start ?? 0)
          && Number(current.end ?? 0) === Number(pendingVideo.end ?? 0)
        if (!sameVideo) next = { ...next, videoSegment: pendingVideo }
      }
      if (pendingClip && pendingClip !== c.clipName) {
        next = { ...next, clipName: pendingClip }
      }
      return next
    }))
  }, [])

  const switchSelectedCard = useCallback((nextCardId) => {
    const targetId = String(nextCardId || '')
    if (!targetId || targetId === selectedCardId) return
    console.debug('[Trainer3D][Nav] switch-card', { from: selectedCardId, to: targetId })
    commitCardDraft(selectedCardId)
    setSelectedCardId(targetId)
  }, [selectedCardId, commitCardDraft])

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
          const currentCardId = programCards[index]?.id
          if (currentCardId) commitCardDraft(currentCardId)
          setCurrentRemaining(programCards[next].durationScaledSec)
          setSelectedCardId(programCards[next].id)
          return next
        })
        return 0
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [playMode, playRunning, programCards, commitCardDraft])

  const currentCard = playMode ? programCards[playIndex] : selectedCard

  const startPlay = () => {
    if (!programCards.length) return
    commitCardDraft(selectedCardId)
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
    const signature = `${normalized.camera.join(',')}|${normalized.target.join(',')}`
    if (lastCameraSignatureByCardRef.current[cardId] === signature) return
    lastCameraSignatureByCardRef.current[cardId] = signature
    console.debug('[Trainer3D][App] camera-saved', { cardId, camera: normalized.camera, target: normalized.target })
    setProgramCardsBase((cards) => cards.map((c) => {
      if (c.id !== cardId) return c
      const current = normalizeCameraView(c.cameraView)
      const same = !!current
        && current.camera.every((v, i) => v === normalized.camera[i])
        && current.target.every((v, i) => v === normalized.target[i])
      if (same) return c
      return { ...c, cameraView: normalized }
    }))
  }, [])

  const handleClipSelected = useCallback((cardId, clipName) => {
    if (!clipName) return
    latestClipByCardRef.current[cardId] = clipName
    setProgramCardsBase((cards) => cards.map((c) => (c.id === cardId ? { ...c, clipName } : c)))
  }, [])

  const handleClipOptions = useCallback((cardId, clips) => {
    if (!Array.isArray(clips)) return
    const normalized = [...new Set(clips.filter(Boolean))]
    setClipOptionsByCard((prev) => {
      const current = prev[cardId] || []
      if (current.length === normalized.length && current.every((v, i) => v === normalized[i])) return prev
      return { ...prev, [cardId]: normalized }
    })
  }, [])

  const handleModelAssetSelected = useCallback((cardId, modelAsset) => {
    if (!cardId || !modelAsset) return
    setProgramCardsBase((cards) => cards.map((c) => (c.id === cardId ? { ...c, modelAsset } : c)))
  }, [])

  const handleVideoSegmentChange = useCallback((cardId, segment) => {
    if (!cardId || !segment) return
    const start = Number(segment.start ?? 0)
    const end = Number(segment.end ?? start + 20)
    const nextSegment = {
      url: segment.url || defaultVideoUrl || '',
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? Math.max((Number.isFinite(start) ? start : 0) + 1, end) : 20
    }
    latestVideoByCardRef.current[cardId] = nextSegment
    setProgramCardsBase((cards) => cards.map((c) => {
      if (c.id !== cardId) return c
      const current = c.videoSegment || {}
      const same =
        String(current.url || '') === String(nextSegment.url || '')
        && Number(current.start ?? 0) === Number(nextSegment.start ?? 0)
        && Number(current.end ?? 0) === Number(nextSegment.end ?? 0)
      if (same) return c
      return { ...c, videoSegment: nextSegment }
    }))
  }, [defaultVideoUrl])

  const getExportCards = useCallback(() => {
    return orderByClass(
      programCards.map((card) => {
        const pendingVideo = latestVideoByCardRef.current[card.id]
        const pendingClip = latestClipByCardRef.current[card.id]
        const storedCamera = normalizeCameraView(card.cameraView) || getSavedCameraView(card.id)
        const clipOptions = clipOptionsByCard[card.id] || []
        const next = { ...card }

        if (pendingVideo) next.videoSegment = pendingVideo
        if (next.viewerType === '3d') {
          const resolvedClip = pendingClip || next.clipName || (clipOptions.length ? clipOptions[0] : '')
          if (resolvedClip) next.clipName = resolvedClip
          if (storedCamera) next.cameraView = storedCamera
        }

        return next
      })
    )
  }, [programCards, clipOptionsByCard])

  const saveProgramJson = () => {
    commitCardDraft(selectedCardId)
    const exportCards = getExportCards()
    const payload = {
      ...toExportProgram(exportCards, levels, videoSources || [])
    }
    setProgramCardsBase(exportCards)
    localStorage.setItem(getProgramStorageKey(trainingKey), JSON.stringify(payload))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trainingKey}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateProfileField = useCallback((field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }, [])

  const setupStepLabels = ['Profilo', 'Training', 'Livello', 'Programma']
  const isProgramStep = setupStep >= 3

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
          <div className="brand-logo-shell">
            <img src={logoSrc} alt="Sport" className="brand-logo-img" />
          </div>
          <h1>Personal Trainer</h1>
          <div className="burger-wrap">
            <button type="button" className="burger-btn" aria-label="Apri menu sezioni" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            {menuOpen ? (
              <div className="burger-menu">
                <button type="button" className={activeView === 'trainer' ? 'active' : ''} onClick={() => { setActiveView('trainer'); setMenuOpen(false) }}>Trainer</button>
                <button type="button" className={activeView === 'profile' ? 'active' : ''} onClick={() => { setActiveView('profile'); setMenuOpen(false) }}>Profilo</button>
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

      {activeView === 'profile' ? (
        <section className="panel compact-panel setup-panel">
          <h3>Profilo</h3>
          <div className="editor-grid">
            <label>Nome<input value={profile.nome} onChange={(e) => updateProfileField('nome', e.target.value)} /></label>
            <label>Cognome<input value={profile.cognome} onChange={(e) => updateProfileField('cognome', e.target.value)} /></label>
            <label>Alias<input value={profile.alias} onChange={(e) => updateProfileField('alias', e.target.value)} /></label>
            <label>Email<input type="email" value={profile.email} onChange={(e) => updateProfileField('email', e.target.value)} /></label>
            <label>
              Sesso
              <select value={profile.sesso} onChange={(e) => updateProfileField('sesso', e.target.value)}>
                <option value="maschio">Maschio</option>
                <option value="femmina">Femmina</option>
                <option value="altro">Altro</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {activeView === 'trainer' ? (
        <>
          {!isProgramStep ? (
            <section className="panel compact-panel setup-panel">
              <h3>{setupStepLabels[setupStep] || 'Setup'}</h3>
              <p className="hint">Step {setupStep + 1} di 4</p>

              {setupStep === 0 ? (
                <div className="editor-grid">
                  <label>Nome<input value={profile.nome} onChange={(e) => updateProfileField('nome', e.target.value)} /></label>
                  <label>Cognome<input value={profile.cognome} onChange={(e) => updateProfileField('cognome', e.target.value)} /></label>
                  <label>Alias<input value={profile.alias} onChange={(e) => updateProfileField('alias', e.target.value)} /></label>
                  <label>Email<input type="email" value={profile.email} onChange={(e) => updateProfileField('email', e.target.value)} /></label>
                  <label>
                    Sesso
                    <select value={profile.sesso} onChange={(e) => updateProfileField('sesso', e.target.value)}>
                      <option value="maschio">Maschio</option>
                      <option value="femmina">Femmina</option>
                      <option value="altro">Altro</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {setupStep === 1 ? (
                <div className="editor-grid">
                  <label>
                    Training
                    <select value={trainingKey} onChange={(e) => setTrainingKey(e.target.value)}>
                      {Object.entries(TRAINING_CONFIGS).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {setupStep === 2 ? (
                <div className="editor-grid">
                  <label>
                    Livello
                    <select value={level} onChange={(e) => setLevel(e.target.value)}>
                      {Object.entries(levels).map(([key, value]) => (
                        <option key={key} value={key}>{value.label || key}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="setup-nav">
                <button type="button" disabled={setupStep <= 0} onClick={() => setSetupStep((step) => Math.max(0, step - 1))}>
                  Precedente
                </button>
                <button type="button" onClick={() => setSetupStep((step) => Math.min(3, step + 1))}>
                  {setupStep >= 2 ? 'Vai al Programma' : 'Avanti'}
                </button>
              </div>
            </section>
          ) : (
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
                    switchSelectedCard(programCards[idx]?.id || '')
                  }}
                >
                  ‹
                </button>
                <select value={selectedCardId} onChange={(e) => switchSelectedCard(e.target.value)}>
                  {programCards.map((card) => (
                    <option key={card.id} value={card.id}>{card.classKey} · {card.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    const idx = Math.min(programCards.length - 1, programCards.findIndex((c) => c.id === selectedCardId) + 1)
                    switchSelectedCard(programCards[idx]?.id || '')
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
                currentCard ? <ProgramCard card={{ ...currentCard, onCameraSaved: handleCameraSaved, onClipSelected: handleClipSelected, onClipOptions: handleClipOptions, onVideoSegmentChange: handleVideoSegmentChange, onModelAssetSelected: handleModelAssetSelected, videoSources, isEditMode, theme, modelOptions }} /> : null
              ) : (
                selectedCard ? <ProgramCard card={{ ...selectedCard, onCameraSaved: handleCameraSaved, onClipSelected: handleClipSelected, onClipOptions: handleClipOptions, onVideoSegmentChange: handleVideoSegmentChange, onModelAssetSelected: handleModelAssetSelected, videoSources, isEditMode, theme, modelOptions }} /> : null
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
                    <label>Type<input value={selectedCard.type} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, type: e.target.value } : c))} /></label>
                    <label>Durata (sec)<input type="number" value={selectedCard.durationSec} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, durationSec: Number(e.target.value) || 0 } : c))} /></label>
                    <label>Serie<input type="number" value={selectedCard.sets} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, sets: Number(e.target.value) || 1 } : c))} /></label>
                    <label>Reps<input value={selectedCard.reps} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, reps: e.target.value } : c))} /></label>
                    <label>
                      Esecuzione (una riga per punto)
                      <textarea
                        value={(selectedCard.execution || []).join('\n')}
                        onChange={(e) => {
                          const items = e.target.value.split('\n').map((v) => v.trim()).filter(Boolean)
                          setProgramCardsBase((cards) => cards.map((c) => (c.id === selectedCard.id ? { ...c, execution: items } : c)))
                        }}
                      />
                    </label>
                    <label>
                      Errori (una riga per punto)
                      <textarea
                        value={(selectedCard.mistakes || []).join('\n')}
                        onChange={(e) => {
                          const items = e.target.value.split('\n').map((v) => v.trim()).filter(Boolean)
                          setProgramCardsBase((cards) => cards.map((c) => (c.id === selectedCard.id ? { ...c, mistakes: items } : c)))
                        }}
                      />
                    </label>
                    <label>
                      Respirazione
                      <textarea
                        value={selectedCard.breathing || ''}
                        onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => (c.id === selectedCard.id ? { ...c, breathing: e.target.value } : c)))}
                      />
                    </label>
                    <label>Video URL (da segmento)<input value={selectedCard.videoSegment?.url || ''} readOnly /></label>
                  </div>
                  <div className="video-sources-editor">
                    <h4>Video Sorgenti</h4>
                    {(videoSources || []).map((url) => {
                      const inUse = programCards.some((card) => {
                        const segment = card.videoSegment || card.video
                        return String(segment?.url || '') === String(url)
                      })
                      return (
                        <div key={url} className="video-source-row">
                          <input value={url} readOnly />
                          <button
                            type="button"
                            disabled={inUse}
                            title={inUse ? 'Sorgente usata da almeno una scheda' : 'Rimuovi sorgente'}
                            onClick={() => setVideoSources((sources) => sources.filter((u) => u !== url))}
                          >
                            Rimuovi
                          </button>
                        </div>
                      )
                    })}
                    <div className="video-source-row">
                      <input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={newVideoSource}
                        onChange={(e) => setNewVideoSource(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = newVideoSource.trim()
                          if (!url) return
                          setVideoSources((sources) => (sources.includes(url) ? sources : [...sources, url]))
                          setNewVideoSource('')
                        }}
                      >
                        Aggiungi
                      </button>
                    </div>
                  </div>
                  <div className="editor-actions">
                    <button type="button" onClick={saveProgramJson}>Salva JSON Programma</button>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </>
      ) : null}

    </main>
  )
}
