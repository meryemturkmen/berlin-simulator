/** Decorative Berlin skyline, drawn in code. Purely presentational. */
export function Skyline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={className}
    >
      {/* Far layer */}
      <g fill="#b9879a" opacity="0.55">
        <rect x="0" y="250" width="130" height="170" />
        <rect x="150" y="215" width="90" height="205" />
        <rect x="260" y="262" width="150" height="158" />
        <rect x="520" y="232" width="110" height="188" />
        <rect x="650" y="270" width="180" height="150" />
        <rect x="880" y="225" width="96" height="195" />
        <rect x="1000" y="258" width="170" height="162" />
        <rect x="1210" y="236" width="120" height="184" />
        <rect x="1350" y="266" width="90" height="154" />
      </g>
      {/* TV tower */}
      <g fill="#5b4468">
        <rect x="1063" y="20" width="4" height="96" />
        <rect x="1060" y="110" width="10" height="60" />
        <circle cx="1065" cy="160" r="24" />
        <rect x="1052" y="176" width="26" height="9" rx="3" />
        <polygon points="1058,185 1072,185 1077,420 1053,420" />
      </g>
      {/* Near layer: gabled Altbau roofs, a dome, flat roofs */}
      <g fill="#3b2f52">
        <polygon points="0,420 0,300 60,270 120,300 120,420" />
        <rect x="120" y="310" width="140" height="110" />
        <polygon points="260,420 260,285 330,255 400,285 400,420" />
        <rect x="400" y="320" width="120" height="100" />
        <path d="M520 420 V300 h30 a50 50 0 0 1 100 0 h30 V420 Z" />
        <rect x="596" y="232" width="8" height="26" />
        <rect x="680" y="330" width="160" height="90" />
        <polygon points="840,420 840,295 900,268 960,295 960,420" />
        <rect x="960" y="318" width="80" height="102" />
        <rect x="1090" y="300" width="150" height="120" />
        <polygon points="1240,420 1240,310 1300,282 1360,310 1360,420" />
        <rect x="1360" y="325" width="80" height="95" />
      </g>
      {/* Lit windows */}
      <g fill="#f8c873">
        {[
          [28, 325],
          [78, 345],
          [150, 335],
          [210, 365],
          [292, 310],
          [352, 340],
          [432, 350],
          [560, 330],
          [622, 362],
          [712, 352],
          [792, 372],
          [872, 322],
          [922, 352],
          [1112, 325],
          [1172, 355],
          [1202, 325],
          [1272, 335],
          [1322, 365],
          [1392, 350],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="12" height="16" rx="1.5" />
        ))}
      </g>
      {/* Street trees */}
      <g fill="#2c2440">
        {[90, 470, 860, 1260].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="388" width="6" height="32" />
            <circle cx={x} cy="380" r="22" />
            <circle cx={x - 16} cy="390" r="14" />
            <circle cx={x + 16} cy="390" r="14" />
          </g>
        ))}
      </g>
    </svg>
  );
}
