export default function JumpSquatAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Jump squat animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <g>
          <circle cx="136" cy="78" r="10" className="demo-skin" />
          <line x1="136" y1="90" x2="136" y2="132" className="demo-body" />
          <line x1="136" y1="104" x2="114" y2="122" className="demo-limb" />
          <line x1="136" y1="104" x2="158" y2="122" className="demo-limb" />
          <line x1="136" y1="132" x2="122" y2="164" className="demo-limb" />
          <line x1="122" y1="164" x2="114" y2="188" className="demo-limb" />
          <line x1="136" y1="132" x2="150" y2="164" className="demo-limb" />
          <line x1="150" y1="164" x2="158" y2="188" className="demo-limb" />
          <animate attributeName="opacity" values="0.15;1;0.15" dur="1.5s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="160" cy="54" r="10" className="demo-skin" />
          <line x1="160" y1="66" x2="164" y2="108" className="demo-body" />
          <line x1="162" y1="82" x2="146" y2="104" className="demo-limb" />
          <line x1="162" y1="82" x2="178" y2="104" className="demo-limb" />
          <line x1="164" y1="108" x2="152" y2="142" className="demo-limb" />
          <line x1="152" y1="142" x2="146" y2="166" className="demo-limb" />
          <line x1="164" y1="108" x2="176" y2="142" className="demo-limb" />
          <line x1="176" y1="142" x2="182" y2="166" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.1;1" dur="1.5s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
