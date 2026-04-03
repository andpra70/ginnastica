export default function ReverseLungeAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Reverse lunge animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <g>
          <circle cx="136" cy="56" r="10" className="demo-skin" />
          <line x1="136" y1="67" x2="142" y2="118" className="demo-body" />
          <line x1="140" y1="84" x2="117" y2="105" className="demo-limb" />
          <line x1="140" y1="84" x2="163" y2="105" className="demo-limb" />
          <line x1="142" y1="118" x2="123" y2="156" className="demo-limb" />
          <line x1="123" y1="156" x2="124" y2="190" className="demo-limb" />
          <line x1="142" y1="118" x2="171" y2="150" className="demo-limb" />
          <line x1="171" y1="150" x2="194" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.15;1" dur="1.8s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="184" cy="56" r="10" className="demo-skin" />
          <line x1="184" y1="67" x2="178" y2="118" className="demo-body" />
          <line x1="180" y1="84" x2="158" y2="105" className="demo-limb" />
          <line x1="180" y1="84" x2="203" y2="105" className="demo-limb" />
          <line x1="178" y1="118" x2="197" y2="156" className="demo-limb" />
          <line x1="197" y1="156" x2="196" y2="190" className="demo-limb" />
          <line x1="178" y1="118" x2="149" y2="150" className="demo-limb" />
          <line x1="149" y1="150" x2="126" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="0.15;1;0.15" dur="1.8s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
