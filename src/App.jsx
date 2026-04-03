import { useEffect, useMemo, useState } from 'react'
import ExerciseRenderer from './three/ExerciseRenderer'
import ExerciseVideoLoop from './components/ExerciseVideoLoop'
import RegionVideoGrabber from './components/RegionVideoGrabber'
import appConfig from './config/config.json'
import { buildWorkout, exercises, warmupSteps } from './data/exercises'

export default function App() {
  const [activeView, setActiveView] = useState('trainer')
  const [level, setLevel] = useState('base')
  const [duration, setDuration] = useState(30)
  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0].id)

  const plan = useMemo(() => buildWorkout(duration, level), [duration, level])

  const selectedExercise = useMemo(
    () => exercises.find((ex) => ex.id === selectedExerciseId) ?? plan[0] ?? exercises[0],
    [selectedExerciseId, plan]
  )

  useEffect(() => {
    if (!plan.some((ex) => ex.id === selectedExerciseId) && plan[0]) {
      setSelectedExerciseId(plan[0].id)
    }
  }, [plan, selectedExerciseId])

  return (
    <main className="layout">
      <header className="hero">
        <h1>Calisthenics Trainer</h1>
        <p>Programma sotto /ginnastica con riscaldamento, selezione durata/livello e guida tecnica completa.</p>
        <nav className="top-nav">
          <button
            type="button"
            className={activeView === 'trainer' ? 'active' : ''}
            onClick={() => setActiveView('trainer')}
          >
            Trainer
          </button>
          <button
            type="button"
            className={activeView === 'video' ? 'active' : ''}
            onClick={() => setActiveView('video')}
          >
            Video Editor
          </button>
          <button
            type="button"
            className={activeView === 'grabber' ? 'active' : ''}
            onClick={() => setActiveView('grabber')}
          >
            Grabber
          </button>
        </nav>
      </header>

      {activeView === 'trainer' ? (
        <>
          <section className="panel controls">
            <h2>1) Configura allenamento</h2>
            <div className="control-grid">
              <label>
                Livello
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="base">Base</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzato">Avanzato</option>
                </select>
              </label>

              <label>
                Durata totale: <strong>{duration} min</strong>
                <input
                  type="range"
                  min="20"
                  max="75"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>2) Riscaldamento guidato</h2>
            <div className="warmup-grid">
              {warmupSteps.map((step) => (
                <article key={step.name} className="warmup-card">
                  <h3>{step.name}</h3>
                  <p className="badge">{step.duration}</p>
                  <p>{step.cue}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>3) Esercizi consigliati</h2>
            <p className="hint">Piano automatico per {duration} min, livello {level}.</p>
            <div className="exercise-grid">
              {plan.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className={`exercise-card ${selectedExercise.id === ex.id ? 'active' : ''}`}
                  onClick={() => setSelectedExerciseId(ex.id)}
                >
                  <h3>{ex.name}</h3>
                  <p>{ex.type}</p>
                  <p>{ex.sets} serie • {ex.reps}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="panel detail">
            <div className="detail-head">
              <div>
                <h2>4) Dettaglio esercizio</h2>
                <h3>{selectedExercise.name}</h3>
                <p className="hint">{selectedExercise.type} • {selectedExercise.sets} serie • {selectedExercise.reps}</p>
              </div>
              <ExerciseRenderer type={selectedExercise.animationType} />
            </div>

            <div className="detail-grid">
              <article>
                <h4>Esecuzione corretta</h4>
                <ul>
                  {selectedExercise.execution.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>

              <article>
                <h4>Errori da evitare</h4>
                <ul>
                  {selectedExercise.mistakes.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>

              <article>
                <h4>Respirazione</h4>
                <p>{selectedExercise.breathing}</p>
              </article>
            </div>
          </section>
        </>
      ) : null}

      {activeView === 'video' ? (
        <section className="panel detail">
          <h2>Video Editor</h2>
          <label>
            Esercizio
            <select value={selectedExerciseId} onChange={(e) => setSelectedExerciseId(e.target.value)}>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
          <ExerciseVideoLoop exercise={selectedExercise} videoSources={appConfig.videoSources || []} />
        </section>
      ) : null}

      {activeView === 'grabber' ? <RegionVideoGrabber /> : null}
    </main>
  )
}
