import { useEffect, useMemo } from 'react'
import { LoopOnce, LoopRepeat } from 'three'

function toLoopMode(loop) {
  return loop === 'once' ? LoopOnce : LoopRepeat
}

export default function useClipPlayback({ actions, config, controls }) {
  const clipName = controls?.clipName || config?.clip || ''
  const playbackRate = config?.playbackRate ?? 1
  const loop = config?.loop ?? 'repeat'
  const isPlaying = controls?.isPlaying ?? true

  const selectedClip = useMemo(() => {
    if (!actions) return null
    if (!clipName) return null
    return actions[clipName] || null
  }, [actions, clipName])

  useEffect(() => {
    if (!selectedClip) return undefined
    if (!isPlaying) {
      selectedClip.stop()
      return undefined
    }

    selectedClip.reset()
    selectedClip.setLoop(toLoopMode(loop), Infinity)
    selectedClip.clampWhenFinished = true
    selectedClip.timeScale = playbackRate
    selectedClip.play()

    return () => {
      selectedClip.stop()
    }
  }, [selectedClip, loop, playbackRate, isPlaying])

  return selectedClip
}
