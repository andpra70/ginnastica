import { useEffect, useMemo } from 'react'
import { LoopOnce, LoopRepeat } from 'three'

function toLoopMode(loop) {
  return loop === 'once' ? LoopOnce : LoopRepeat
}

export default function useClipPlayback({ actions, clips = [], config }) {
  const clipName = config?.clip ?? 'Idle'
  const playbackRate = config?.playbackRate ?? 1
  const loop = config?.loop ?? 'repeat'

  const selectedClip = useMemo(() => {
    if (!actions) return null

    const fromCfg = actions[clipName]
    if (fromCfg) return fromCfg

    for (const candidate of clips) {
      if (actions[candidate]) return actions[candidate]
    }

    const first = Object.keys(actions)[0]
    return first ? actions[first] : null
  }, [actions, clipName, clips])

  useEffect(() => {
    if (!selectedClip) return undefined

    selectedClip.reset()
    selectedClip.setLoop(toLoopMode(loop), Infinity)
    selectedClip.clampWhenFinished = true
    selectedClip.timeScale = playbackRate
    selectedClip.play()

    return () => {
      selectedClip.stop()
    }
  }, [selectedClip, loop, playbackRate])

  return selectedClip
}
