export default function PushUpAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Push-up animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />

      <g>
        <g>
          <circle cx="72" cy="126" r="10" className="demo-skin" />
          <line x1="82" y1="130" x2="198" y2="148" className="demo-body" />
          <line x1="110" y1="135" x2="106" y2="176" className="demo-limb" />
          <line x1="106" y1="176" x2="92" y2="190" className="demo-limb" />
          <line x1="128" y1="138" x2="130" y2="177" className="demo-limb" />
          <line x1="130" y1="177" x2="145" y2="190" className="demo-limb" />
          <line x1="198" y1="148" x2="248" y2="160" className="demo-limb" />
          <line x1="248" y1="160" x2="266" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="82" cy="114" r="10" className="demo-skin" />
          <line x1="92" y1="118" x2="200" y2="138" className="demo-body" />
          <line x1="120" y1="124" x2="116" y2="170" className="demo-limb" />
          <line x1="116" y1="170" x2="102" y2="190" className="demo-limb" />
          <line x1="138" y1="129" x2="140" y2="173" className="demo-limb" />
          <line x1="140" y1="173" x2="156" y2="190" className="demo-limb" />
          <line x1="200" y1="138" x2="232" y2="148" className="demo-limb" />
          <line x1="232" y1="148" x2="248" y2="190" className="demo-limb" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
