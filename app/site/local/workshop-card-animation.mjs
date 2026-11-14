// target-workshop-card-animation-v1
// Original Target Workshop card motion: a flat signal map with orbiting scan and node handoff.
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const rgba = (rgb, alpha) => `rgba(${rgb},${alpha})`;

function layout(plan) {
  const kind = plan?.kind ?? 'single';
  if (kind === 'grid') {
    const cols = clamp(Math.round(plan.cols || 5), 1, 8);
    const rows = clamp(Math.round(plan.rows || 3), 1, 6);
    const points = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      points.push({x: cols === 1 ? 0 : (col / (cols - 1) - .5) * 1.55,
        y: rows === 1 ? 0 : (row / (rows - 1) - .5) * 1.22});
    }
    return points;
  }
  if (kind === 'points' && plan.spots?.length) return plan.spots.slice(0, 12).map(p => ({x: clamp(p.a, -1, 1), y: clamp(p.b, -.8, .8)}));
  if (kind === 'strafe' || kind === 'sway') return Array.from({length: 9}, (_, i) => ({x: (i - 4) * .21, y: Math.sin(i * .92) * .22}));
  if (kind === 'area') return Array.from({length: 11}, (_, i) => ({x: Math.sin(i * 2.399) * (.32 + i / 17), y: Math.cos(i * 1.97) * (.28 + i / 23)}));
  if (kind === 'blink') return [{x: -.72, y: -.36}, {x: .6, y: -.5}, {x: .18, y: .5}, {x: -.58, y: .44}, {x: .72, y: .27}];
  return [{x: -.57, y: -.2}, {x: .45, y: -.35}, {x: .12, y: .5}];
}

function polygon(ctx, x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * TAU / sides;
    const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function createWorkshopCardAnimation(plan) {
  const nodes = layout(plan);
  const label = String(plan?.kind ?? 'single').toUpperCase().slice(0, 10);
  const count = clamp(Math.round(plan?.alive || 1), 1, Math.min(5, nodes.length));
  let start = 0, elapsed = 0;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  return {
    reset(now) { start = now; elapsed = 0; },
    step(now) { elapsed = reduced ? 0 : Math.max(0, now - start); },
    draw(ctx, width, height, now) {
      if (!ctx || width <= 0 || height <= 0) return;
      const t = reduced ? 0 : elapsed || Math.max(0, now - start);
      const scale = Math.min(width / 360, height / 196);
      const cx = width * .5, cy = height * .51;
      const rx = width * .29, ry = height * .33;
      ctx.clearRect(0, 0, width, height);
      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, '#0c1825'); base.addColorStop(.56, '#111e2c'); base.addColorStop(1, '#0c1420');
      ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);

      // Diagonal signal lanes replace the original room perspective.
      ctx.strokeStyle = 'rgba(87,174,193,.09)'; ctx.lineWidth = 1;
      for (let i = -height; i < width + height; i += 24 * scale) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height * .54, height); ctx.stroke();
      }
      const ring = Math.min(width * .34, height * .45);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(cx, cy, ring * (1 - i * .28), ring * (.75 - i * .2), 0, 0, TAU);
        ctx.strokeStyle = rgba('95,203,220', .19 - i * .04); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, ring * .88, -Math.PI / 2 + t * .6, -Math.PI / 2 + t * .6 + .9);
      ctx.strokeStyle = '#60d8e8'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#60d8e8'; ctx.shadowBlur = 12 * scale; ctx.stroke(); ctx.shadowBlur = 0;

      const positions = nodes.map(node => ({x: cx + node.x * rx, y: cy + node.y * ry}));
      const order = positions.length;
      const phase = t / .85;
      const lead = Math.floor(phase) % order;
      const fraction = phase - Math.floor(phase);
      const from = positions[lead], to = positions[(lead + 1) % order];
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = rgba('255,93,109', .24); ctx.lineWidth = 1.2 * scale;
      ctx.setLineDash([3 * scale, 5 * scale]); ctx.stroke(); ctx.setLineDash([]);

      positions.forEach((point, index) => {
        const active = Array.from({length: count}, (_, offset) => (lead + offset * Math.max(1, Math.floor(order / count))) % order).includes(index);
        const radius = (active ? 7.4 : 4.1) * scale;
        polygon(ctx, point.x, point.y, radius, 6, Math.PI / 6);
        ctx.fillStyle = active ? '#ff5d6d' : '#182f3c';
        ctx.strokeStyle = active ? '#ff9aa4' : 'rgba(111,205,219,.55)';
        ctx.lineWidth = active ? 1.4 * scale : 1 * scale;
        ctx.shadowColor = active ? '#ff4655' : 'transparent'; ctx.shadowBlur = active ? 11 * scale : 0;
        ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        if (active) { ctx.beginPath(); ctx.arc(point.x, point.y, 1.45 * scale, 0, TAU); ctx.fillStyle = '#fff5f5'; ctx.fill(); }
      });

      const px = from.x + (to.x - from.x) * fraction, py = from.y + (to.y - from.y) * fraction;
      ctx.beginPath(); ctx.arc(px, py, 2.6 * scale, 0, TAU);
      ctx.fillStyle = '#a5f5ff'; ctx.shadowColor = '#74e5f3'; ctx.shadowBlur = 12 * scale; ctx.fill(); ctx.shadowBlur = 0;

      ctx.fillStyle = '#9ac3d1'; ctx.font = `700 ${Math.max(8, 9 * scale)}px Arial, sans-serif`;
      ctx.letterSpacing = `${1.4 * scale}px`;
      ctx.fillText('SIGNAL ARRAY', 13 * scale, 18 * scale);
      ctx.fillStyle = '#ff7785'; ctx.fillText(`${label}  /  ${String(count).padStart(2, '0')} ACTIVE`, 13 * scale, height - 11 * scale);
      ctx.letterSpacing = '0px';
      ctx.strokeStyle = '#ff4655'; ctx.lineWidth = 2 * scale;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(21 * scale, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 21 * scale);
      ctx.moveTo(width, height); ctx.lineTo(width - 21 * scale, height); ctx.moveTo(width, height); ctx.lineTo(width, height - 21 * scale); ctx.stroke();
    }
  };
}
