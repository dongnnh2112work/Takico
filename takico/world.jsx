/* ĐI CÙNG TAKICO — World backdrop (ref-style highway) + Mascot3D (live GLB) */

const TAK = window.TAK;

/* ── Hazy skyline + green verge (SVG) ── */
function SkylineSVG() {
  // desaturated blue buildings, a ferris wheel, soft haze
  const blds = [
    [40,120,'#9CB8DA'],[120,180,'#86A6CF'],[230,90,'#A9C2DE'],[300,210,'#7C9FCC'],
    [430,140,'#9CB8DA'],[520,100,'#B0C7E2'],[600,170,'#88A8D0'],
    [1180,150,'#90AED4'],[1280,220,'#7C9FCC'],[1400,110,'#A9C2DE'],
    [1500,180,'#88A8D0'],[1620,130,'#9CB8DA'],[1720,200,'#82A3CE'],[1840,120,'#A2BBDB'],
  ];
  return (
    <svg viewBox="0 0 1920 360" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="bld" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {blds.map(([x,h,c],i)=>(
        <g key={i}>
          <rect x={x} y={360-h} width={i%2?64:84} height={h} rx="5" fill={c}/>
          <rect x={x} y={360-h} width={i%2?64:84} height={h} rx="5" fill="url(#bld)"/>
        </g>
      ))}
      {/* ferris wheel */}
      <g transform="translate(980,150)" stroke="#8FB0D6" strokeWidth="3" fill="none" opacity="0.85">
        <circle cx="0" cy="0" r="92"/>
        <circle cx="0" cy="0" r="60"/>
        {Array.from({length:12}).map((_,i)=>{const a=i*Math.PI/6;return <line key={i} x1="0" y1="0" x2={Math.cos(a)*92} y2={Math.sin(a)*92}/>;})}
        {Array.from({length:12}).map((_,i)=>{const a=i*Math.PI/6;return <circle key={'p'+i} cx={Math.cos(a)*92} cy={Math.sin(a)*92} r="6" fill="#B7D0EA" stroke="none"/>;})}
        <line x1="-46" y1="78" x2="0" y2="0" stroke="#8FB0D6"/>
        <line x1="46" y1="78" x2="0" y2="0" stroke="#8FB0D6"/>
      </g>
      {/* green tree band */}
      <g fill="#4FA463">
        {Array.from({length:80}).map((_,i)=>(
          <circle key={i} cx={i*24+8} cy={358} r={13+ (i%3)*3}/>
        ))}
      </g>
      <rect x="0" y="352" width="1920" height="10" fill="#3E8A52"/>
    </svg>
  );
}

/* ── Highway with long-exposure RED light trails (SVG) ── */
function RoadSVG() {
  // road occupies viewport 0..1920 x 0..580 ; horizon near top-center
  // sweeping trails as bezier ribbons from horizon vanishing point to bottom
  const VPX = 980, VPY = 18;              // vanishing point
  const trails = [];
  // generate ribbons fanning out toward the bottom
  const ends = [
    -120, 60, 240, 430, 620, 820, 1010, 1190, 1380, 1560, 1740, 1980, 2160,
  ];
  ends.forEach((ex, i) => {
    const midx = VPX + (ex - VPX) * 0.45;
    const midy = 230 + ((i % 3) * 24);
    const w = 4 + Math.abs(i - ends.length / 2) * 0.6; // wider at edges
    const warm = i % 2 === 0;
    trails.push({ d: `M ${VPX} ${VPY} Q ${midx} ${midy} ${ex} 600`, w, warm, op: 0.55 + (i % 3) * 0.12 });
  });
  return (
    <svg viewBox="0 0 1920 580" preserveAspectRatio="none">
      <defs>
        <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B5F69"/>
          <stop offset="0.18" stopColor="#494D56"/>
          <stop offset="1" stopColor="#2E3138"/>
        </linearGradient>
        <linearGradient id="redtrail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF5A5A" stopOpacity="0"/>
          <stop offset="0.25" stopColor="#FF4D4D" stopOpacity="0.7"/>
          <stop offset="1" stopColor="#E20025" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="warmtrail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD27A" stopOpacity="0"/>
          <stop offset="0.3" stopColor="#FFB14D" stopOpacity="0.7"/>
          <stop offset="1" stopColor="#FF6A2C" stopOpacity="1"/>
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* road surface (trapezoid widening to bottom) */}
      <path d="M 905 0 L 1015 0 L 1980 600 L -60 600 Z" fill="url(#asphalt)"/>
      {/* side margins / shoulders */}
      <path d="M 905 0 L 880 0 L -360 600 L -60 600 Z" fill="#3A3D45"/>
      <path d="M 1015 0 L 1040 0 L 2280 600 L 1980 600 Z" fill="#3A3D45"/>

      {/* center divider glow line */}
      <path d="M 960 6 L 960 600" stroke="#FFE08A" strokeWidth="3" opacity="0.5" filter="url(#glow)"/>

      {/* light-trail ribbons */}
      <g filter="url(#glow)">
        {trails.map((t, i) => (
          <path key={i} d={t.d} fill="none"
            stroke={t.warm ? 'url(#warmtrail)' : 'url(#redtrail)'}
            strokeWidth={t.w} strokeLinecap="round" opacity={t.op}/>
        ))}
      </g>
      {/* bright red core ribbons (denser cluster, like ref) */}
      <g filter="url(#glow)">
        {[ -40, 140, 340, 560, 780, 1010, 1240, 1470, 1690, 1900 ].map((ex,i)=>(
          <path key={'c'+i} d={`M ${VPX} ${VPY} Q ${VPX+(ex-VPX)*0.4} ${260} ${ex} 600`}
            fill="none" stroke="#FF2E3E" strokeWidth={2.5} opacity="0.85"/>
        ))}
      </g>

      {/* perspective lane dashes */}
      <g stroke="#EDEDF0" strokeLinecap="round" opacity="0.85">
        {Array.from({length:7}).map((_,i)=>{
          const t0=i/7, t1=(i+0.5)/7;
          const y0=VPY+(600-VPY)*t0, y1=VPY+(600-VPY)*t1;
          const wid=2+t0*16;
          return <line key={i} x1={VPX} y1={y0} x2={VPX} y2={y1} strokeWidth={wid}/>;
        })}
      </g>
    </svg>
  );
}

/* ── Shared backdrop ── */
function World() {
  return (
    <div className="world">
      <div className="world-sky"></div>
      <div className="world-bloom"></div>
      <div className="cloud c1"></div>
      <div className="cloud c2"></div>
      <div className="cloud c3"></div>
      <div className="world-skyline"><SkylineSVG /></div>
      <div className="world-road"><RoadSVG /></div>
      <div className="world-vignette"></div>
    </div>
  );
}

/* ── Mascot3D: live model-viewer wrapper with loading shimmer ── */
function Mascot3D({ orbit, fov, scale, className, style }) {
  const ref = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    // Lazy-load module model-viewer (≈ vài trăm KB) chỉ khi thực sự cần render
    // mascot 3D — không nạp eager lúc mở app.
    if (!document.getElementById('mv-module')) {
      const s = document.createElement('script');
      s.id = 'mv-module';
      s.type = 'module';
      s.src = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
      document.head.appendChild(s);
    }
    const mv = ref.current;
    if (!mv) return;
    if (mv.loaded) { setReady(true); return; }
    const on = () => setReady(true);
    mv.addEventListener('load', on);
    return () => mv.removeEventListener('load', on);
  }, []);
  return (
    <div className={'mascot3d ' + (className || '')} style={style}>
      {!ready && <div className="mascot3d-shimmer"><div className="m3-ring"></div></div>}
      <model-viewer
        ref={ref}
        src={TAK.A.glb}
        camera-orbit={orbit || '18deg 84deg 100%'}
        field-of-view={fov || '26deg'}
        camera-target="auto auto auto"
        disable-zoom disable-pan disable-tap interaction-prompt="none"
        exposure="1.05" shadow-intensity="0.9" shadow-softness="1"
        environment-image="neutral"
        style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .5s ease', '--poster-color': 'transparent', background: 'transparent' }}
      ></model-viewer>
    </div>
  );
}

Object.assign(window, { World, SkylineSVG, RoadSVG, Mascot3D });
