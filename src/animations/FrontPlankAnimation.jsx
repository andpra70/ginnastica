export default function FrontPlankAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Front plank animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <circle cx="84" cy="128" r="10" className="demo-skin" />
        <line x1="94" y1="132" x2="220" y2="144" className="demo-body" />
        <line x1="126" y1="136" x2="119" y2="176" className="demo-limb" />
        <line x1="119" y1="176" x2="102" y2="176" className="demo-limb" />
        <line x1="145" y1="138" x2="142" y2="178" className="demo-limb" />
        <line x1="142" y1="178" x2="124" y2="178" className="demo-limb" />
        <line x1="220" y1="144" x2="248" y2="170" className="demo-limb" />
        <line x1="248" y1="170" x2="265" y2="190" className="demo-limb" />
        <line x1="204" y1="142" x2="227" y2="171" className="demo-limb" />
        <line x1="227" y1="171" x2="244" y2="190" className="demo-limb" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 -3;0 0"
          dur="2s"
          repeatCount="indefinite"
        />
      </g>
    </svg>
  )
}
