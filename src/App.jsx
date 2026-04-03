import { useEffect, useMemo, useState } from 'react'
import ExerciseRenderer from './three/ExerciseRenderer'
import ExerciseVideoLoop from './components/ExerciseVideoLoop'
import RegionVideoGrabber from './components/RegionVideoGrabber'
import appConfig from './config/config.json'

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

function getEditMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('edit') === '1'
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
    viewerType: card.viewerType || '3d',
    video: card.video || { url: '', start: 0, end: 20 }
  }
}

function orderByClass(cards) {
  const rank = { warmup: 1, esercizio: 2, stretching: 3 }
  return [...cards].sort((a, b) => (rank[a.classKey] || 99) - (rank[b.classKey] || 99))
}

function toExportProgram(cards, levels) {
  const clean = (card) => {
    const base = { ...card }
    delete base.classKey
    if (!base.video?.url) delete base.video
    return base
  }
  return {
    videoSources: appConfig.videoSources || [],
    allenamento: {
      livelli: levels,
      warmup: cards.filter((c) => c.classKey === 'warmup').map(clean),
      esercizi: cards.filter((c) => c.classKey === 'esercizio').map(clean),
      stretching: cards.filter((c) => c.classKey === 'stretching').map(clean)
    }
  }
}

function CardViewer({ card }) {
  if (card.viewerType === 'video') {
    const id = parseYouTubeVideoId(card.video?.url)
    if (!id) return <div className="figure-card">Video non configurato</div>
    const start = Number(card.video?.start || 0)
    return (
      <div className="figure-card figure-card-3d">
        <iframe
          title={`video-${card.id}`}
          src={`https://www.youtube.com/embed/${id}?start=${Math.max(0, Math.floor(start))}&rel=0&playsinline=1`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>
    )
  }
  return <ExerciseRenderer type={card.animationType} />
}

function ProgramCard({ card }) {
  return (
    <section className="panel compact-panel detail program-card">
      <div className="detail-head">
        <div>
          <p className="hint">Classe: {card.classKey}</p>
          <div className="title-inline">
            <h3>{card.name}</h3>
            <p className="timer-chip">Timer scheda: {formatTime(card.durationScaledSec)}</p>
          </div>
          <p className="hint">{card.type} • {card.setsScaled} serie • {card.repsScaled || card.reps}</p>
          <p className="hint">Viewer: {card.viewerType} • animationType: {card.animationType}</p>
        </div>
        <CardViewer card={card} />
      </div>

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
    </section>
  )
}

export default function App() {
  const [activeView, setActiveView] = useState('trainer')
  const [menuOpen, setMenuOpen] = useState(false)
  const [level, setLevel] = useState('base')
  const [playMode, setPlayMode] = useState(false)
  const [playRunning, setPlayRunning] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [currentRemaining, setCurrentRemaining] = useState(0)

  const isEditMode = getEditMode()
  const logoSrc = `${import.meta.env.BASE_URL}decathlon.svg`

  const allCfg = appConfig?.allenamento || {}
  const levels = allCfg.livelli || {}
  const levelCfg = levels[level] || Object.values(levels)[0] || { setMultiplier: 1, durationMultiplier: 1 }

  const [programCardsBase, setProgramCardsBase] = useState(() => {
    const warmup = (allCfg.warmup || []).map((c) => normalizeCard(c, 'warmup'))
    const esercizi = (allCfg.esercizi || []).map((c) => normalizeCard(c, 'esercizio'))
    const stretching = (allCfg.stretching || []).map((c) => normalizeCard(c, 'stretching'))
    return orderByClass([...warmup, ...esercizi, ...stretching])
  })

  const programCards = useMemo(() => {
    const setMultiplier = levelCfg?.setMultiplier || 1
    const durationMultiplier = levelCfg?.durationMultiplier || 1
    return orderByClass(
      programCardsBase.map((card) => ({
        ...card,
        setsScaled: Math.max(1, Math.round((card.sets || 1) * setMultiplier)),
        durationScaledSec: Math.max(20, Math.round((card.durationSec || 60) * durationMultiplier)),
        repsScaled: scaleReps(card.reps || '', durationMultiplier)
      }))
    )
  }, [programCardsBase, levelCfg])

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
      setCurrentRemaining(programCards[0]?.durationScaledSec || 0)
      return
    }
    if (currentRemaining <= 0) setCurrentRemaining(programCards[playIndex]?.durationScaledSec || 0)
  }, [playMode, totalProgramSec, programCards, playIndex, currentRemaining])

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

  const currentCard = programCards[playIndex]

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
    setCurrentRemaining(programCards[0]?.durationScaledSec || 0)
  }

  const saveProgramJson = () => {
    const payload = toExportProgram(programCardsBase, levels)
    localStorage.setItem('ginnastica.program.json', JSON.stringify(payload))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'program-allenamento.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const videoEditorCard = selectedCard
    ? {
      ...selectedCard,
      video: selectedCard.video?.url ? selectedCard.video : { url: appConfig.videoSources?.[0] || '', start: 0, end: 20 }
    }
    : null

  return (
    <main className="layout compact-layout">
      <header className="hero compact-hero">
        <div className="brand-row">
          <img src={logoSrc} alt="Decathlon" className="brand-logo-img" />
          <h1>Trainer</h1>
          <div className="burger-wrap">
            {activeView === 'trainer' ? (
              <div className="nav-play-controls" aria-label="Controlli playback">
                {!playMode ? (
                  <button type="button" className="icon-btn" title="Play" aria-label="Play" onClick={startPlay}>▶</button>
                ) : (
                  <>
                    <button type="button" className="icon-btn" title="Stop" aria-label="Stop" onClick={stopPlay}>■</button>
                    <button
                      type="button"
                      className="icon-btn"
                      title={playRunning ? 'Pausa' : 'Continua'}
                      aria-label={playRunning ? 'Pausa' : 'Continua'}
                      onClick={() => setPlayRunning((v) => !v)}
                    >
                      {playRunning ? '❚❚' : '▶'}
                    </button>
                  </>
                )}
              </div>
            ) : null}
            <button type="button" className="burger-btn" aria-label="Apri menu sezioni" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            {menuOpen ? (
              <div className="burger-menu">
                <button type="button" className={activeView === 'trainer' ? 'active' : ''} onClick={() => { setActiveView('trainer'); setMenuOpen(false) }}>Trainer</button>
                <button type="button" className={activeView === 'video' ? 'active' : ''} onClick={() => { setActiveView('video'); setMenuOpen(false) }}>Video Editor</button>
                <button type="button" className={activeView === 'grabber' ? 'active' : ''} onClick={() => { setActiveView('grabber'); setMenuOpen(false) }}>Grabber</button>
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
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {activeView === 'trainer' ? (
        <>
          <section className="timer-strip">
            <div className="timer-metrics">
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
          </section>

          {playMode ? (
            currentCard ? <ProgramCard card={currentCard} /> : null
          ) : (
            selectedCard ? <ProgramCard card={selectedCard} /> : null
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
                <label>Type<input value={selectedCard.type} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, type: e.target.value } : c))} /></label>
                <label>Durata (sec)<input type="number" value={selectedCard.durationSec} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, durationSec: Number(e.target.value) || 0 } : c))} /></label>
                <label>Serie<input type="number" value={selectedCard.sets} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, sets: Number(e.target.value) || 1 } : c))} /></label>
                <label>Reps<input value={selectedCard.reps} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, reps: e.target.value } : c))} /></label>
                <label>Video URL<input value={selectedCard.video?.url || ''} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, video: { ...(c.video || {}), url: e.target.value } } : c))} /></label>
                <label>Video Start<input type="number" value={selectedCard.video?.start || 0} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, video: { ...(c.video || {}), start: Number(e.target.value) || 0 } } : c))} /></label>
                <label>Video End<input type="number" value={selectedCard.video?.end || 20} onChange={(e) => setProgramCardsBase((cards) => cards.map((c) => c.id === selectedCard.id ? { ...c, video: { ...(c.video || {}), end: Number(e.target.value) || 0 } } : c))} /></label>
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

      {activeView === 'grabber' ? <RegionVideoGrabber /> : null}

      <footer className="app-footer">
        <div className="brand-logo" aria-hidden>GT</div>
        <span>Trainer</span>
      </footer>
    </main>
  )
}
