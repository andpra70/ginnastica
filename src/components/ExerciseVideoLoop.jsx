import { useEffect, useMemo, useRef, useState } from 'react'

const YT_API_SRC = 'https://www.youtube.com/iframe_api'

function parseYouTubeVideoId(url = '') {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '')
    }
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v') || ''
    }
    return ''
  } catch {
    return ''
  }
}

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

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function formatSec(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function isReadyPlayer(player) {
  return (
    !!player &&
    typeof player.seekTo === 'function' &&
    typeof player.playVideo === 'function' &&
    typeof player.getCurrentTime === 'function'
  )
}

export default function ExerciseVideoLoop({ exercise, videoSources = [] }) {
  const playerHostRef = useRef(null)
  const timelineRef = useRef(null)
  const playerRef = useRef(null)
  const pollerRef = useRef(null)
  const movedDuringDragRef = useRef(false)

  const defaults = exercise?.video || { start: 0, end: 20, url: '' }
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(defaults.url || videoSources[0] || '')
  const videoId = useMemo(() => parseYouTubeVideoId(selectedVideoUrl), [selectedVideoUrl])
  const storageKey = `ginnastica.videoLoop.${exercise?.id || 'none'}`

  const [startSec, setStartSec] = useState(defaults.start)
  const [endSec, setEndSec] = useState(defaults.end)
  const [currentSec, setCurrentSec] = useState(0)
  const [segmentTitle, setSegmentTitle] = useState('')
  const [durationSec, setDurationSec] = useState(Math.max(defaults.end + 10, 60))
  const [draggingHandle, setDraggingHandle] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')

  useEffect(() => {
    const savedRaw = localStorage.getItem(storageKey)
    if (!savedRaw) {
      setStartSec(defaults.start)
      setEndSec(defaults.end)
      setSegmentTitle(exercise?.name || '')
      const fallbackUrl = defaults.url || videoSources[0] || ''
      setSelectedVideoUrl(fallbackUrl)
      return
    }

    try {
      const saved = JSON.parse(savedRaw)
      const start = toNumber(saved.start, defaults.start)
      const end = toNumber(saved.end, defaults.end)
      const title = typeof saved.title === 'string' ? saved.title : ''
      const savedUrl = typeof saved.videoUrl === 'string' ? saved.videoUrl : ''
      const fallbackUrl = defaults.url || videoSources[0] || ''
      setStartSec(Math.max(0, start))
      setEndSec(Math.max(start + 1, end))
      setSegmentTitle(title || exercise?.name || '')
      setDurationSec((prev) => Math.max(prev, end + 10))
      setSelectedVideoUrl(savedUrl || fallbackUrl)
    } catch {
      setStartSec(defaults.start)
      setEndSec(defaults.end)
      setSegmentTitle(exercise?.name || '')
      setSelectedVideoUrl(defaults.url || videoSources[0] || '')
    }
  }, [storageKey, defaults.start, defaults.end, defaults.url, exercise?.name, videoSources])

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return undefined

    let cancelled = false
    ensureYouTubeApi().then((YT) => {
      if (cancelled) return

      if (playerRef.current) {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
        playerRef.current = null
      }

      playerRef.current = new YT.Player(playerHostRef.current, {
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            const player = playerRef.current
            if (!isReadyPlayer(player)) return
            const duration = Number(player.getDuration?.() || 0)
            if (duration > 1) setDurationSec(duration)
            player.seekTo(startSec, true)
            player.playVideo()
          }
        }
      })
    })

    return () => {
      cancelled = true
      if (playerRef.current) {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
        playerRef.current = null
      }
    }
  }, [videoId])

  useEffect(() => {
    if (!isReadyPlayer(playerRef.current)) return undefined

    if (pollerRef.current) {
      window.clearInterval(pollerRef.current)
      pollerRef.current = null
    }

    const player = playerRef.current
    if (isReadyPlayer(player)) {
      player.seekTo(startSec, true)
      player.playVideo()
    }

    pollerRef.current = window.setInterval(() => {
      const p = playerRef.current
      if (!isReadyPlayer(p)) return
      const now = p.getCurrentTime()
      setCurrentSec(now)
      const duration = Number(p.getDuration?.() || 0)
      if (duration > 1) setDurationSec(duration)
      if (now >= endSec) {
        p.seekTo(startSec, true)
        p.playVideo()
      }
    }, 200)

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        exerciseId: exercise.id,
        title: segmentTitle || exercise.name,
        videoUrl: selectedVideoUrl,
        start: Number(startSec.toFixed(1)),
        end: Number(endSec.toFixed(1)),
        snippet: `{"title":"${segmentTitle || exercise.name}","start":${Number(startSec.toFixed(1))},"stop":${Number(endSec.toFixed(1))}}`
      })
    )

    return () => {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current)
        pollerRef.current = null
      }
    }
  }, [startSec, endSec, storageKey, exercise.id, exercise.name, selectedVideoUrl, segmentTitle])

  if (!selectedVideoUrl) {
    return null
  }

  const maxDuration = 600
  const safeDuration = Math.max(durationSec, endSec + 1, 10)
  const startPct = clamp((startSec / safeDuration) * 100, 0, 100)
  const endPct = clamp((endSec / safeDuration) * 100, 0, 100)
  const segmentPct = clamp(endPct - startPct, 0, 100)

  const setLoopStartFromCurrent = () => {
    const now = isReadyPlayer(playerRef.current) ? playerRef.current.getCurrentTime() : startSec
    const nextStart = Math.max(0, Math.min(now, endSec - 1))
    setStartSec(Number(nextStart.toFixed(1)))
  }

  const setLoopEndFromCurrent = () => {
    const now = isReadyPlayer(playerRef.current) ? playerRef.current.getCurrentTime() : endSec
    const nextEnd = Math.max(startSec + 1, now)
    setEndSec(Number(nextEnd.toFixed(1)))
  }

  const saveNamedSegment = () => {
    const title = (segmentTitle || '').trim() || exercise.name
    const key = `ginnastica.videoLoop.segments.${exercise.id}`
    const payload = {
      title,
      start: Number(startSec.toFixed(1)),
      stop: Number(endSec.toFixed(1)),
      videoUrl: selectedVideoUrl,
      savedAt: new Date().toISOString()
    }

    let existing = []
    try {
      const raw = localStorage.getItem(key)
      existing = raw ? JSON.parse(raw) : []
      if (!Array.isArray(existing)) existing = []
    } catch {
      existing = []
    }

    const withoutSameTitle = existing.filter((item) => item?.title !== title)
    localStorage.setItem(key, JSON.stringify([payload, ...withoutSameTitle]))
  }

  const pointerXToSec = (clientX) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return null
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    return Number((ratio * safeDuration).toFixed(1))
  }

  useEffect(() => {
    if (!draggingHandle) return undefined

    const onPointerMove = (event) => {
      const sec = pointerXToSec(event.clientX)
      if (sec == null) return
      movedDuringDragRef.current = true

      if (draggingHandle === 'start') {
        setStartSec(clamp(sec, 0, endSec - 1))
      } else if (draggingHandle === 'end') {
        setEndSec(clamp(sec, startSec + 1, safeDuration))
      } else if (draggingHandle?.kind === 'segment') {
        const length = draggingHandle.length
        const offset = sec - draggingHandle.pointerStart
        const unclampedStart = draggingHandle.start + offset
        const nextStart = clamp(unclampedStart, 0, safeDuration - length)
        const nextEnd = nextStart + length
        setStartSec(Number(nextStart.toFixed(1)))
        setEndSec(Number(nextEnd.toFixed(1)))
      }
    }

    const onPointerUp = () => setDraggingHandle(null)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [draggingHandle, safeDuration, startSec, endSec])

  const exportSegmentVideo = async () => {
    if (exporting) return
    if (!window.MediaRecorder || !navigator.mediaDevices?.getDisplayMedia) {
      setExportStatus('Export non supportato in questo browser.')
      return
    }

    setExporting(true)
    setExportStatus('Seleziona la tab dell’app nella finestra di condivisione...')

    let stream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true
      })

      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ]
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data)
      }

      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve
      })

      const player = playerRef.current
      if (isReadyPlayer(player)) {
        player.seekTo(startSec, true)
        player.playVideo()
      }

      setExportStatus('Registrazione in corso...')
      recorder.start(200)
      const durationMs = Math.max(1000, Math.round((endSec - startSec) * 1000))
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, durationMs + 100)

      await stopped
      stream.getTracks().forEach((track) => track.stop())

      if (!chunks.length) {
        setExportStatus('Nessun frame registrato. Riprova condividendo la tab del browser.')
        return
      }

      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
      const title = (segmentTitle || exercise.name).trim().replace(/\s+/g, '_')
      const filename = `${title}_${startSec.toFixed(1)}-${endSec.toFixed(1)}.webm`
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      a.click()
      URL.revokeObjectURL(href)

      setExportStatus(`Esportato: ${filename}`)
    } catch {
      if (stream) stream.getTracks().forEach((track) => track.stop())
      setExportStatus('Export annullato o fallito.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="video-loop-panel">
      <div className="video-loop-head">
        <h4>Video esercizio (loop)</h4>
        <p className="hint">
          Loop attivo su {startSec.toFixed(1)}s → {endSec.toFixed(1)}s • tempo corrente {currentSec.toFixed(1)}s
        </p>
        <p className="hint">
          Segmento attivo {formatSec(startSec)} - {formatSec(endSec)} su totale {formatSec(safeDuration)} ({segmentPct.toFixed(1)}%)
        </p>
      </div>

      <div className="video-frame" ref={playerHostRef} />

      <div className="video-actions">
          <button type="button" onClick={setLoopStartFromCurrent}>Set Inizio</button>
        <button type="button" onClick={setLoopEndFromCurrent}>Set Fine</button>
      </div>

      {videoSources.length ? (
        <div className="video-source-select">
          <label>
            Video sorgente
            <select
              value={selectedVideoUrl}
              onChange={(event) => setSelectedVideoUrl(event.target.value)}
            >
              {videoSources.map((url) => (
                <option key={url} value={url}>{url}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div
        className="audio-clip-editor"
        ref={timelineRef}
        onClick={(event) => {
          if (movedDuringDragRef.current) {
            movedDuringDragRef.current = false
            return
          }
          const rect = timelineRef.current?.getBoundingClientRect()
          if (!rect) return
          const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
          const sec = ratio * safeDuration
          if (Math.abs(sec - startSec) <= Math.abs(sec - endSec)) {
            setStartSec(clamp(Number(sec.toFixed(1)), 0, endSec - 1))
          } else {
            setEndSec(clamp(Number(sec.toFixed(1)), startSec + 1, safeDuration))
          }
          if (isReadyPlayer(playerRef.current)) {
            playerRef.current.seekTo(sec, true)
          }
        }}
      >
        <div className="audio-wave" />
        <div
          className={`audio-segment-active ${draggingHandle?.kind === 'segment' ? 'dragging' : ''}`}
          style={{ left: `${startPct}%`, width: `${segmentPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation()
            movedDuringDragRef.current = false
            const pointerStart = pointerXToSec(event.clientX)
            if (pointerStart == null) return
            setDraggingHandle({
              kind: 'segment',
              pointerStart,
              start: startSec,
              end: endSec,
              length: endSec - startSec
            })
          }}
        />
        <div className="audio-cursor" style={{ left: `${clamp((currentSec / safeDuration) * 100, 0, 100)}%` }} />

        <button
          type="button"
          className="audio-handle start"
          style={{ left: `${startPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation()
            movedDuringDragRef.current = false
            setDraggingHandle('start')
          }}
          aria-label="Trascina inizio loop"
        />
        <button
          type="button"
          className="audio-handle end"
          style={{ left: `${endPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation()
            movedDuringDragRef.current = false
            setDraggingHandle('end')
          }}
          aria-label="Trascina fine loop"
        />
      </div>

      <div className="video-save-row">
        <label>
          Titolo segmento
          <input
            type="text"
            value={segmentTitle}
            onChange={(event) => setSegmentTitle(event.target.value)}
            placeholder="es. riscaldamento"
          />
        </label>
        <div className="video-save-actions">
          <button type="button" onClick={saveNamedSegment}>Salva Segmento</button>
          <button type="button" onClick={exportSegmentVideo} disabled={exporting}>
            {exporting ? 'Export in corso...' : 'Export Video'}
          </button>
        </div>
      </div>
      {exportStatus ? <p className="hint">{exportStatus}</p> : null}

      <div className="video-controls">
        <label>
          Start (secondi)
          <input
            type="number"
            min="0"
            max={Math.max(0, endSec - 1)}
            step="0.5"
            value={startSec}
            onChange={(event) => {
              const next = Math.max(0, toNumber(event.target.value, startSec))
              setStartSec(Math.min(next, endSec - 1))
            }}
          />
        </label>

        <label>
          End (secondi)
          <input
            type="number"
            min={startSec + 1}
            max={maxDuration}
            step="0.5"
            value={endSec}
            onChange={(event) => {
              const next = Math.max(startSec + 1, toNumber(event.target.value, endSec))
              setEndSec(next)
            }}
          />
        </label>
      </div>
    </section>
  )
}
