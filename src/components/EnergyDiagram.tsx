import { useMemo, forwardRef } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

// ── Layout ────────────────────────────────────────────────────────────────────
const SVG_W  = 600;
const SVG_H  = 340;
const ML     = 36;   // left margin (Y-axis)
const MT     = 32;   // top margin
const MB     = 24;   // bottom margin
const PH     = SVG_H - MT - MB;

const LINE_X1      = ML + 10;              // 46  level line left
const LINE_X2      = SVG_W - 16 - 160;    // 424 level line right
const LABEL_X      = LINE_X2 + 7;         // 431 state label left edge

// Arrow default x is ~30% into the line span; xOffset shifts from there
const ARROW_BASE_X = LINE_X1 + (LINE_X2 - LINE_X1) * 0.28; // ≈ 141
const SLOT_W       = 38;  // pixels between auto-assigned arrow columns
const SHAFT_TOL    = 8;   // px — two shafts within this distance are "same column"

const FS      = 9;               // font size
const LABEL_H = FS * 1.4;        // estimated text bounding-box height ≈ 12.6
const LABEL_V_GAP = LABEL_H + 2; // min gap between baselines in same X-column ≈ 14.6
const AW      = 5;               // arrowhead half-width
const AH      = 7;               // arrowhead height
const EST_CW  = FS * 0.58;       // estimated character width
// ─────────────────────────────────────────────────────────────────────────────

function eToY(e: number, lo: number, hi: number): number {
  if (hi === lo) return MT + PH / 2;
  return MT + PH * (1 - (e - lo) / (hi - lo));
}

/** Push items apart vertically until no pair is closer than `gap`. */
function resolveYCollisions(
  raw: Array<{ id: string; y: number }>,
  gap: number,
): Map<string, number> {
  const arr = raw.map(it => ({ ...it }));
  arr.sort((a, b) => a.y - b.y);
  for (let pass = 0; pass < 60; pass++) {
    let stable = true;
    for (let k = 0; k < arr.length - 1; k++) {
      const d = arr[k + 1].y - arr[k].y;
      if (d < gap - 0.1) {
        const half = (gap - d) / 2;
        arr[k].y -= half;
        arr[k + 1].y += half;
        stable = false;
      }
    }
    if (stable) break;
  }
  arr.forEach(it => { it.y = Math.max(MT + LABEL_H, Math.min(SVG_H - MB, it.y)); });
  const map = new Map<string, number>();
  arr.forEach(({ id, y }) => map.set(id, y));
  return map;
}

const EnergyDiagram = forwardRef<SVGSVGElement, Props>(({ levels, transitions }, ref) => {
  const { minE, maxE } = useMemo(() => {
    if (levels.length === 0) return { minE: 0, maxE: 100 };
    const es = levels.map(l => l.energy);
    const lo = Math.min(...es), hi = Math.max(...es);
    const pad = (hi - lo) * 0.15 || 40;
    return { minE: lo - pad, maxE: hi + pad };
  }, [levels]);

  const levelMap = useMemo(() => {
    const m = new Map<string, Level>();
    levels.forEach(l => m.set(l.id, l));
    return m;
  }, [levels]);

  // ── Level label Y (collision-resolved) ────────────────────────────────────
  const levelLabelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: eToY(l.energy, minE, maxE) + FS * 0.35,
    }));
    return resolveYCollisions(items, LABEL_V_GAP);
  }, [levels, minE, maxE]);

  // ── Arrow Y ranges ─────────────────────────────────────────────────────────
  const arrowRanges = useMemo(() => {
    const m = new Map<string, { y1: number; y2: number; yMin: number; yMax: number }>();
    for (const tr of transitions) {
      const f = levelMap.get(tr.fromLevelId);
      const t = levelMap.get(tr.toLevelId);
      if (!f || !t) continue;
      const y1 = eToY(f.energy, minE, maxE);
      const y2 = eToY(t.energy, minE, maxE);
      m.set(tr.id, { y1, y2, yMin: Math.min(y1, y2), yMax: Math.max(y1, y2) });
    }
    return m;
  }, [transitions, levelMap, minE, maxE]);

  // ── Auto-assign arrow X positions, separating overlapping shafts ───────────
  // Desired X comes from user's xOffset. When two desired positions are in the
  // same shaft-column AND their Y-ranges overlap, the later one is nudged right
  // by SLOT_W until there's no conflict.
  const arrowXs = useMemo(() => {
    const result = new Map<string, number>();
    const placed: Array<{ x: number; yMin: number; yMax: number }> = [];

    for (const tr of transitions) {
      const range = arrowRanges.get(tr.id);
      if (!range) continue;

      let x = ARROW_BASE_X + tr.xOffset;

      for (let attempt = 0; attempt < 12; attempt++) {
        const conflict = placed.find(p =>
          Math.abs(p.x - x) < SHAFT_TOL &&
          Math.min(range.yMax, p.yMax) - Math.max(range.yMin, p.yMin) > 2,
        );
        if (!conflict) break;
        x += SLOT_W;
      }
      // Clamp inside the line span
      x = Math.min(Math.max(x, LINE_X1 + AW + 2), LINE_X2 - AW - 2);

      result.set(tr.id, x);
      placed.push({ x, yMin: range.yMin, yMax: range.yMax });
    }
    return result;
  }, [transitions, arrowRanges]);

  // ── Transition label X/Y positions ────────────────────────────────────────
  // For each label: try RIGHT side of its arrow; fall back to LEFT if the right
  // side would (a) reach the state-label column, or (b) cross another arrow shaft.
  // Y is then resolved per X-side group.
  const transLabelPositions = useMemo(() => {
    // Build shaft registry: { id, x, yMin, yMax }
    const shafts = transitions.flatMap(tr => {
      const x = arrowXs.get(tr.id);
      const r = arrowRanges.get(tr.id);
      return x != null && r != null ? [{ id: tr.id, x, ...r }] : [];
    });

    type LabelInfo = { id: string; x: number; y: number; side: 'right' | 'left' };
    const labels: LabelInfo[] = [];

    for (const tr of transitions) {
      const cx   = arrowXs.get(tr.id);
      const r    = arrowRanges.get(tr.id);
      if (cx == null || r == null) continue;

      const midY    = (r.y1 + r.y2) / 2 + FS * 0.35;
      const labelW  = (tr.label?.length ?? 0) * EST_CW;

      // Right-side candidate
      const rx      = cx + AW + 4;
      const rxEnd   = rx + labelW;

      const rightBlocked =
        // would reach the state-label column
        rxEnd >= LABEL_X - 4 ||
        // would cross another arrow's shaft
        shafts.some(s =>
          s.id !== tr.id &&
          s.x > rx && s.x < rxEnd &&         // shaft x is inside label's x span
          r.y1 !== r.y2 &&                    // not degenerate
          Math.min(r.yMax, s.yMax) - Math.max(r.yMin, s.yMin) > 2, // Y overlap
        );

      let lx: number;
      let side: 'right' | 'left';
      if (!rightBlocked) {
        lx = rx; side = 'right';
      } else {
        // Left side: clamp to stay inside the line span
        lx = Math.max(LINE_X1 + 2, cx - AW - 4 - labelW);
        side = 'left';
      }

      labels.push({ id: tr.id, x: lx, y: midY, side });
    }

    // Resolve Y collisions separately for labels that share a similar X column
    // (within ±labelWidth of each other). We do two passes: right-side labels
    // vs left-side labels independently.
    const rightItems = labels.filter(l => l.side === 'right').map(l => ({ id: l.id, y: l.y }));
    const leftItems  = labels.filter(l => l.side === 'left' ).map(l => ({ id: l.id, y: l.y }));
    const rightResolved = resolveYCollisions(rightItems, LABEL_V_GAP);
    const leftResolved  = resolveYCollisions(leftItems,  LABEL_V_GAP);

    const result = new Map<string, { x: number; y: number }>();
    labels.forEach(l => {
      const resolved = (l.side === 'right' ? rightResolved : leftResolved);
      result.set(l.id, { x: l.x, y: resolved.get(l.id) ?? l.y });
    });
    return result;
  }, [transitions, arrowXs, arrowRanges]);

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <rect width={SVG_W} height={SVG_H} fill="white" />

      {/* Y-axis */}
      <line x1={ML} y1={MT - 8} x2={ML} y2={MT + PH + 6} stroke="#374151" strokeWidth={1.5} />
      <polygon points={`${ML-4},${MT-8} ${ML+4},${MT-8} ${ML},${MT-18}`} fill="#374151" />
      <text x={ML} y={MT-20} textAnchor="middle" fontSize={11} fontWeight="bold"
        fill="#374151" fontStyle="italic">E</text>
      <text x={ML-2} y={MT-6}      textAnchor="middle" fontSize={8} fill="#6b7280">高</text>
      <text x={ML-2} y={MT+PH+18}  textAnchor="middle" fontSize={8} fill="#6b7280">低</text>

      {/* Tick marks */}
      {levels.map(lv => {
        const y = eToY(lv.energy, minE, maxE);
        return (
          <g key={`tick-${lv.id}`}>
            <line x1={ML-4} y1={y} x2={ML} y2={y} stroke="#9ca3af" strokeWidth={1} />
            <text x={ML-6} y={y+3.5} textAnchor="end" fontSize={7} fill="#9ca3af">
              {lv.energy}
            </text>
          </g>
        );
      })}

      {/* Level lines + state labels */}
      {levels.map(lv => {
        const lineY  = eToY(lv.energy, minE, maxE);
        const labelY = levelLabelYs.get(lv.id) ?? lineY + FS * 0.35;
        const drift  = Math.abs(labelY - (lineY + FS * 0.35));
        return (
          <g key={`level-${lv.id}`}>
            {drift > FS * 0.7 && (
              <line x1={LINE_X2+2} y1={lineY} x2={LABEL_X-1} y2={labelY - FS*0.35}
                stroke="#bfdbfe" strokeWidth={0.8} strokeDasharray="3,2" />
            )}
            <line x1={LINE_X1} y1={lineY} x2={LINE_X2} y2={lineY}
              stroke="#1e3a8a" strokeWidth={2.5} strokeLinecap="round" />
            <text x={LABEL_X} y={labelY} textAnchor="start"
              fontSize={FS} fill="#1e293b" fontFamily="system-ui, sans-serif">
              {lv.name}
            </text>
          </g>
        );
      })}

      {/* Transition arrows + labels */}
      {transitions.map(tr => {
        const r   = arrowRanges.get(tr.id);
        const cx  = arrowXs.get(tr.id);
        const lp  = transLabelPositions.get(tr.id);
        if (!r || cx == null) return null;

        const isUp  = r.y2 < r.y1; // endothermic → y2 is higher on screen (smaller Y)
        const color = '#d97706';    // amber
        const tipY  = r.y2;
        const baseY = isUp ? tipY + AH : tipY - AH;

        return (
          <g key={`tr-${tr.id}`}>
            {/* Shaft */}
            <line x1={cx} y1={r.y1} x2={cx} y2={baseY}
              stroke={color} strokeWidth={2} />
            {/* Arrowhead V */}
            <polyline
              points={`${cx-AW},${baseY} ${cx},${tipY} ${cx+AW},${baseY}`}
              fill="none" stroke={color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />
            {/* Label */}
            {tr.label && lp && (
              <text x={lp.x} y={lp.y} fontSize={FS} fill={color}
                fontFamily="system-ui, sans-serif" fontWeight="500">
                {tr.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

EnergyDiagram.displayName = 'EnergyDiagram';
export default EnergyDiagram;
