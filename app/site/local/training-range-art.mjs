// original-training-range-minimal-v2
// A minimal companion to the Target Workshop wall: aim lanes, rings, and a single focus point.
const round = value => Math.round(value * 10) / 10;
const pt = (x, y) => `${round(x)},${round(y)}`;

export function trainingRangeSvg(_seed, width, height, options = {}) {
  const w = Math.max(1, Math.round(Number(width) || 320));
  const h = Math.max(1, Math.round(Number(height) || 180));
  const fit = options.fit ?? {};
  const cx = (Number.isFinite(fit.cx) ? fit.cx : .5) * w;
  const cy = (Number.isFinite(fit.cy) ? fit.cy : .44) * h;
  const radius = Math.min(w * (options.wide ? .24 : .34), h * .36);
  const lineY = cy + radius * .08;
  const dash = Math.max(2, radius * .035);
  const dot = Math.max(1.5, radius * .025);
  const left = -w * .08, right = w * 1.08;
  const nodes = [
    [cx-radius*1.46,cy-radius*.68,dot*.7],
    [cx-radius*.92,cy+radius*.8,dot],
    [cx+radius*1.28,cy-radius*.54,dot*.8],
    [cx+radius*.72,cy+radius*.85,dot*.65]
  ].map(([x,y,r])=>`<circle cx="${round(x)}" cy="${round(y)}" r="${round(r)}" fill="#91cbd5" opacity=".55"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="base" x2="1" y2="1"><stop stop-color="#08131d"/><stop offset=".58" stop-color="#0c1822"/><stop offset="1" stop-color="#070d14"/></linearGradient>
      <radialGradient id="warm"><stop stop-color="#b73349" stop-opacity=".22"/><stop offset="1" stop-color="#b73349" stop-opacity="0"/></radialGradient>
      <linearGradient id="lane"><stop stop-color="#ff6878" stop-opacity="0"/><stop offset=".52" stop-color="#ff6878" stop-opacity=".48"/><stop offset="1" stop-color="#ff6878" stop-opacity="0"/></linearGradient>
      <pattern id="grid" width="${round(Math.max(16,w/26))}" height="${round(Math.max(16,w/26))}" patternUnits="userSpaceOnUse"><path d="M${round(Math.max(16,w/26))} 0H0V${round(Math.max(16,w/26))}" fill="none" stroke="#83afbd" stroke-opacity=".08" stroke-width="1"/></pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#base)"/>
    <rect width="${w}" height="${h}" fill="url(#grid)"/>
    <ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(radius*1.75)}" ry="${round(radius*1.38)}" fill="url(#warm)"/>
    <g fill="none" stroke="#8bcbd7" stroke-width="${round(Math.max(1,radius*.009))}">
      <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius*.55)}" stroke-opacity=".17"/>
      <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}" stroke-opacity=".23"/>
      <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius*1.35)}" stroke-opacity=".11"/>
      <path d="M${round(cx-radius*1.35)} ${round(cy)}H${round(cx+radius*1.35)}M${round(cx)} ${round(cy-radius*1.35)}V${round(cy+radius*1.35)}" stroke-opacity=".16" stroke-dasharray="${round(dash)} ${round(dash*2.8)}"/>
    </g>
    <path d="M${round(left)} ${round(h*.73)}L${round(cx-radius*.3)} ${round(lineY)}L${round(right)} ${round(h*.16)}" fill="none" stroke="url(#lane)" stroke-width="${round(Math.max(1.5,radius*.017))}"/>
    <path d="M${round(left)} ${round(h*.84)}L${round(cx+radius*.22)} ${round(lineY+radius*.18)}L${round(right)} ${round(h*.34)}" fill="none" stroke="#ff6878" stroke-opacity=".13" stroke-width="1"/>
    <path d="M${pt(cx-radius*.27,cy-radius*.13)}L${pt(cx,cy-radius*.28)}L${pt(cx+radius*.27,cy-radius*.13)}L${pt(cx+radius*.27,cy+radius*.13)}L${pt(cx,cy+radius*.28)}L${pt(cx-radius*.27,cy+radius*.13)}Z" fill="#ff6878" fill-opacity=".06" stroke="#ff7483" stroke-opacity=".5" stroke-width="${round(Math.max(1,radius*.012))}"/>
    <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius*.075)}" fill="#ff7584"/>
    <circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius*.15)}" fill="none" stroke="#ff7584" stroke-opacity=".55" stroke-width="1"/>
    ${nodes}
    <g fill="none" stroke="#ff7785" stroke-opacity=".32" stroke-width="${round(Math.max(1,radius*.014))}">
      <path d="M${round(cx-radius*1.05)} ${round(cy-radius*.55)}h${round(radius*.18)}M${round(cx-radius*1.05)} ${round(cy-radius*.55)}v${round(radius*.18)}"/>
      <path d="M${round(cx+radius*1.05)} ${round(cy+radius*.55)}h${round(-radius*.18)}M${round(cx+radius*1.05)} ${round(cy+radius*.55)}v${round(-radius*.18)}"/>
    </g>
    <path d="M0 ${round(h-2)}H${round(w*.24)}M${round(w*.78)} 2H${w}" stroke="#ff7785" stroke-opacity=".2" stroke-width="2"/>
  </svg>`;
}
