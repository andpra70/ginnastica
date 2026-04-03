export default function GluteBridgeAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Glute bridge animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <g>
          <circle cx="74" cy="148" r="10" className="demo-skin" />
          <line x1="84" y1="150" x2="168" y2="166" className="demo-body" />
          <line x1="98" y1="153" x2="88" y2="177" className="demo-limb" />
          <line x1="114" y1="156" x2="103" y2="180" className="demo-limb" />
          <line x1="168" y1="166" x2="197" y2="166" className="demo-limb" />
          <line x1="197" y1="166" x2="214" y2="190" className="demo-limb" />
          <line x1="168" y1="166" x2="192" y2="170" className="demo-limb" />
          <line x1="192" y1="170" x2="208" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="74" cy="148" r="10" className="demo-skin" />
          <line x1="84" y1="148" x2="170" y2="134" className="demo-body" />
          <line x1="98" y1="150" x2="88" y2="176" className="demo-limb" />
          <line x1="114" y1="147" x2="103" y2="174" className="demo-limb" />
          <line x1="170" y1="134" x2="198" y2="154" className="demo-limb" />
          <line x1="198" y1="154" x2="214" y2="190" className="demo-limb" />
          <line x1="170" y1="134" x2="192" y2="154" className="demo-limb" />
          <line x1="192" y1="154" x2="208" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
