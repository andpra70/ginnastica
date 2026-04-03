export default function DeadBugAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Dead bug animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <circle cx="100" cy="138" r="10" className="demo-skin" />
        <line x1="110" y1="142" x2="184" y2="142" className="demo-body" />
        <line x1="128" y1="140" x2="118" y2="112" className="demo-limb" />
        <line x1="128" y1="144" x2="116" y2="168" className="demo-limb" />
        <line x1="168" y1="140" x2="182" y2="108" className="demo-limb" />
        <line x1="168" y1="144" x2="182" y2="176" className="demo-limb" />
        <line x1="184" y1="142" x2="222" y2="132" className="demo-limb" />
        <line x1="184" y1="142" x2="224" y2="152" className="demo-limb" />
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="1.5s" repeatCount="indefinite" />
      </g>
    </svg>
  )
}
