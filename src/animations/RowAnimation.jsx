export default function RowAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Row animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <line x1="36" y1="96" x2="284" y2="96" className="demo-bar" />
      <g>
        <g>
          <circle cx="102" cy="136" r="10" className="demo-skin" />
          <line x1="112" y1="139" x2="214" y2="130" className="demo-body" />
          <line x1="132" y1="136" x2="160" y2="106" className="demo-limb" />
          <line x1="160" y1="106" x2="160" y2="96" className="demo-limb" />
          <line x1="152" y1="134" x2="178" y2="106" className="demo-limb" />
          <line x1="178" y1="106" x2="178" y2="96" className="demo-limb" />
          <line x1="214" y1="130" x2="239" y2="158" className="demo-limb" />
          <line x1="239" y1="158" x2="256" y2="190" className="demo-limb" />
          <line x1="198" y1="130" x2="221" y2="160" className="demo-limb" />
          <line x1="221" y1="160" x2="238" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="114" cy="120" r="10" className="demo-skin" />
          <line x1="124" y1="124" x2="213" y2="123" className="demo-body" />
          <line x1="138" y1="122" x2="162" y2="104" className="demo-limb" />
          <line x1="162" y1="104" x2="162" y2="96" className="demo-limb" />
          <line x1="154" y1="122" x2="178" y2="104" className="demo-limb" />
          <line x1="178" y1="104" x2="178" y2="96" className="demo-limb" />
          <line x1="213" y1="123" x2="239" y2="155" className="demo-limb" />
          <line x1="239" y1="155" x2="255" y2="190" className="demo-limb" />
          <line x1="197" y1="123" x2="221" y2="156" className="demo-limb" />
          <line x1="221" y1="156" x2="237" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
