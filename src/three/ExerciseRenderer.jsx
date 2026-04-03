import ExerciseStage from './core/ExerciseStage'

const EXERCISE_MAP = {
  pushup: { stageType: 'pushup' },
  squat: { stageType: 'squat' },
  plank: { stageType: 'plank' },
  lunge: { stageType: 'lunge' },
  pike: { stageType: 'pike' },
  hollow: { stageType: 'hollow' },
  row: { stageType: 'row' },
  jumpSquat: { stageType: 'jumpSquat' },
  gluteBridge: { stageType: 'gluteBridge' },
  mountainClimber: { stageType: 'mountainClimber' },
  deadBug: { stageType: 'deadBug' }
}

export default function ExerciseRenderer({ cardId, type, cameraView, onCameraSaved, clipName, onClipSelected }) {
  const cfg = EXERCISE_MAP[type] ?? EXERCISE_MAP.plank
  return (
    <ExerciseStage
      cardId={cardId}
      type={cfg.stageType}
      cameraView={cameraView}
      onCameraSaved={onCameraSaved}
      clipName={clipName}
      onClipSelected={onClipSelected}
    />
  )
}
