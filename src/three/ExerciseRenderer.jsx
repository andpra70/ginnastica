import ExerciseStage from './core/ExerciseStage'

export default function ExerciseRenderer({ cardId, cameraView, onCameraSaved, clipName, onClipSelected, onClipOptions }) {
  return (
    <ExerciseStage
      cardId={cardId}
      cameraView={cameraView}
      onCameraSaved={onCameraSaved}
      clipName={clipName}
      onClipSelected={onClipSelected}
      onClipOptions={onClipOptions}
    />
  )
}
