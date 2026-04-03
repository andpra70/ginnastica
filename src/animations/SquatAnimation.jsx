export default function SquatAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Squat animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <g>
          <circle cx="150" cy="52" r="11" className="demo-skin" />
          <line x1="150" y1="64" x2="150" y2="116" className="demo-body" />
          <line x1="150" y1="84" x2="125" y2="108" className="demo-limb" />
          <line x1="150" y1="84" x2="175" y2="108" className="demo-limb" />
          <line x1="150" y1="116" x2="132" y2="156" className="demo-limb" />
          <line x1="132" y1="156" x2="132" y2="190" className="demo-limb" />
          <line x1="150" y1="116" x2="168" y2="156" className="demo-limb" />
          <line x1="168" y1="156" x2="168" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.15;1" dur="1.6s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="160" cy="80" r="11" className="demo-skin" />
          <line x1="160" y1="92" x2="167" y2="132" className="demo-body" />
          <line x1="164" y1="104" x2="132" y2="125" className="demo-limb" />
          <line x1="164" y1="104" x2="190" y2="122" className="demo-limb" />
          <line x1="167" y1="132" x2="137" y2="157" className="demo-limb" />
          <line x1="137" y1="157" x2="128" y2="190" className="demo-limb" />
          <line x1="167" y1="132" x2="189" y2="158" className="demo-limb" />
          <line x1="189" y1="158" x2="195" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
