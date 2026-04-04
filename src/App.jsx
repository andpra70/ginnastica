import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
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

const STORAGE_ROOT_KEY = 'ginnastica'
const PROFILE_STORAGE_KEY = 'ginnastica.profile'
const WORKOUT_HISTORY_STORAGE_KEY = 'ginnastica.workout.history'
const SESSION_STORAGE_KEY = 'ginnastica.session.state'

function readAppStorage() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_ROOT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeAppStorage(next) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_ROOT_KEY, JSON.stringify(next))
  } catch {
    // ignore storage errors
  }
}

function getStoredValue(key) {
  const root = readAppStorage()
  return Object.prototype.hasOwnProperty.call(root, key) ? root[key] : null
}

function setStoredValue(key, value) {
  const root = readAppStorage()
  root[key] = value
  writeAppStorage(root)
}

function parseGoogleFlagFromUrl() {
  if (typeof window === 'undefined') return false
  const raw = new URLSearchParams(window.location.search).get('google')
  if (raw == null) return false
  const normalized = String(raw).trim().toLowerCase()
  return ['1', 'true', 'on', 'yes'].includes(normalized)
}

function parseJwtPayload(token) {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    )
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function getTodayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeWeightHistory(entries) {
  if (!Array.isArray(entries)) return []
  const normalized = entries
    .map((entry) => {
      const date = typeof entry?.date === 'string' ? entry.date : ''
      const weight = Number(entry?.weight)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      if (!Number.isFinite(weight) || weight <= 0) return null
      return { date, weight: Number(weight.toFixed(2)) }
    })
    .filter(Boolean)

  const byDate = new Map()
  for (const row of normalized) byDate.set(row.date, row)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function toIsoDateLocal(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeWorkoutHistory(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => {
      const startAt = typeof entry?.startAt === 'string' ? entry.startAt : ''
      const endAt = typeof entry?.endAt === 'string' ? entry.endAt : ''
      const durationSec = Number(entry?.durationSec)
      if (!startAt || !endAt || !Number.isFinite(durationSec)) return null
      return {
        id: typeof entry?.id === 'string' ? entry.id : `${startAt}-${endAt}`,
        startAt,
        endAt,
        durationSec: Math.max(0, Math.round(durationSec)),
        trainingKey: typeof entry?.trainingKey === 'string' ? entry.trainingKey : '',
        trainingLabel: typeof entry?.trainingLabel === 'string' ? entry.trainingLabel : 'Training',
        level: typeof entry?.level === 'string' ? entry.level : '',
        endReason: typeof entry?.endReason === 'string' ? entry.endReason : 'stop'
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
}

function formatTime(totalSeconds) {
  const value = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function clampRange(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function pickSpeechVoice(voices, gender) {
  if (!Array.isArray(voices) || !voices.length) return null
  const italian = voices.filter((voice) => /(^it[-_]|ital)/i.test(`${voice.lang || ''} ${voice.name || ''}`))
  const pool = italian.length ? italian : voices
  const femaleHints = /(female|woman|fem|minnie|chiara|alice|elsa|sara|paola|lucia|giulia)/i
  const maleHints = /(male|man|mas|luca|marco|giorgio|paolo|roberto|federico)/i
  const matcher = gender === 'maschio' ? maleHints : femaleHints
  const preferred = pool.find((voice) => matcher.test(`${voice.name || ''} ${voice.voiceURI || ''}`))
  return preferred || pool[0] || null
}

function buildExerciseSpeechText(card, flags = {}) {
  if (!card) return ''
  const parts = []
  parts.push(`Scheda ${card.classKey || 'esercizio'}. ${card.name || ''}`.trim())
  if (flags.execution && Array.isArray(card.execution) && card.execution.length) {
    parts.push(`Esecuzione. ${card.execution.join('. ')}`)
  }
  if (flags.breathing && typeof card.breathing === 'string' && card.breathing.trim()) {
    parts.push(`Respirazione. ${card.breathing.trim()}`)
  }
  if (flags.errors && Array.isArray(card.mistakes) && card.mistakes.length) {
    parts.push(`Errori da evitare. ${card.mistakes.join('. ')}`)
  }
  return parts.join('. ')
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
    const rawFromRoot = getStoredValue(getProgramStorageKey(trainingKey))
    const raw = (typeof rawFromRoot === 'string' ? rawFromRoot : null)
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
    const storageKey = `ginnastica.videoLoop.${card?.id}`
    const rawFromRoot = getStoredValue(storageKey)
    const raw = (typeof rawFromRoot === 'string' ? rawFromRoot : null) || window.localStorage.getItem(storageKey)
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
    const storageKey = `ginnastica.camera.card.${cardId}`
    const rawFromRoot = getStoredValue(storageKey)
    const legacyByCardRaw = (typeof rawFromRoot === 'string' ? rawFromRoot : null) || window.localStorage.getItem(storageKey)
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
      sesso: 'maschio',
      altezza: '',
      pesoHistory: []
    }
  }
  try {
    const rawFromRoot = getStoredValue(PROFILE_STORAGE_KEY)
    const raw = (typeof rawFromRoot === 'string' ? rawFromRoot : null) || window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) {
      return {
        nome: '',
        cognome: '',
        alias: '',
        email: '',
        sesso: 'maschio',
        altezza: '',
        pesoHistory: []
      }
    }
    const parsed = JSON.parse(raw)
    return {
      nome: typeof parsed?.nome === 'string' ? parsed.nome : '',
      cognome: typeof parsed?.cognome === 'string' ? parsed.cognome : '',
      alias: typeof parsed?.alias === 'string' ? parsed.alias : '',
      email: typeof parsed?.email === 'string' ? parsed.email : '',
      sesso: typeof parsed?.sesso === 'string' ? parsed.sesso : 'maschio',
      altezza: typeof parsed?.altezza === 'string' ? parsed.altezza : '',
      pesoHistory: normalizeWeightHistory(parsed?.pesoHistory)
    }
  } catch {
    return {
      nome: '',
      cognome: '',
      alias: '',
      email: '',
      sesso: 'maschio',
      altezza: '',
      pesoHistory: []
    }
  }
}

function readSavedWorkoutHistory() {
  if (typeof window === 'undefined') return []
  try {
    const rawFromRoot = getStoredValue(WORKOUT_HISTORY_STORAGE_KEY)
    const raw = (typeof rawFromRoot === 'string' ? rawFromRoot : null) || window.localStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY)
    if (!raw) return []
    return normalizeWorkoutHistory(JSON.parse(raw))
  } catch {
    return []
  }
}

function readSavedSessionState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = getStoredValue(SESSION_STORAGE_KEY)
    if (typeof raw !== 'string' || !raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const APP_SECTIONS = ['profile', 'setup', 'training', 'history', 'results', 'settings']

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
            muted={Boolean(card.videoMuted)}
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
          muted={Boolean(card.videoMuted)}
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

function ProgramCard({ card, cardProgressPct = 0 }) {
  return (
    <section className="panel compact-panel detail program-card">
      <div className="detail-head">
        <div className="card-meta-col">
          <p className="hint">Classe: {card.classKey}</p>
          <div className="title-inline">
            <h3>{card.name}</h3>
            <p className="timer-chip">Timer scheda: {formatTime(card.durationScaledSec)}</p>
          </div>
          <div className="card-progress-row" aria-label={`Progresso scheda ${cardProgressPct.toFixed(0)} percento`}>
            <div className="card-progress-track">
              <div className="card-progress-fill" style={{ width: `${cardProgressPct}%` }} />
            </div>
            <span className="card-progress-value">{`${cardProgressPct.toFixed(0)}%`}</span>
          </div>
          <p className="hint">{card.type} • {card.setsScaled} serie • {card.repsScaled || card.reps}</p>

          <div className="vertical-sections">
            <article>
              <h4 className="section-title">
                <span className="section-glyph execution" aria-hidden="true">✓</span>
                Esecuzione
              </h4>
              <ul>{(card.execution || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <h4 className="section-title">
                <span className="section-glyph errors" aria-hidden="true">✖</span>
                Errori
              </h4>
              <ul>{(card.mistakes || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <h4 className="section-title">
                <span className="section-glyph breathing" aria-hidden="true">🫁</span>
                Respirazione
              </h4>
              <p>{card.breathing}</p>
            </article>
          </div>
        </div>
        <CardViewer card={card} />
      </div>
    </section>
  )
}

function SettingsToggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className={`settings-toggle-row${disabled ? ' disabled' : ''}`}>
      <span>{label}</span>
      <span className="settings-switch">
        <input
          type="checkbox"
          className="settings-switch-input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="settings-switch-track" aria-hidden="true" />
      </span>
    </label>
  )
}

export default function App() {
  const initialSessionStateRef = useRef(readSavedSessionState())
  const [activeView, setActiveView] = useState(() => {
    const saved = initialSessionStateRef.current?.activeView
    return APP_SECTIONS.includes(saved) ? saved : 'profile'
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState(() => readSavedProfile())
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'maschio'
    const saved = getStoredValue('ginnastica.theme')
    return saved === 'femmina' ? 'femmina' : 'maschio'
  })
  const [trainingKey, setTrainingKey] = useState(() => {
    if (typeof window === 'undefined') return 'calistenichs'
    const saved = getStoredValue('ginnastica.training.key')
    return TRAINING_CONFIGS[saved] ? saved : 'calistenichs'
  })
  const [videoAudioEnabled, setVideoAudioEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return getStoredValue('ginnastica.settings.videoAudioEnabled') === '1'
  })
  const [clockEnabled, setClockEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const raw = getStoredValue('ginnastica.settings.clockEnabled')
    if (raw == null || raw === '') return true
    return raw === '1'
  })
  const [clockVolumePct, setClockVolumePct] = useState(() => {
    if (typeof window === 'undefined') return 30
    const rawStored = getStoredValue('ginnastica.settings.clockVolumePct')
    if (rawStored == null || rawStored === '') return 30
    const raw = Number(rawStored)
    return clampRange(raw, 0, 100)
  })
  const [clockCadenceSec, setClockCadenceSec] = useState(() => {
    if (typeof window === 'undefined') return 5
    const rawStored = getStoredValue('ginnastica.settings.clockCadenceSec')
    if (rawStored == null || rawStored === '') return 5
    const raw = Number(rawStored)
    const stepped = Math.round(raw / 5) * 5
    return clampRange(stepped, 5, 60)
  })
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const raw = getStoredValue('ginnastica.settings.voiceEnabled')
    if (raw == null || raw === '') return true
    return raw === '1'
  })
  const [voiceGender, setVoiceGender] = useState(() => {
    if (typeof window === 'undefined') return 'femmina'
    const raw = String(getStoredValue('ginnastica.settings.voiceGender') || '').trim().toLowerCase()
    return raw === 'maschio' ? 'maschio' : 'femmina'
  })
  const [voiceVolumePct, setVoiceVolumePct] = useState(() => {
    if (typeof window === 'undefined') return 70
    const rawStored = getStoredValue('ginnastica.settings.voiceVolumePct')
    if (rawStored == null || rawStored === '') return 70
    return clampRange(Number(rawStored), 0, 100)
  })
  const [voiceSpeakExecution, setVoiceSpeakExecution] = useState(() => {
    if (typeof window === 'undefined') return false
    return getStoredValue('ginnastica.settings.voiceSpeakExecution') === '1'
  })
  const [voiceSpeakBreathing, setVoiceSpeakBreathing] = useState(() => {
    if (typeof window === 'undefined') return false
    return getStoredValue('ginnastica.settings.voiceSpeakBreathing') === '1'
  })
  const [voiceSpeakErrors, setVoiceSpeakErrors] = useState(() => {
    if (typeof window === 'undefined') return false
    return getStoredValue('ginnastica.settings.voiceSpeakErrors') === '1'
  })
  const [level, setLevel] = useState('base')
  const [playMode, setPlayMode] = useState(false)
  const [playRunning, setPlayRunning] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [currentRemaining, setCurrentRemaining] = useState(0)
  const [weightEntryDate, setWeightEntryDate] = useState(() => getTodayDateInputValue())
  const [weightEntryValue, setWeightEntryValue] = useState('')
  const [workoutHistory, setWorkoutHistory] = useState(() => readSavedWorkoutHistory())
  const [historyMonth, setHistoryMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => getTodayDateInputValue())
  const [selectedHistoryEventId, setSelectedHistoryEventId] = useState(null)
  const [settingsTab, setSettingsTab] = useState('video')
  const weightChartRef = useRef(null)
  const activeWorkoutSessionRef = useRef(null)
  const clockAudioContextRef = useRef(null)
  const lastClockTickSecRef = useRef(-1)
  const lastSpokenCardIdRef = useRef(null)
  const googleButtonHostRef = useRef(null)
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false)
  const [googleLoginError, setGoogleLoginError] = useState('')

  const isEditMode = getEditMode()
  const googleEnabled = useMemo(() => parseGoogleFlagFromUrl(), [])
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  const iconBase = `${import.meta.env.BASE_URL}icons`
  const logoSrc = `${import.meta.env.BASE_URL}logone.png`
  const sectionIcons = {
    profile: `${iconBase}/profile.png`,
    setup: `${iconBase}/setup.png`,
    training: `${iconBase}/training.png`,
    history: `${iconBase}/history.png`,
    results: `${iconBase}/results.png`
  }
  const splashImageSrc = `${import.meta.env.BASE_URL}splash.png`

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
  const sessionRestoredRef = useRef(false)

  useEffect(() => {
    setStoredValue('ginnastica.training.key', trainingKey)

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
    setStoredValue('ginnastica.theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    setStoredValue(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    setStoredValue('ginnastica.settings.videoAudioEnabled', videoAudioEnabled ? '1' : '0')
  }, [videoAudioEnabled])

  useEffect(() => {
    setStoredValue('ginnastica.settings.clockEnabled', clockEnabled ? '1' : '0')
  }, [clockEnabled])

  useEffect(() => {
    setStoredValue('ginnastica.settings.clockVolumePct', String(clockVolumePct))
  }, [clockVolumePct])

  useEffect(() => {
    setStoredValue('ginnastica.settings.clockCadenceSec', String(clockCadenceSec))
  }, [clockCadenceSec])

  useEffect(() => {
    setStoredValue('ginnastica.settings.voiceEnabled', voiceEnabled ? '1' : '0')
  }, [voiceEnabled])

  useEffect(() => {
    setStoredValue('ginnastica.settings.voiceGender', voiceGender)
  }, [voiceGender])

  useEffect(() => {
    setStoredValue('ginnastica.settings.voiceVolumePct', String(voiceVolumePct))
  }, [voiceVolumePct])

  useEffect(() => {
    setStoredValue('ginnastica.settings.voiceSpeakExecution', voiceSpeakExecution ? '1' : '0')
  }, [voiceSpeakExecution])

  useEffect(() => {
    setStoredValue('ginnastica.settings.voiceSpeakBreathing', voiceSpeakBreathing ? '1' : '0')
  }, [voiceSpeakBreathing])

  useEffect(() => {
    setStoredValue('ginnastica.settings.voiceSpeakErrors', voiceSpeakErrors ? '1' : '0')
  }, [voiceSpeakErrors])

  useEffect(() => {
    setStoredValue(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(workoutHistory))
  }, [workoutHistory])

  useEffect(() => {
    if (!googleEnabled) return
    if (!googleClientId) {
      setGoogleLoginError('Google login attivo ma VITE_GOOGLE_CLIENT_ID non configurato.')
      return
    }

    if (window.google?.accounts?.id) {
      setGoogleScriptLoaded(true)
      return
    }

    let cancelled = false
    const selector = 'script[data-google-identity="1"]'
    const existing = document.querySelector(selector)
    const onLoad = () => {
      if (cancelled) return
      setGoogleScriptLoaded(true)
    }
    const onError = () => {
      if (cancelled) return
      setGoogleLoginError('Impossibile caricare Google Identity Services.')
    }

    if (existing) {
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
      return () => {
        cancelled = true
        existing.removeEventListener('load', onLoad)
        existing.removeEventListener('error', onError)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.setAttribute('data-google-identity', '1')
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
  }, [googleEnabled, googleClientId])

  useEffect(() => {
    if (!googleEnabled || !googleScriptLoaded || !googleClientId) return
    const host = googleButtonHostRef.current
    if (!host) return
    if (!window.google?.accounts?.id) return

    host.innerHTML = ''
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        const payload = parseJwtPayload(response?.credential)
        if (!payload) return
        setProfile((prev) => ({
          ...prev,
          alias: payload.name || prev.alias,
          nome: payload.given_name || prev.nome,
          cognome: payload.family_name || prev.cognome,
          email: payload.email || prev.email
        }))
      }
    })
    window.google.accounts.id.renderButton(host, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left'
    })
  }, [googleEnabled, googleScriptLoaded, googleClientId])

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
    if (sessionRestoredRef.current) return
    if (!programCards.length) return

    const saved = initialSessionStateRef.current
    sessionRestoredRef.current = true
    if (!saved || saved.trainingKey !== trainingKey) return

    const savedLevel = typeof saved.level === 'string' ? saved.level : ''
    if (savedLevel && levels[savedLevel]) setLevel(savedLevel)

    const savedCardId = typeof saved.selectedCardId === 'string' ? saved.selectedCardId : ''
    const canUseSavedCard = savedCardId && programCards.some((card) => card.id === savedCardId)
    if (canUseSavedCard) setSelectedCardId(savedCardId)

    if (!saved.playMode) return

    const safePlayIndex = Math.max(0, Math.min(programCards.length - 1, Number(saved.playIndex) || 0))
    const activeCard = programCards[safePlayIndex]
    const activeCardDuration = activeCard?.durationScaledSec || 0
    const safeTotalRemaining = Math.max(0, Math.min(totalProgramSec, Number(saved.totalRemaining) || totalProgramSec))
    const safeCurrentRemaining = Math.max(0, Math.min(activeCardDuration, Number(saved.currentRemaining) || activeCardDuration))

    setPlayMode(true)
    setPlayRunning(true)
    setPlayIndex(safePlayIndex)
    if (activeCard?.id) setSelectedCardId(activeCard.id)
    setTotalRemaining(safeTotalRemaining)
    setCurrentRemaining(safeCurrentRemaining)

    const savedSession = saved.activeWorkoutSession
    if (savedSession && typeof savedSession === 'object' && Number.isFinite(Number(savedSession.startMs))) {
      activeWorkoutSessionRef.current = {
        startMs: Number(savedSession.startMs),
        trainingKey: typeof savedSession.trainingKey === 'string' ? savedSession.trainingKey : trainingKey,
        trainingLabel: typeof savedSession.trainingLabel === 'string' ? savedSession.trainingLabel : trainingLabel,
        level: typeof savedSession.level === 'string' ? savedSession.level : level
      }
    } else {
      activeWorkoutSessionRef.current = {
        startMs: Date.now(),
        trainingKey,
        trainingLabel,
        level
      }
    }
  }, [programCards, trainingKey, totalProgramSec, levels, trainingLabel, level])

  const completeWorkoutSession = useCallback((endReason = 'stop') => {
    const session = activeWorkoutSessionRef.current
    if (!session) return
    const endMs = Date.now()
    const durationSec = Math.max(0, Math.round((endMs - session.startMs) / 1000))
    const event = {
      id: `${session.startMs}-${endMs}`,
      startAt: new Date(session.startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      durationSec,
      trainingKey: session.trainingKey,
      trainingLabel: session.trainingLabel,
      level: session.level,
      endReason
    }
    activeWorkoutSessionRef.current = null
    setWorkoutHistory((prev) => normalizeWorkoutHistory([event, ...prev]))
    setSelectedHistoryDate(toIsoDateLocal(event.startAt))
    setSelectedHistoryEventId(event.id)
  }, [])

  const playClockChime = useCallback(async () => {
    if (typeof window === 'undefined') return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    if (!clockEnabled) return
    const volume = clampRange(clockVolumePct, 0, 100) / 100
    if (volume <= 0) return

    let ctx = clockAudioContextRef.current
    if (!ctx) {
      ctx = new AudioCtx()
      clockAudioContextRef.current = ctx
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }

    const t0 = ctx.currentTime + 0.01
    const pulse = (freq, start, len, gainMul = 1) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, start)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + len * 0.35)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * gainMul), start + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + len + 0.01)
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
    }

    pulse(1320, t0, 0.08, 0.75)
    pulse(1760, t0 + 0.1, 0.09, 0.95)
  }, [clockEnabled, clockVolumePct])

  const playClockExerciseChangeChime = useCallback(async () => {
    if (typeof window === 'undefined') return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    if (!clockEnabled) return
    const volume = clampRange(clockVolumePct, 0, 100) / 100
    if (volume <= 0) return

    let ctx = clockAudioContextRef.current
    if (!ctx) {
      ctx = new AudioCtx()
      clockAudioContextRef.current = ctx
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }

    const t0 = ctx.currentTime + 0.01
    const pulse = (freq, start, len, gainMul = 1) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * gainMul), start + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + len + 0.01)
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
    }

    // Double acute cue: same pulse length as base cue, higher frequencies.
    pulse(2100, t0, 0.08, 0.95)
    pulse(2450, t0 + 0.1, 0.09, 1.0)
    pulse(2100, t0 + 0.24, 0.08, 0.95)
    pulse(2450, t0 + 0.34, 0.09, 1.0)
  }, [clockEnabled, clockVolumePct])

  useEffect(() => {
    if (!playMode || !playRunning) return undefined
    const id = window.setInterval(() => {
      setTotalRemaining((v) => Math.max(0, v - 1))
      setCurrentRemaining((remaining) => {
        if (remaining > 1) return remaining - 1
        setPlayIndex((index) => {
          const next = index + 1
          if (next >= programCards.length) {
            completeWorkoutSession('completed')
            setPlayRunning(false)
            setPlayMode(false)
            return 0
          }
          const currentCardId = programCards[index]?.id
          if (currentCardId) commitCardDraft(currentCardId)
          playClockExerciseChangeChime()
          setCurrentRemaining(programCards[next].durationScaledSec)
          setSelectedCardId(programCards[next].id)
          return next
        })
        return 0
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [playMode, playRunning, programCards, commitCardDraft, completeWorkoutSession, playClockExerciseChangeChime])

  const currentCard = playMode ? programCards[playIndex] : selectedCard
  const programProgressPct = useMemo(() => {
    if (!playMode || totalProgramSec <= 0) return 0
    return clampPercent(((totalProgramSec - totalRemaining) / totalProgramSec) * 100)
  }, [playMode, totalProgramSec, totalRemaining])
  const currentCardDurationSec = currentCard?.durationScaledSec || 0
  const currentCardProgressPct = useMemo(() => {
    if (!playMode || currentCardDurationSec <= 0) return 0
    return clampPercent(((currentCardDurationSec - currentRemaining) / currentCardDurationSec) * 100)
  }, [playMode, currentCardDurationSec, currentRemaining])

  const startPlay = () => {
    if (!programCards.length) return
    activeWorkoutSessionRef.current = {
      startMs: Date.now(),
      trainingKey,
      trainingLabel,
      level
    }
    commitCardDraft(selectedCardId)
    setPlayMode(true)
    setPlayRunning(true)
    setPlayIndex(0)
    setSelectedCardId(programCards[0].id)
    setTotalRemaining(totalProgramSec)
    setCurrentRemaining(programCards[0].durationScaledSec)
  }

  const stopPlay = () => {
    completeWorkoutSession('stop')
    setPlayMode(false)
    setPlayRunning(false)
    setPlayIndex(0)
    setTotalRemaining(totalProgramSec)
    setCurrentRemaining(selectedCard?.durationScaledSec || 0)
  }

  useEffect(() => {
    if (!playMode || !playRunning || !clockEnabled) {
      lastClockTickSecRef.current = -1
      return
    }
    const elapsedSec = Math.max(0, Math.round(totalProgramSec - totalRemaining))
    const cadence = clampRange(Math.round(clockCadenceSec / 5) * 5, 5, 60)
    if (elapsedSec <= 0 || elapsedSec % cadence !== 0) return
    if (lastClockTickSecRef.current === elapsedSec) return
    lastClockTickSecRef.current = elapsedSec
    playClockChime()
  }, [playMode, playRunning, clockEnabled, clockCadenceSec, totalProgramSec, totalRemaining, playClockChime])

  useEffect(() => {
    if (!playMode || !playRunning) {
      lastSpokenCardIdRef.current = null
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
      return
    }
    if (!voiceEnabled) return
    const card = currentCard
    if (!card?.id) return
    if (lastSpokenCardIdRef.current === card.id) return
    lastSpokenCardIdRef.current = card.id
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const text = buildExerciseSpeechText(card, {
      execution: voiceSpeakExecution,
      breathing: voiceSpeakBreathing,
      errors: voiceSpeakErrors
    })
    if (!text) return
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    const selectedVoice = pickSpeechVoice(synth.getVoices(), voiceGender)
    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang || 'it-IT'
    } else {
      utterance.lang = 'it-IT'
    }
    utterance.volume = clampRange(voiceVolumePct, 0, 100) / 100
    utterance.rate = 1
    utterance.pitch = voiceGender === 'maschio' ? 0.92 : 1.1
    synth.cancel()
    synth.speak(utterance)
  }, [
    playMode,
    playRunning,
    currentCard,
    voiceEnabled,
    voiceGender,
    voiceVolumePct,
    voiceSpeakExecution,
    voiceSpeakBreathing,
    voiceSpeakErrors
  ])

  useEffect(() => {
    return () => {
      const ctx = clockAudioContextRef.current
      if (!ctx) return
      try {
        ctx.close()
      } catch {
        // ignore cleanup errors
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    const snapshot = {
      activeView,
      trainingKey,
      level,
      selectedCardId: selectedCardId || '',
      playMode: Boolean(playMode),
      playRunning: Boolean(playMode ? playRunning : false),
      playIndex: Number.isFinite(playIndex) ? playIndex : 0,
      totalRemaining: Number.isFinite(totalRemaining) ? totalRemaining : 0,
      currentRemaining: Number.isFinite(currentRemaining) ? currentRemaining : 0,
      activeWorkoutSession: playMode ? (activeWorkoutSessionRef.current || null) : null
    }
    setStoredValue(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
  }, [
    activeView,
    trainingKey,
    level,
    selectedCardId,
    playMode,
    playRunning,
    playIndex,
    totalRemaining,
    currentRemaining
  ])

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
    setStoredValue(getProgramStorageKey(trainingKey), JSON.stringify(payload))
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
    if (field === 'sesso') {
      if (value === 'maschio') setTheme('maschio')
      if (value === 'femmina') setTheme('femmina')
    }
  }, [])

  const sectionIndex = APP_SECTIONS.indexOf(activeView)
  const canGoPrev = sectionIndex > 0
  const canGoNext = sectionIndex >= 0 && sectionIndex < APP_SECTIONS.length - 1
  const goPrevSection = useCallback(() => {
    if (!canGoPrev) return
    setActiveView(APP_SECTIONS[sectionIndex - 1])
  }, [canGoPrev, sectionIndex])
  const goNextSection = useCallback(() => {
    if (!canGoNext) return
    setActiveView(APP_SECTIONS[sectionIndex + 1])
  }, [canGoNext, sectionIndex])
  const sortedWeightHistory = useMemo(
    () => normalizeWeightHistory(profile.pesoHistory),
    [profile.pesoHistory]
  )
  const latestWeight = sortedWeightHistory.length ? sortedWeightHistory[sortedWeightHistory.length - 1] : null
  const sortedWorkoutHistory = useMemo(
    () => normalizeWorkoutHistory(workoutHistory),
    [workoutHistory]
  )
  const workoutEventsByDate = useMemo(() => {
    const map = new Map()
    for (const event of sortedWorkoutHistory) {
      const dateKey = toIsoDateLocal(event.startAt)
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey).push(event)
    }
    return map
  }, [sortedWorkoutHistory])
  const monthLabel = useMemo(
    () => historyMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
    [historyMonth]
  )
  const calendarCells = useMemo(() => {
    const year = historyMonth.getFullYear()
    const month = historyMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const firstWeekday = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const dateKey = toIsoDateLocal(date)
      cells.push({
        dateKey,
        day,
        count: (workoutEventsByDate.get(dateKey) || []).length
      })
    }
    return cells
  }, [historyMonth, workoutEventsByDate])
  const selectedHistoryEvents = workoutEventsByDate.get(selectedHistoryDate) || []
  const selectedHistoryEvent = useMemo(() => {
    if (!selectedHistoryEvents.length) return null
    if (!selectedHistoryEventId) return selectedHistoryEvents[0]
    return selectedHistoryEvents.find((event) => event.id === selectedHistoryEventId) || selectedHistoryEvents[0]
  }, [selectedHistoryEvents, selectedHistoryEventId])

  const addOrUpdateWeightEntry = useCallback(() => {
    const date = String(weightEntryDate || '').trim()
    const weight = Number(weightEntryValue)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    if (!Number.isFinite(weight) || weight <= 0) return

    setProfile((prev) => {
      const existing = normalizeWeightHistory(prev.pesoHistory)
      const byDate = new Map(existing.map((row) => [row.date, row]))
      byDate.set(date, { date, weight: Number(weight.toFixed(2)) })
      return { ...prev, pesoHistory: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }
    })
    setWeightEntryValue('')
  }, [weightEntryDate, weightEntryValue])

  const removeWeightEntry = useCallback((date) => {
    setProfile((prev) => ({ ...prev, pesoHistory: normalizeWeightHistory(prev.pesoHistory).filter((row) => row.date !== date) }))
  }, [])

  useEffect(() => {
    if (activeView !== 'results') return
    const svgEl = weightChartRef.current
    if (!svgEl) return

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    if (sortedWeightHistory.length < 2) return

    const width = Math.max(320, svgEl.clientWidth || 320)
    const height = Math.max(220, svgEl.clientHeight || 220)
    const margin = { top: 18, right: 14, bottom: 34, left: 44 }
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom

    const minW = d3.min(sortedWeightHistory, (d) => d.weight) ?? 0
    const maxW = d3.max(sortedWeightHistory, (d) => d.weight) ?? 1
    const spread = Math.max(0.5, maxW - minW)
    const yPadding = spread * 0.15
    const yDomainMin = Math.max(0, minW - yPadding)
    const yDomainMax = maxW + yPadding

    const x = d3.scalePoint()
      .domain(sortedWeightHistory.map((d) => d.date))
      .range([margin.left, width - margin.right])

    const y = d3.scaleLinear()
      .domain([yDomainMin, yDomainMax])
      .nice(4)
      .range([height - margin.bottom, margin.top])

    svg.attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'none')

    const computedStyles = getComputedStyle(svgEl)
    const chartColor = (computedStyles.getPropertyValue('--accent-2') || '#1e5a82').trim()
    const gridColor = 'rgba(30, 90, 130, 0.25)'

    const yAxis = d3.axisLeft(y).ticks(4).tickSize(-plotWidth)
    const yGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis)
    yGroup.selectAll('text').attr('font-size', 11)
    yGroup.selectAll('line').attr('stroke', gridColor)
    yGroup.selectAll('path').attr('stroke', gridColor)

    svg.append('text')
      .attr('x', margin.left)
      .attr('y', margin.top - 6)
      .attr('font-size', 11)
      .attr('fill', chartColor)
      .text('Peso (kg)')

    const formatShortDate = (isoDate) => {
      const [year, month, day] = String(isoDate).split('-')
      if (!year || !month || !day) return isoDate
      return `${day}/${month}`
    }
    const xTickDates = sortedWeightHistory.length <= 6
      ? sortedWeightHistory.map((d) => d.date)
      : [...new Set([
        sortedWeightHistory[0]?.date,
        sortedWeightHistory[Math.floor((sortedWeightHistory.length - 1) / 2)]?.date,
        sortedWeightHistory[sortedWeightHistory.length - 1]?.date
      ])].filter(Boolean)

    const xAxis = d3.axisBottom(x)
      .tickValues(xTickDates)
      .tickFormat((d) => formatShortDate(d))
    const xGroup = svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis)
    xGroup.selectAll('text').attr('font-size', 11)
    xGroup.selectAll('line').attr('stroke', gridColor)
    xGroup.selectAll('path').attr('stroke', gridColor)

    const line = d3.line()
      .x((d) => x(d.date) ?? margin.left)
      .y((d) => y(d.weight))

    svg.append('path')
      .datum(sortedWeightHistory)
      .attr('fill', 'none')
      .attr('stroke', chartColor)
      .attr('stroke-width', 2)
      .attr('d', line)

    svg.append('g')
      .selectAll('circle')
      .data(sortedWeightHistory)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.date) ?? margin.left)
      .attr('cy', (d) => y(d.weight))
      .attr('r', 3)
      .attr('fill', chartColor)
  }, [sortedWeightHistory, activeView])

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
                <button type="button" className={activeView === 'profile' ? 'active' : ''} onClick={() => { setActiveView('profile'); setMenuOpen(false) }}>
                  <img src={sectionIcons.profile} alt="" className="burger-icon" />
                  <span>Profilo</span>
                </button>
                <button type="button" className={activeView === 'setup' ? 'active' : ''} onClick={() => { setActiveView('setup'); setMenuOpen(false) }}>
                  <img src={sectionIcons.setup} alt="" className="burger-icon" />
                  <span>Configurazione</span>
                </button>
                <button type="button" className={activeView === 'training' ? 'active' : ''} onClick={() => { setActiveView('training'); setMenuOpen(false) }}>
                  <img src={sectionIcons.training} alt="" className="burger-icon" />
                  <span>{`Training: ${trainingLabel}`}</span>
                </button>
                <button type="button" className={activeView === 'history' ? 'active' : ''} onClick={() => { setActiveView('history'); setMenuOpen(false) }}>
                  <img src={sectionIcons.history} alt="" className="burger-icon" />
                  <span>Storico</span>
                </button>
                <button type="button" className={activeView === 'results' ? 'active' : ''} onClick={() => { setActiveView('results'); setMenuOpen(false) }}>
                  <img src={sectionIcons.results} alt="" className="burger-icon" />
                  <span>Risultati</span>
                </button>
                <button type="button" className={activeView === 'settings' ? 'active' : ''} onClick={() => { setActiveView('settings'); setMenuOpen(false) }}>
                  <span className="burger-glyph" aria-hidden="true">⚙</span>
                  <span>Settings</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {activeView === 'profile' ? (
        <section className="panel compact-panel setup-panel">
          <div className="section-heading-row">
            <h3 className="section-heading"><img src={sectionIcons.profile} alt="" className="section-icon-lg" />Profilo</h3>
            {googleEnabled ? (
              <div className="google-login-wrap">
                <div ref={googleButtonHostRef} />
              </div>
            ) : null}
          </div>
          {googleEnabled && googleLoginError ? <p className="hint">{googleLoginError}</p> : null}
          <div className="editor-grid">
            <label>Alias<input value={profile.alias} onChange={(e) => updateProfileField('alias', e.target.value)} /></label>
            <label>Nome<input value={profile.nome} onChange={(e) => updateProfileField('nome', e.target.value)} /></label>
            <label>Cognome<input value={profile.cognome} onChange={(e) => updateProfileField('cognome', e.target.value)} /></label>
            <label>Email<input type="email" value={profile.email} onChange={(e) => updateProfileField('email', e.target.value)} /></label>
            <label>
              Sesso
              <select value={profile.sesso} onChange={(e) => updateProfileField('sesso', e.target.value)}>
                <option value="maschio">Maschio</option>
                <option value="femmina">Femmina</option>
                <option value="altro">Altro</option>
              </select>
            </label>
            <label>Altezza (cm)<input type="number" min="0" step="1" value={profile.altezza} onChange={(e) => updateProfileField('altezza', e.target.value)} /></label>
          </div>
          <div className="weight-panel">
            <h4>Peso (storico per data)</h4>
            <div className="weight-entry-row">
              <label>
                Data
                <input type="date" value={weightEntryDate} onChange={(e) => setWeightEntryDate(e.target.value)} />
              </label>
              <label>
                Peso (kg)
                <input type="number" min="1" step="0.1" value={weightEntryValue} onChange={(e) => setWeightEntryValue(e.target.value)} />
              </label>
              <button type="button" title="Salva peso" aria-label="Salva peso" onClick={addOrUpdateWeightEntry}>💾</button>
            </div>
            <div className="weight-history-list">
              {sortedWeightHistory.length ? (
                sortedWeightHistory.map((row) => (
                  <div className="weight-history-item" key={row.date}>
                    <span>{row.date}</span>
                    <strong>{row.weight} kg</strong>
                    <button type="button" title="Rimuovi peso" aria-label="Rimuovi peso" onClick={() => removeWeightEntry(row.date)}>🗑</button>
                  </div>
                ))
              ) : (
                <p className="hint">Nessun peso registrato.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeView === 'setup' ? (
        <section className="panel compact-panel setup-panel">
          <h3 className="section-heading"><img src={sectionIcons.setup} alt="" className="section-icon-lg" />Configurazione Training e Livello</h3>
          <div className="editor-grid">
            <label>
              Training
              <select value={trainingKey} onChange={(e) => setTrainingKey(e.target.value)}>
                {Object.entries(TRAINING_CONFIGS).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </label>
            <label>
              Livello
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {Object.entries(levels).map(([key, value]) => (
                  <option key={key} value={key}>{value.label || key}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {activeView === 'settings' ? (
        <section className="panel compact-panel setup-panel">
          <h3 className="section-heading"><span className="section-glyph-icon" aria-hidden="true">⚙</span>Settings</h3>
          <div className="settings-tabs" role="tablist" aria-label="Gruppi settings">
            <button type="button" className={settingsTab === 'video' ? 'active' : ''} onClick={() => setSettingsTab('video')}>Video</button>
            <button type="button" className={settingsTab === 'clock' ? 'active' : ''} onClick={() => setSettingsTab('clock')}>Clock</button>
            <button type="button" className={settingsTab === 'voice' ? 'active' : ''} onClick={() => setSettingsTab('voice')}>Vocale</button>
          </div>

          <div className="settings-panels">
            {settingsTab === 'video' ? (
              <div className="settings-panel">
                <h4>Video</h4>
                <div className="settings-grid">
                  <SettingsToggle label="Audio video" checked={videoAudioEnabled} onChange={setVideoAudioEnabled} />
                </div>
                <p className="hint">{videoAudioEnabled ? 'Audio video abilitato.' : 'Audio video disabilitato (default).'}</p>
              </div>
            ) : null}

            {settingsTab === 'clock' ? (
              <div className="settings-panel">
                <h4>Clock</h4>
                <div className="settings-grid">
                  <SettingsToggle label="Clock attivo" checked={clockEnabled} onChange={setClockEnabled} />
                  <label>
                    Volume clock: {clockVolumePct}%
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={clockVolumePct}
                      onChange={(e) => setClockVolumePct(clampRange(Number(e.target.value), 0, 100))}
                      disabled={!clockEnabled}
                    />
                  </label>
                  <label>
                    Cadenza clock: {clockCadenceSec}s
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={clockCadenceSec}
                      onChange={(e) => setClockCadenceSec(clampRange(Number(e.target.value), 5, 60))}
                      disabled={!clockEnabled}
                    />
                  </label>
                </div>
                <p className="hint">{clockEnabled ? `Clock attivo: beep ogni ${clockCadenceSec} secondi (volume ${clockVolumePct}%).` : 'Clock disabilitato.'}</p>
              </div>
            ) : null}

            {settingsTab === 'voice' ? (
              <div className="settings-panel">
                <h4>Vocale</h4>
                <div className="settings-grid">
                  <SettingsToggle label="Vocale attivo" checked={voiceEnabled} onChange={setVoiceEnabled} />
                  <label>
                    Voce
                    <select
                      value={voiceGender}
                      onChange={(e) => setVoiceGender(e.target.value === 'maschio' ? 'maschio' : 'femmina')}
                      disabled={!voiceEnabled}
                    >
                      <option value="femmina">Femmina</option>
                      <option value="maschio">Maschio</option>
                    </select>
                  </label>
                  <label>
                    Volume voce: {voiceVolumePct}%
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={voiceVolumePct}
                      onChange={(e) => setVoiceVolumePct(clampRange(Number(e.target.value), 0, 100))}
                      disabled={!voiceEnabled}
                    />
                  </label>
                  <SettingsToggle label="Leggi Esecuzione" checked={voiceSpeakExecution} onChange={setVoiceSpeakExecution} disabled={!voiceEnabled} />
                  <SettingsToggle label="Leggi Respirazione" checked={voiceSpeakBreathing} onChange={setVoiceSpeakBreathing} disabled={!voiceEnabled} />
                  <SettingsToggle label="Leggi Errori" checked={voiceSpeakErrors} onChange={setVoiceSpeakErrors} disabled={!voiceEnabled} />
                </div>
                <p className="hint">{voiceEnabled ? `Vocale attivo (${voiceGender}, volume ${voiceVolumePct}%).` : 'Vocale disabilitato.'}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeView === 'training' ? (
        <>
              <section className="panel compact-panel setup-panel">
                <h3 className="section-heading"><img src={sectionIcons.training} alt="" className="section-icon-lg" />{`Training: ${trainingLabel}`}</h3>
              </section>
              <section className="timer-strip">
                <div className="timer-metrics">
                  <div><strong>Training:</strong> {trainingLabel}</div>
                  <div><strong>Totale:</strong> {formatTime(totalRemaining)}</div>
                  <div><strong>Scheda:</strong> {formatTime(currentRemaining)}</div>
                  <div><strong>Attuale:</strong> {currentCard?.name || 'N/A'}</div>
                </div>
                <div className="timer-progress-row" aria-label={`Progresso programma ${programProgressPct.toFixed(0)} percento`}>
                  <div className="timer-progress-track">
                    <div className="timer-progress-fill" style={{ width: `${programProgressPct}%` }} />
                  </div>
                  <span className="timer-progress-value">{`${programProgressPct.toFixed(0)}%`}</span>
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
                  {'<'}
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
                  {'>'}
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
                currentCard ? <ProgramCard card={{ ...currentCard, onCameraSaved: handleCameraSaved, onClipSelected: handleClipSelected, onClipOptions: handleClipOptions, onVideoSegmentChange: handleVideoSegmentChange, onModelAssetSelected: handleModelAssetSelected, videoSources, isEditMode, theme, modelOptions, videoMuted: !videoAudioEnabled }} cardProgressPct={currentCardProgressPct} /> : null
              ) : (
                selectedCard ? <ProgramCard card={{ ...selectedCard, onCameraSaved: handleCameraSaved, onClipSelected: handleClipSelected, onClipOptions: handleClipOptions, onVideoSegmentChange: handleVideoSegmentChange, onModelAssetSelected: handleModelAssetSelected, videoSources, isEditMode, theme, modelOptions, videoMuted: !videoAudioEnabled }} cardProgressPct={currentCardProgressPct} /> : null
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
                            aria-label={inUse ? 'Sorgente usata da almeno una scheda' : 'Rimuovi sorgente'}
                            onClick={() => setVideoSources((sources) => sources.filter((u) => u !== url))}
                          >
                            🗑
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
                        title="Aggiungi sorgente"
                        aria-label="Aggiungi sorgente"
                        onClick={() => {
                          const url = newVideoSource.trim()
                          if (!url) return
                          setVideoSources((sources) => (sources.includes(url) ? sources : [...sources, url]))
                          setNewVideoSource('')
                        }}
                      >
                        💾
                      </button>
                    </div>
                  </div>
                  <div className="editor-actions">
                    <button type="button" title="Salva JSON Programma" aria-label="Salva JSON Programma" onClick={saveProgramJson}>💾</button>
                  </div>
                </section>
              ) : null}
        </>
      ) : null}

      {activeView === 'history' ? (
        <section className="panel compact-panel setup-panel">
          <h3 className="section-heading"><img src={sectionIcons.history} alt="" className="section-icon-lg" />Storico Allenamenti</h3>
          <div className="history-calendar-head">
            <button
              type="button"
              onClick={() => setHistoryMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            >
              {'<'}
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              onClick={() => setHistoryMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            >
              {'>'}
            </button>
          </div>
          <div className="history-weekdays">
            <span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span>
          </div>
          <div className="history-calendar-grid">
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} className="history-day empty" />
              const isSelected = cell.dateKey === selectedHistoryDate
              return (
                <button
                  type="button"
                  key={cell.dateKey}
                  className={`history-day${cell.count ? ' has-events' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedHistoryDate(cell.dateKey)
                    setSelectedHistoryEventId((workoutEventsByDate.get(cell.dateKey) || [])[0]?.id || null)
                  }}
                >
                  <span className="day-number">{cell.day}</span>
                  {cell.count ? <span className="day-badge">{cell.count}</span> : null}
                </button>
              )
            })}
          </div>

          <div className="history-events">
            <h4>{`Eventi del ${selectedHistoryDate}`}</h4>
            {selectedHistoryEvents.length ? (
              selectedHistoryEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`history-event-item${selectedHistoryEvent?.id === event.id ? ' active' : ''}`}
                  onClick={() => setSelectedHistoryEventId(event.id)}
                >
                  <span>{new Date(event.startAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                  <strong>{event.trainingLabel}</strong>
                  <span>{`${formatTime(event.durationSec)}`}</span>
                </button>
              ))
            ) : (
              <p className="hint">Nessun allenamento registrato in questa data.</p>
            )}
          </div>

          {selectedHistoryEvent ? (
            <div className="history-event-detail">
              <h4>Dettaglio Evento</h4>
              <p><strong>Start:</strong> {new Date(selectedHistoryEvent.startAt).toLocaleString('it-IT')}</p>
              <p><strong>Fine:</strong> {new Date(selectedHistoryEvent.endAt).toLocaleString('it-IT')}</p>
              <p><strong>Durata:</strong> {formatTime(selectedHistoryEvent.durationSec)}</p>
              <p><strong>Tipo allenamento:</strong> {selectedHistoryEvent.trainingLabel}</p>
              <p><strong>Livello allenamento:</strong> {selectedHistoryEvent.level || 'N/D'}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === 'results' ? (
        <section className="panel compact-panel setup-panel">
          <h3 className="section-heading"><img src={sectionIcons.results} alt="" className="section-icon-lg" />Risultati</h3>
          {latestWeight ? (
            <p className="hint">{`Ultimo peso: ${latestWeight.weight} kg (${latestWeight.date})`}</p>
          ) : (
            <p className="hint">Nessun dato peso disponibile.</p>
          )}
          {sortedWeightHistory.length >= 2 ? (
            <div className="weight-chart-wrap">
              <svg ref={weightChartRef} className="weight-chart" />
              <div className="weight-chart-legend">
                {sortedWeightHistory.map((row) => (
                  <div key={`legend-${row.date}`} className="weight-chart-legend-item">
                    <span>{row.date}</span>
                    <strong>{row.weight} kg</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="hint">Inserisci almeno due pesi per visualizzare il diagramma.</p>
          )}
        </section>
      ) : null}

      <section className="panel compact-panel setup-panel">
        <div className="setup-nav">
          <button type="button" disabled={!canGoPrev} onClick={goPrevSection}>{'<'}</button>
          <button type="button" disabled={!canGoNext} onClick={goNextSection}>{'>'}</button>
        </div>
      </section>

    </main>
  )
}
