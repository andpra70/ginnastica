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

function scaleReps(reps, factor) {
  if (typeof reps !== 'string') return reps
  return reps.replace(/\d+(\.\d+)?/g, (match) => {
    const num = Number(match)
    if (!Number.isFinite(num)) return match
    return String(Math.max(1, Math.round(num * factor)))
  })
}

function toCard(card, section, levelCfg) {
  const setMultiplier = levelCfg?.setMultiplier || 1
  const durationMultiplier = levelCfg?.durationMultiplier || 1
  return {
    ...card,
    section,
    setsScaled: Math.max(1, Math.round((card.sets || 1) * setMultiplier)),
    durationScaledSec: Math.max(20, Math.round((card.durationSec || 60) * durationMultiplier)),
    repsScaled: scaleReps(card.reps || '', durationMultiplier)
  }
}

function ProgramCard({ card }) {
  return (
    <section className="panel compact-panel detail program-card">
      <div className="detail-head">
        <div>
          <p className="hint">{card.section}</p>
          <div className="title-inline">
            <h3>{card.name}</h3>
            <p className="timer-chip">Timer scheda: {formatTime(card.durationScaledSec)}</p>
          </div>
          <p className="hint">{card.type} • {card.setsScaled} serie • {card.repsScaled || card.reps}</p>
        </div>
        <ExerciseRenderer type={card.animationType} />
      </div>

      <div className="vertical-sections">
        <article>
          <h4>Esecuzione</h4>
          <ul>{card.execution.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article>
          <h4>Errori</h4>
          <ul>{card.mistakes.map((item) => <li key={item}>{item}</li>)}</ul>
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

  const allCfg = appConfig?.allenamento || {}
  const levels = allCfg.livelli || {}
  const levelCfg = levels[level] || Object.values(levels)[0] || { setMultiplier: 1, durationMultiplier: 1 }

  const warmupCards = useMemo(() => (allCfg.warmup || []).map((c) => toCard(c, 'Warmup', levelCfg)), [allCfg.warmup, levelCfg])
  const exerciseCards = useMemo(() => (allCfg.esercizi || []).map((c) => toCard(c, 'Esercizio', levelCfg)), [allCfg.esercizi, levelCfg])
  const stretchingCards = useMemo(() => (allCfg.stretching || []).map((c) => toCard(c, 'Stretching', levelCfg)), [allCfg.stretching, levelCfg])
  const programCards = useMemo(
    () => [...warmupCards, ...exerciseCards, ...stretchingCards],
    [warmupCards, exerciseCards, stretchingCards]
  )

  const [videoExerciseId, setVideoExerciseId] = useState(exerciseCards[0]?.id || '')

  useEffect(() => {
    if (!exerciseCards.some((c) => c.id === videoExerciseId)) {
      setVideoExerciseId(exerciseCards[0]?.id || '')
    }
  }, [exerciseCards, videoExerciseId])

  const videoEditorExercise = useMemo(() => {
    const card = exerciseCards.find((c) => c.id === videoExerciseId) || exerciseCards[0]
    if (!card) return null
    return {
      ...card,
      video: card.video || { url: appConfig.videoSources?.[0] || '', start: 0, end: 20 }
    }
  }, [exerciseCards, videoExerciseId])

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
    if (currentRemaining <= 0) {
      setCurrentRemaining(programCards[playIndex]?.durationScaledSec || 0)
    }
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

  return (
    <main className="layout compact-layout">
      <header className="hero compact-hero">
        <div className="brand-row">
          <img src="/decathlon.svg" alt="Decathlon" className="brand-logo-img" />
          <h1>Trainer</h1>
          <div className="burger-wrap">
            <button
              type="button"
              className="burger-btn"
              aria-label="Apri menu sezioni"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
            {menuOpen ? (
              <div className="burger-menu">
                <button type="button" className={activeView === 'trainer' ? 'active' : ''} onClick={() => { setActiveView('trainer'); setMenuOpen(false) }}>Trainer</button>
                <button type="button" className={activeView === 'video' ? 'active' : ''} onClick={() => { setActiveView('video'); setMenuOpen(false) }}>Video Editor</button>
                <button type="button" className={activeView === 'grabber' ? 'active' : ''} onClick={() => { setActiveView('grabber'); setMenuOpen(false) }}>Grabber</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {activeView === 'trainer' ? (
        <>
          <section className="panel compact-panel controls level-play-row light-controls">
            <label>
              Livello
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {Object.entries(levels).map(([key, value]) => (
                  <option key={key} value={key}>{value.label || key}</option>
                ))}
              </select>
            </label>
            <div className="play-actions-inline">
              {playMode ? (
                <button type="button" className="play-active" onClick={stopPlay}>STOP</button>
              ) : (
                <button type="button" onClick={startPlay}>PLAY</button>
              )}
              {playMode ? (
                <button type="button" onClick={() => setPlayRunning((v) => !v)}>{playRunning ? 'PAUSA' : 'RIPRENDI'}</button>
              ) : null}
            </div>
          </section>

          <section className="timer-strip">
            <div><strong>Totale:</strong> {formatTime(totalRemaining)}</div>
            <div><strong>Scheda:</strong> {formatTime(currentRemaining)}</div>
            <div><strong>Attuale:</strong> {currentCard?.name || 'N/A'}</div>
          </section>

          {playMode ? (
            currentCard ? <ProgramCard card={currentCard} /> : null
          ) : (
            <div className="cards-cascade">
              {programCards.map((card) => <ProgramCard key={card.id} card={card} />)}
            </div>
          )}
        </>
      ) : null}

      {activeView === 'video' ? (
        <section className="panel compact-panel detail">
          <h2>Video Editor</h2>
          <label>
            Esercizio
            <select value={videoExerciseId} onChange={(e) => setVideoExerciseId(e.target.value)}>
              {exerciseCards.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
          {videoEditorExercise ? <ExerciseVideoLoop exercise={videoEditorExercise} videoSources={appConfig.videoSources || []} /> : null}
        </section>
      ) : null}

      {activeView === 'grabber' ? <RegionVideoGrabber /> : null}

      <footer className="app-footer">
        <div className="brand-logo" aria-hidden>GT</div>
        <span>Ginnastica Trainer</span>
      </footer>
    </main>
  )
}
