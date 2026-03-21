import { useMemo, forwardRef } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

// ── Layout constants ──────────────────────────────────────────────────────────
const SVG_W = 600;
const SVG_H = 340;
const ML    = 36;   // left margin (Y-axis)
const MT    = 32;   // top margin
const MB    = 24;   // bottom margin
const PH    = SVG_H - MT - MB;  // plot height = 284

const LINE_X1 = ML + 10;             // 46   — left edge of level lines
const LINE_X2 = SVG_W - 16 - 160;   // 424  — right edge (160 px for state labels)
const LABEL_X = LINE_X2 + 7;        // 431  — state label x

// Arrow columns
const ARROW_BASE_X = LINE_X1 + (LINE_X2 - LINE_X1) * 0.28; // ≈ 141
const SLOT_W       = 38;   // px between auto-separated arrow columns
const SHAFT_TOL    = 8;    // two shafts within this distance are "same column"

// Minimum vertical gap between adjacent level lines (keeps arrows readable)
const MIN_LEVEL_GAP = 44;

const FS        = 9;               // font size
const LABEL_H   = FS * 1.4;       // ≈ 12.6 — estimated text height
const LABEL_GAP = LABEL_H + 2;    // ≈ 14.6 — min gap between baselines
const AW        = 5;               // arrowhead half-width
const AH        = 7;               // arrowhead height
// ─────────────────────────────────────────────────────────────────────────────

/** Map energy → SVG-Y (strictly proportional to energy). Used only as starting
 *  point; level line positions are then spread to MIN_LEVEL_GAP. */
function eToY(e: number, lo: number, hi: number): number {
  if (hi === lo) return MT + PH / 2;
  return MT + PH * (1 - (e - lo) / (hi - lo));
}

/** Estimate rendered text width, treating CJK characters as full-width. */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    // Hiragana, Katakana, CJK Unified Ideographs, fullwidth symbols, etc.
    w += ch.charCodeAt(0) > 0x2FFF ? FS * 1.05 : FS * 0.62;
  }
  return w;
}

/**
 * Push items apart vertically so no adjacent pair is closer than `gap`.
 * Preserves order. Clamps to [topBound, botBound].
 */
function resolveYCollisions(
  raw: Array<{ id: string; y: number }>,
  gap: number,
  topBound = MT + LABEL_H,
  botBound = SVG_H - MB,
): Map<string, number> {
  const arr = raw.map(it => ({ ...it }));
  arr.sort((a, b) => a.y - b.y);
  for (let pass = 0; pass < 120; pass++) {
    let stable = true;
    for (let k = 0; k < arr.length - 1; k++) {
      const d = arr[k + 1].y - arr[k].y;
      if (d < gap - 0.1) {
        const half = (gap - d) / 2;
        arr[k].y     -= half;
        arr[k + 1].y += half;
        stable = false;
      }
    }
    if (stable) break;
  }
  arr.forEach(it => { it.y = Math.max(topBound, Math.min(botBound, it.y)); });
  const m = new Map<string, number>();
  arr.forEach(({ id, y }) => m.set(id, y));
  return m;
}

/**
 * Like resolveYCollisions, but also pushes label baselines away from
 * horizontal level lines (pins).  A baseline `y` must satisfy either
 *   y ≤ pin − PIN_ABOVE   (text sits above the line)
 *   y ≥ pin + PIN_BELOW   (text sits below the line)
 * where PIN_ABOVE keeps a small top-gap and PIN_BELOW ensures the glyph
 * body (extending upward from the baseline by ~FS px) clears the line.
 */
const PIN_ABOVE = 2;        // px clearance: baseline above line
const PIN_BELOW = FS + 3;   // px clearance: baseline below line (glyph clears)

function resolveYWithPins(
  raw: Array<{ id: string; y: number }>,
  pins: number[],
  gap: number,
  topBound = MT + LABEL_H,
  botBound = SVG_H - MB,
): Map<string, number> {
  const arr = raw.map(it => ({ ...it }));
  for (let pass = 0; pass < 200; pass++) {
    arr.sort((a, b) => a.y - b.y);
    let stable = true;

    // 1. Push away from level-line pins
    for (const item of arr) {
      for (const pin of pins) {
        if (item.y > pin - PIN_ABOVE && item.y < pin + PIN_BELOW) {
          // Move to the nearer safe edge
          const toAbove = item.y - (pin - PIN_ABOVE);
          const toBelow = (pin + PIN_BELOW) - item.y;
          item.y = toAbove <= toBelow ? pin - PIN_ABOVE : pin + PIN_BELOW;
          stable = false;
        }
      }
    }

    // 2. Push labels apart from each other
    arr.sort((a, b) => a.y - b.y);
    for (let k = 0; k < arr.length - 1; k++) {
      const d = arr[k + 1].y - arr[k].y;
      if (d < gap - 0.1) {
        const half = (gap - d) / 2;
        arr[k].y     -= half;
        arr[k + 1].y += half;
        stable = false;
      }
    }

    if (stable) break;
  }
  arr.forEach(it => { it.y = Math.max(topBound, Math.min(botBound, it.y)); });
  const m = new Map<string, number>();
  arr.forEach(({ id, y }) => m.set(id, y));
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Level line Y positions (order-preserving, minimum gap enforced) ────────
  // Energy proportionality is used as the starting point but is not strict;
  // close levels are pushed apart so arrows and labels have room to breathe.
  const levelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: eToY(l.energy, minE, maxE),
    }));
    // Use narrower bounds so lines stay well inside the plot area
    return resolveYCollisions(items, MIN_LEVEL_GAP, MT + 4, MT + PH - 4);
  }, [levels, minE, maxE]);

  // ── State label Y positions (secondary fine-resolution on top of levelYs) ──
  const levelLabelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: (levelYs.get(l.id) ?? eToY(l.energy, minE, maxE)) + FS * 0.35,
    }));
    return resolveYCollisions(items, LABEL_GAP);
  }, [levels, levelYs, minE, maxE]);

  // ── Arrow Y ranges (using adjusted level positions) ────────────────────────
  const arrowRanges = useMemo(() => {
    const m = new Map<string, { y1: number; y2: number; yMin: number; yMax: number }>();
    for (const tr of transitions) {
      const f = levelMap.get(tr.fromLevelId);
      const t = levelMap.get(tr.toLevelId);
      if (!f || !t) continue;
      const y1 = levelYs.get(f.id) ?? eToY(f.energy, minE, maxE);
      const y2 = levelYs.get(t.id) ?? eToY(t.energy, minE, maxE);
      m.set(tr.id, { y1, y2, yMin: Math.min(y1, y2), yMax: Math.max(y1, y2) });
    }
    return m;
  }, [transitions, levelMap, levelYs, minE, maxE]);

  // ── Auto-assign arrow X positions (separate overlapping shafts) ────────────
  // The user's xOffset is the desired column; when two arrows would share the
  // same column AND their Y ranges overlap, the later one is nudged right.
  const arrowXs = useMemo(() => {
    const result = new Map<string, number>();
    const placed: Array<{ x: number; yMin: number; yMax: number }> = [];

    for (const tr of transitions) {
      const r = arrowRanges.get(tr.id);
      if (!r) continue;

      let x = ARROW_BASE_X + tr.xOffset;

      for (let attempt = 0; attempt < 12; attempt++) {
        const conflict = placed.find(p =>
          Math.abs(p.x - x) < SHAFT_TOL &&
          Math.min(r.yMax, p.yMax) - Math.max(r.yMin, p.yMin) > 2,
        );
        if (!conflict) break;
        x += SLOT_W;
      }
      x = Math.min(Math.max(x, LINE_X1 + AW + 2), LINE_X2 - AW - 2);

      result.set(tr.id, x);
      placed.push({ x, yMin: r.yMin, yMax: r.yMax });
    }
    return result;
  }, [transitions, arrowRanges]);

  // ── Transition label X / Y positions ──────────────────────────────────────
  // For each label: try RIGHT side of its arrow first. Fall back to LEFT if:
  //   (a) right side would reach the state-label column, OR
  //   (b) right side would cross another arrow's shaft.
  // Y collisions are then resolved independently per side (right / left).
  const transLabelPositions = useMemo(() => {
    // Shaft registry for quick lookup
    const shafts = transitions.flatMap(tr => {
      const x = arrowXs.get(tr.id);
      const r = arrowRanges.get(tr.id);
      return x != null && r != null ? [{ id: tr.id, x, ...r }] : [];
    });

    type Info = { id: string; x: number; y: number; side: 'right' | 'left' };
    const labels: Info[] = [];

    for (const tr of transitions) {
      if (!tr.label) continue;
      const cx = arrowXs.get(tr.id);
      const r  = arrowRanges.get(tr.id);
      if (cx == null || r == null) continue;

      const midY = (r.y1 + r.y2) / 2;           // label sits at midpoint of shaft
      const lw   = textWidth(tr.label);           // CJK-aware width estimate
      const rx   = cx + AW + 4;                  // right-side candidate x
      const rxEnd = rx + lw;

      const rightBlocked =
        // would collide with state labels
        rxEnd >= LABEL_X - 4 ||
        // would cross another arrow's shaft (check if shaft.x is in the label's
        // horizontal span AND midY falls within that shaft's vertical range)
        shafts.some(s =>
          s.id !== tr.id &&
          s.x > rx && s.x < rxEnd &&
          midY > s.yMin && midY < s.yMax,
        );

      let lx: number;
      let side: 'right' | 'left';
      if (!rightBlocked) {
        lx = rx;  side = 'right';
      } else {
        lx = Math.max(LINE_X1 + 2, cx - AW - 4 - lw);
        side = 'left';
      }

      labels.push({ id: tr.id, x: lx, y: midY + FS * 0.35, side });
    }

    // Collect level-line Y positions: labels must not overlap these
    const levelPins = Array.from(levelYs.values());

    // Resolve Y collisions, also avoiding level lines (pins)
    const resolve = (side: 'right' | 'left') => {
      const items = labels.filter(l => l.side === side).map(l => ({ id: l.id, y: l.y }));
      return resolveYWithPins(items, levelPins, LABEL_GAP);
    };
    const rightYs = resolve('right');
    const leftYs  = resolve('left');

    const result = new Map<string, { x: number; y: number }>();
    labels.forEach(l => {
      const ry = (l.side === 'right' ? rightYs : leftYs).get(l.id) ?? l.y;
      result.set(l.id, { x: l.x, y: ry });
    });
    return result;
  }, [transitions, arrowXs, arrowRanges, levelYs]);

  // ── Render ─────────────────────────────────────────────────────────────────
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
      <line x1={ML} y1={MT - 8} x2={ML} y2={MT + PH + 6}
        stroke="#374151" strokeWidth={1.5} />
      <polygon points={`${ML-4},${MT-8} ${ML+4},${MT-8} ${ML},${MT-18}`}
        fill="#374151" />
      <text x={ML} y={MT - 20} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#374151" fontStyle="italic">E</text>
      <text x={ML-2} y={MT - 6}      textAnchor="middle" fontSize={8} fill="#6b7280">高</text>
      <text x={ML-2} y={MT + PH + 18} textAnchor="middle" fontSize={8} fill="#6b7280">低</text>

      {/* Axis tick marks — aligned to adjusted level positions so tick = line */}
      {levels.map(lv => {
        const y = levelYs.get(lv.id) ?? eToY(lv.energy, minE, maxE);
        return (
          <g key={`tick-${lv.id}`}>
            <line x1={ML - 4} y1={y} x2={ML} y2={y} stroke="#9ca3af" strokeWidth={1} />
            <text x={ML - 6} y={y + 3.5} textAnchor="end" fontSize={7} fill="#9ca3af">
              {lv.energy}
            </text>
          </g>
        );
      })}

      {/* Level lines + state labels */}
      {levels.map(lv => {
        const lineY  = levelYs.get(lv.id) ?? eToY(lv.energy, minE, maxE);
        const labelY = levelLabelYs.get(lv.id) ?? lineY + FS * 0.35;
        const drift  = Math.abs(labelY - (lineY + FS * 0.35));
        return (
          <g key={`level-${lv.id}`}>
            {drift > FS * 0.7 && (
              <line x1={LINE_X2 + 2} y1={lineY} x2={LABEL_X - 1} y2={labelY - FS * 0.35}
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
        const r  = arrowRanges.get(tr.id);
        const cx = arrowXs.get(tr.id);
        const lp = transLabelPositions.get(tr.id);
        if (!r || cx == null) return null;

        const isUp  = r.y2 < r.y1;   // true when transition goes to higher energy
        const color = '#d97706';
        const tipY  = r.y2;
        const baseY = isUp ? tipY + AH : tipY - AH;

        return (
          <g key={`tr-${tr.id}`}>
            {/* Shaft */}
            <line x1={cx} y1={r.y1} x2={cx} y2={baseY}
              stroke={color} strokeWidth={2} />
            {/* Arrowhead (open V) */}
            <polyline
              points={`${cx - AW},${baseY} ${cx},${tipY} ${cx + AW},${baseY}`}
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
