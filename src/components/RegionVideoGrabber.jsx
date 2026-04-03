import { useEffect, useRef, useState } from 'react'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function rectFromPoints(a, b, bounds) {
  const left = clamp(Math.min(a.x, b.x), 0, bounds.width)
  const top = clamp(Math.min(a.y, b.y), 0, bounds.height)
  const right = clamp(Math.max(a.x, b.x), 0, bounds.width)
  const bottom = clamp(Math.max(a.y, b.y), 0, bounds.height)
  return {
    x: left,
    y: top,
    width: Math.max(16, right - left),
    height: Math.max(16, bottom - top)
  }
}

export default function RegionVideoGrabber() {
  const sourceVideoRef = useRef(null)
  const sourceWrapRef = useRef(null)
  const sourceStreamRef = useRef(null)
  const outputCanvasRef = useRef(null)
  const previewVideoRef = useRef(null)
  const recorderRef = useRef(null)
  const rafRef = useRef(null)
  const dragStartRef = useRef(null)
  const [selecting, setSelecting] = useState(false)

  const [cropRect, setCropRect] = useState({ x: 20, y: 20, width: 220, height: 140 })
  const [hasSource, setHasSource] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [clipUrl, setClipUrl] = useState('')
  const [status, setStatus] = useState('Seleziona la sorgente e disegna il rettangolo.')

  const teardownSource = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (sourceStreamRef.current) {
      sourceStreamRef.current.getTracks().forEach((t) => t.stop())
      sourceStreamRef.current = null
    }
    if (sourceVideoRef.current) sourceVideoRef.current.srcObject = null
    setHasSource(false)
  }

  const startSource = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true
      })
      sourceStreamRef.current = stream
      if (sourceVideoRef.current) {
        sourceVideoRef.current.srcObject = stream
        await sourceVideoRef.current.play()
      }
      setHasSource(true)
      setStatus('Sorgente collegata. Disegna o modifica il rettangolo, poi premi Rec.')
    } catch {
      setStatus('Acquisizione annullata o non disponibile.')
    }
  }

  const startDrawLoop = () => {
    const sourceVideo = sourceVideoRef.current
    const outputCanvas = outputCanvasRef.current
    if (!sourceVideo || !outputCanvas) return
    const ctx = outputCanvas.getContext('2d')
    if (!ctx) return

    const tick = () => {
      const vw = sourceVideo.videoWidth || 0
      const vh = sourceVideo.videoHeight || 0
      if (vw > 0 && vh > 0) {
        const sourceRect = sourceWrapRef.current?.getBoundingClientRect()
        if (sourceRect && sourceRect.width > 0 && sourceRect.height > 0) {
          const sx = (cropRect.x / sourceRect.width) * vw
          const sy = (cropRect.y / sourceRect.height) * vh
          const sw = (cropRect.width / sourceRect.width) * vw
          const sh = (cropRect.height / sourceRect.height) * vh

          outputCanvas.width = Math.max(16, Math.round(sw))
          outputCanvas.height = Math.max(16, Math.round(sh))
          ctx.drawImage(sourceVideo, sx, sy, sw, sh, 0, 0, outputCanvas.width, outputCanvas.height)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const startRecording = async () => {
    if (!hasSource || isRecording) return
    if (!outputCanvasRef.current) return
    startDrawLoop()

    const canvasStream = outputCanvasRef.current.captureStream(30)
    const audioTracks = sourceStreamRef.current?.getAudioTracks() || []
    const mix = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])

    const options = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ]
    const mimeType = options.find((t) => MediaRecorder.isTypeSupported(t))
    const recorder = mimeType ? new MediaRecorder(mix, { mimeType }) : new MediaRecorder(mix)
    recorderRef.current = recorder

    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
      if (clipUrl) URL.revokeObjectURL(clipUrl)
      const url = URL.createObjectURL(blob)
      setClipUrl(url)
      setIsRecording(false)
      setStatus('Clip registrato. Puoi riprodurre, fermare o modificare il rettangolo.')
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      if (previewVideoRef.current) {
        previewVideoRef.current.src = url
      }
    }

    recorder.start(200)
    setIsRecording(true)
    setStatus('Registrazione attiva...')
  }

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return
    recorderRef.current.stop()
  }

  const playback = (mode) => {
    const video = previewVideoRef.current
    if (!video) return
    if (mode === 'play') video.play()
    if (mode === 'pause') video.pause()
    if (mode === 'stop') {
      video.pause()
      video.currentTime = 0
    }
  }

  useEffect(() => {
    return () => {
      teardownSource()
      if (clipUrl) URL.revokeObjectURL(clipUrl)
    }
  }, [clipUrl])

  return (
    <section className="panel">
      <h2>5) Grab Video Rettangolo</h2>
      <p className="hint">{status}</p>

      <div className="grabber-actions">
        <button type="button" onClick={startSource}>Scegli Sorgente</button>
        <button type="button" onClick={startRecording} disabled={!hasSource || isRecording}>Rec</button>
        <button type="button" onClick={stopRecording} disabled={!isRecording}>Stop Rec</button>
        <button type="button" onClick={() => setSelecting((s) => !s)} disabled={!hasSource}>
          {selecting ? 'Fine Edit' : 'Edit Rettangolo'}
        </button>
        <button type="button" onClick={teardownSource}>Disconnetti</button>
      </div>

      <div
        ref={sourceWrapRef}
        className={`grabber-source ${selecting ? 'edit' : ''}`}
        onPointerDown={(event) => {
          if (!selecting) return
          const rect = sourceWrapRef.current?.getBoundingClientRect()
          if (!rect) return
          const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
          dragStartRef.current = point
          setCropRect((prev) => ({ ...prev, x: point.x, y: point.y, width: 16, height: 16 }))
        }}
        onPointerMove={(event) => {
          if (!selecting || !dragStartRef.current) return
          const rect = sourceWrapRef.current?.getBoundingClientRect()
          if (!rect) return
          const next = { x: event.clientX - rect.left, y: event.clientY - rect.top }
          setCropRect(rectFromPoints(dragStartRef.current, next, { width: rect.width, height: rect.height }))
        }}
        onPointerUp={() => {
          dragStartRef.current = null
        }}
        onPointerLeave={() => {
          dragStartRef.current = null
        }}
      >
        <video ref={sourceVideoRef} muted autoPlay playsInline />
        {hasSource ? (
          <div
            className="grabber-rect"
            style={{
              left: `${cropRect.x}px`,
              top: `${cropRect.y}px`,
              width: `${cropRect.width}px`,
              height: `${cropRect.height}px`
            }}
          />
        ) : (
          <div className="grabber-placeholder">Nessuna sorgente selezionata</div>
        )}
      </div>

      <canvas ref={outputCanvasRef} className="grabber-hidden-canvas" />

      <div className="grabber-preview">
        <h3>Preview Grabbed</h3>
        <video ref={previewVideoRef} src={clipUrl} controls={false} playsInline />
        <div className="grabber-actions">
          <button type="button" onClick={() => playback('play')} disabled={!clipUrl}>Play</button>
          <button type="button" onClick={() => playback('pause')} disabled={!clipUrl}>Pause</button>
          <button type="button" onClick={() => playback('stop')} disabled={!clipUrl}>Stop</button>
          <button type="button" onClick={() => setSelecting(true)} disabled={!hasSource}>Edit</button>
          <a className={`grabber-download ${clipUrl ? '' : 'disabled'}`} href={clipUrl || '#'} download="grabbed-segment.webm">
            Salva File
          </a>
        </div>
      </div>
    </section>
  )
}
