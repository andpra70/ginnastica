import PushUpView from './exercises/PushUpView'
import SquatView from './exercises/SquatView'
import PlankView from './exercises/PlankView'
import LungeView from './exercises/LungeView'
import PikeView from './exercises/PikeView'
import HollowView from './exercises/HollowView'
import RowView from './exercises/RowView'
import JumpSquatView from './exercises/JumpSquatView'
import GluteBridgeView from './exercises/GluteBridgeView'
import MountainClimberView from './exercises/MountainClimberView'
import DeadBugView from './exercises/DeadBugView'

export default function ExerciseRenderer({ type }) {
  const map = {
    pushup: PushUpView,
    squat: SquatView,
    plank: PlankView,
    lunge: LungeView,
    pike: PikeView,
    hollow: HollowView,
    row: RowView,
    jumpSquat: JumpSquatView,
    gluteBridge: GluteBridgeView,
    mountainClimber: MountainClimberView,
    deadBug: DeadBugView
  }

  const Comp = map[type] ?? PlankView
  return <Comp />
}
