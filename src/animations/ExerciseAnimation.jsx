import PushUpAnimation from './PushUpAnimation'
import SquatAnimation from './SquatAnimation'
import FrontPlankAnimation from './FrontPlankAnimation'
import ReverseLungeAnimation from './ReverseLungeAnimation'
import PikePushUpAnimation from './PikePushUpAnimation'
import HollowHoldAnimation from './HollowHoldAnimation'
import RowAnimation from './RowAnimation'
import JumpSquatAnimation from './JumpSquatAnimation'
import GluteBridgeAnimation from './GluteBridgeAnimation'
import MountainClimberAnimation from './MountainClimberAnimation'
import DeadBugAnimation from './DeadBugAnimation'

export default function ExerciseAnimation({ type }) {
  const map = {
    pushup: PushUpAnimation,
    squat: SquatAnimation,
    plank: FrontPlankAnimation,
    lunge: ReverseLungeAnimation,
    pike: PikePushUpAnimation,
    hollow: HollowHoldAnimation,
    row: RowAnimation,
    jumpSquat: JumpSquatAnimation,
    gluteBridge: GluteBridgeAnimation,
    mountainClimber: MountainClimberAnimation,
    deadBug: DeadBugAnimation
  }

  const Component = map[type] ?? FrontPlankAnimation
  return (
    <div className="figure-card">
      <Component />
    </div>
  )
}
