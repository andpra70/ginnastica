export default function PikePushUpAnimation() {
  return (
    <svg viewBox="0 0 320 220" className="demo-svg" aria-label="Pike push-up animation">
      <line x1="16" y1="192" x2="304" y2="192" className="demo-ground" />
      <g>
        <g>
          <circle cx="138" cy="122" r="10" className="demo-skin" />
          <line x1="146" y1="128" x2="185" y2="80" className="demo-body" />
          <line x1="185" y1="80" x2="230" y2="148" className="demo-body" />
          <line x1="154" y1="130" x2="146" y2="175" className="demo-limb" />
          <line x1="146" y1="175" x2="136" y2="190" className="demo-limb" />
          <line x1="164" y1="135" x2="164" y2="178" className="demo-limb" />
          <line x1="164" y1="178" x2="174" y2="190" className="demo-limb" />
          <line x1="230" y1="148" x2="246" y2="182" className="demo-limb" />
          <line x1="220" y1="134" x2="232" y2="166" className="demo-limb" />
          <animate attributeName="opacity" values="1;0.2;1" dur="1.7s" repeatCount="indefinite" />
        </g>
        <g>
          <circle cx="156" cy="112" r="10" className="demo-skin" />
          <line x1="164" y1="118" x2="195" y2="84" className="demo-body" />
          <line x1="195" y1="84" x2="232" y2="146" className="demo-body" />
          <line x1="172" y1="122" x2="168" y2="170" className="demo-limb" />
          <line x1="168" y1="170" x2="160" y2="190" className="demo-limb" />
          <line x1="184" y1="124" x2="186" y2="172" className="demo-limb" />
          <line x1="186" y1="172" x2="196" y2="190" className="demo-limb" />
          <line x1="232" y1="146" x2="248" y2="182" className="demo-limb" />
          <line x1="224" y1="136" x2="236" y2="166" className="demo-limb" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.7s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  )
}
