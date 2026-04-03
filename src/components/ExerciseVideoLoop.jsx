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

function safeDestroyPlayer(player) {
  if (!player) return
  try {
    if (typeof player.destroy === 'function') player.destroy()
  } catch {
    // Ignore third-party teardown errors from YT internals
  }
}

export default function ExerciseVideoLoop({ exercise, videoSources = [], onSegmentChange, editable = false }) {
  const playerHostRef = useRef(null)
  const timelineRef = useRef(null)
  const playerRef = useRef(null)
  const pollerRef = useRef(null)
  const movedDuringDragRef = useRef(false)
  const onSegmentChangeRef = useRef(onSegmentChange)

  useEffect(() => {
    onSegmentChangeRef.current = onSegmentChange
  }, [onSegmentChange])

  const defaults = exercise?.video || { start: 0, end: 20, url: '' }
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(defaults.url || videoSources[0] || '')
  const videoId = useMemo(() => parseYouTubeVideoId(selectedVideoUrl), [selectedVideoUrl])
  const storageKey = `ginnastica.videoLoop.${exercise?.id || 'none'}`

  const [startSec, setStartSec] = useState(defaults.start)
  const [endSec, setEndSec] = useState(defaults.end)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(Math.max(defaults.end + 10, 60))
  const [draggingHandle, setDraggingHandle] = useState(null)

  useEffect(() => {
    const savedRaw = localStorage.getItem(storageKey)
    if (!savedRaw) {
      setStartSec(defaults.start)
      setEndSec(defaults.end)
      const fallbackUrl = defaults.url || videoSources[0] || ''
      setSelectedVideoUrl(fallbackUrl)
      return
    }

    try {
      const saved = JSON.parse(savedRaw)
      const start = toNumber(saved.start, defaults.start)
      const end = toNumber(saved.end, defaults.end)
      const savedUrl = typeof saved.videoUrl === 'string' ? saved.videoUrl : ''
      const fallbackUrl = defaults.url || videoSources[0] || ''
      setStartSec(Math.max(0, start))
      setEndSec(Math.max(start + 1, end))
      setDurationSec((prev) => Math.max(prev, end + 10))
      setSelectedVideoUrl(savedUrl || fallbackUrl)
    } catch {
      setStartSec(defaults.start)
      setEndSec(defaults.end)
      setSelectedVideoUrl(defaults.url || videoSources[0] || '')
    }
  }, [storageKey, defaults.start, defaults.end, defaults.url, videoSources])

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return undefined

    let cancelled = false
    const host = playerHostRef.current
    ensureYouTubeApi().then((YT) => {
      if (cancelled || !host || !host.isConnected) return

      const existing = playerRef.current
      const existingIframe = existing?.getIframe?.()
      if (existing && existingIframe?.parentElement === host) {
        try {
          existing.loadVideoById?.({ videoId, startSeconds: startSec })
          existing.playVideo?.()
          const duration = Number(existing.getDuration?.() || 0)
          if (duration > 1) setDurationSec(duration)
          return
        } catch {
          safeDestroyPlayer(existing)
          playerRef.current = null
        }
      } else if (existing) {
        safeDestroyPlayer(existing)
        playerRef.current = null
      }

      playerRef.current = new YT.Player(host, {
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
      safeDestroyPlayer(playerRef.current)
      playerRef.current = null
    }
  }, [videoId, startSec])

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
        videoUrl: selectedVideoUrl,
        start: Number(startSec.toFixed(1)),
        end: Number(endSec.toFixed(1)),
        snippet: `{"start":${Number(startSec.toFixed(1))},"stop":${Number(endSec.toFixed(1))}}`
      })
    )
    onSegmentChangeRef.current?.({
      url: selectedVideoUrl,
      start: Number(startSec.toFixed(1)),
      end: Number(endSec.toFixed(1))
    })

    return () => {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current)
        pollerRef.current = null
      }
    }
  }, [startSec, endSec, storageKey, exercise.id, selectedVideoUrl])

  if (!selectedVideoUrl) {
    return null
  }

  const safeDuration = Math.max(durationSec, endSec + 1, 10)
  const startPct = clamp((startSec / safeDuration) * 100, 0, 100)
  const endPct = clamp((endSec / safeDuration) * 100, 0, 100)
  const segmentPct = clamp(endPct - startPct, 0, 100)

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

  if (!editable) {
    return (
      <div className="video-frame video-frame-embedded" ref={playerHostRef} />
    )
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

      {null}
    </section>
  )
}
