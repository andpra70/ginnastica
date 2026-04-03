export default function HollowHoldAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Hollow hold animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g transform="translate(0,0)">
        <circle cx="92" cy="128" r="10" className="demo-skin" />
        <path d="M102 132 Q150 98 212 120" className="demo-body" fill="none" />
        <line x1="118" y1="120" x2="102" y2="92" className="demo-limb" />
        <line x1="136" y1="112" x2="118" y2="82" className="demo-limb" />
        <line x1="212" y1="120" x2="250" y2="104" className="demo-limb" />
        <line x1="212" y1="120" x2="252" y2="128" className="demo-limb" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 -4;0 0"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </g>
    </svg>
  )
}
