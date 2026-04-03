export default function MountainClimberAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Mountain climber animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <g>
          <circle cx="84" cy="126" r="10" className="demo-skin" />
          <line x1="94" y1="130" x2="214" y2="140" className="demo-body" />
          <line x1="126" y1="136" x2="118" y2="176" className="demo-limb" />
          <line x1="118" y1="176" x2="102" y2="176" className="demo-limb" />
          <line x1="146" y1="138" x2="143" y2="178" className="demo-limb" />
          <line x1="143" y1="178" x2="126" y2="178" className="demo-limb" />
          <line x1="214" y1="140" x2="236" y2="168" className="demo-limb" />
          <line x1="236" y1="168" x2="254" y2="190" className="demo-limb" />
          <line x1="198" y1="138" x2="178" y2="162" className="demo-limb" />
          <line x1="178" y1="162" x2="200" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.2;1" dur="0.9s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="84" cy="126" r="10" className="demo-skin" />
          <line x1="94" y1="130" x2="214" y2="140" className="demo-body" />
          <line x1="126" y1="136" x2="118" y2="176" className="demo-limb" />
          <line x1="118" y1="176" x2="102" y2="176" className="demo-limb" />
          <line x1="146" y1="138" x2="143" y2="178" className="demo-limb" />
          <line x1="143" y1="178" x2="126" y2="178" className="demo-limb" />
          <line x1="214" y1="140" x2="194" y2="164" className="demo-limb" />
          <line x1="194" y1="164" x2="216" y2="190" className="demo-limb" />
          <line x1="198" y1="138" x2="236" y2="168" className="demo-limb" />
          <line x1="236" y1="168" x2="254" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="0.9s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
