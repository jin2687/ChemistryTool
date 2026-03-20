import { useMemo, forwardRef } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

// ── Layout constants ──────────────────────────────────────────────────────────
const SVG_W = 600;
const SVG_H = 340;
const MT = 32;          // margin top
const MB = 20;          // margin bottom
const ML = 44;          // margin left  (Y-axis + tick values)
const PH = SVG_H - MT - MB; // plot height

const LINE_X1 = ML + 10;        // level line left  x = 54
const LINE_X2 = LINE_X1 + 96;   // level line right x = 150
const LABEL_X = LINE_X2 + 6;    // label starts at x = 156 (right of line)

const FONT_SIZE = 9;
// Estimated text bounding box height = fontSize * 1.4 ≈ 12.6 px
const LABEL_H  = FONT_SIZE * 1.4;
const LABEL_GAP = LABEL_H + 2;  // min gap between label baselines ≈ 14.6 px

const ARROW_CX = 340;  // default arrow center x
const AW = 5;           // arrowhead half-width
const AH = 7;           // arrowhead height
// ─────────────────────────────────────────────────────────────────────────────

function eToY(energy: number, minE: number, maxE: number): number {
  if (maxE === minE) return MT + PH / 2;
  return MT + PH * (1 - (energy - minE) / (maxE - minE));
}

/**
 * Iteratively push overlapping items apart (symmetric).
 * Items are the TEXT BASELINE Y positions.
 */
function resolveCollisions(
  raw: Array<{ id: string; y: number }>,
  gap: number,
): Map<string, number> {
  const arr = raw.map(it => ({ ...it }));
  arr.sort((a, b) => a.y - b.y);

  for (let pass = 0; pass < 60; pass++) {
    let stable = true;
    for (let k = 0; k < arr.length - 1; k++) {
      const overlap = gap - (arr[k + 1].y - arr[k].y);
      if (overlap > 0.1) {
        const half = overlap / 2;
        arr[k].y -= half;
        arr[k + 1].y += half;
        stable = false;
      }
    }
    if (stable) break;
  }

  // Clamp within SVG bounds
  arr.forEach(it => {
    it.y = Math.max(MT + LABEL_H, Math.min(SVG_H - MB, it.y));
  });

  const map = new Map<string, number>();
  arr.forEach(({ id, y }) => map.set(id, y));
  return map;
}

const EnergyDiagram = forwardRef<SVGSVGElement, Props>(({ levels, transitions }, ref) => {
  // ── Energy range with padding ──
  const { minE, maxE } = useMemo(() => {
    if (levels.length === 0) return { minE: 0, maxE: 100 };
    const es = levels.map(l => l.energy);
    const lo = Math.min(...es);
    const hi = Math.max(...es);
    const pad = (hi - lo) * 0.15 || 40;
    return { minE: lo - pad, maxE: hi + pad };
  }, [levels]);

  const levelMap = useMemo(() => {
    const m = new Map<string, Level>();
    levels.forEach(l => m.set(l.id, l));
    return m;
  }, [levels]);

  // ── Collision-resolved label Y (baseline) for level labels ──
  // Initial position: vertically centred on the level line.
  //   text centre  ≈ baseline − FONT_SIZE * 0.35
  //   → baseline   = lineY + FONT_SIZE * 0.35
  const levelLabelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: eToY(l.energy, minE, maxE) + FONT_SIZE * 0.35,
    }));
    return resolveCollisions(items, LABEL_GAP);
  }, [levels, minE, maxE]);

  // ── Collision-resolved label Y for transition labels ──
  const transLabelYs = useMemo(() => {
    const items = transitions.map(tr => {
      const f = levelMap.get(tr.fromLevelId);
      const t = levelMap.get(tr.toLevelId);
      const midY = f && t
        ? (eToY(f.energy, minE, maxE) + eToY(t.energy, minE, maxE)) / 2
        : SVG_H / 2;
      return { id: tr.id, y: midY + FONT_SIZE * 0.35 };
    });
    return resolveCollisions(items, LABEL_GAP);
  }, [transitions, levelMap, minE, maxE]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <rect width={SVG_W} height={SVG_H} fill="white" />

      {/* ── Y-axis ── */}
      <line x1={ML} y1={MT - 8} x2={ML} y2={MT + PH + 6} stroke="#374151" strokeWidth={1.5} />
      <polygon
        points={`${ML - 4},${MT - 8} ${ML + 4},${MT - 8} ${ML},${MT - 18}`}
        fill="#374151"
      />
      <text x={ML} y={MT - 20} textAnchor="middle" fontSize={13} fontWeight="bold"
        fill="#374151" fontStyle="italic">E</text>

      {/* ── Axis tick marks (energy values on Y-axis) ── */}
      {levels.map(level => {
        const y = eToY(level.energy, minE, maxE);
        return (
          <g key={`tick-${level.id}`}>
            <line x1={ML - 4} y1={y} x2={ML} y2={y} stroke="#9ca3af" strokeWidth={1} />
            <text x={ML - 6} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="#9ca3af">
              {level.energy}
            </text>
          </g>
        );
      })}

      {/* ── Level lines + labels (label RIGHT of line, collision-resolved) ── */}
      {levels.map(level => {
        const lineY  = eToY(level.energy, minE, maxE);
        const labelY = levelLabelYs.get(level.id) ?? lineY + FONT_SIZE * 0.35;
        // Draw a small dashed leader only when pushed > half a text-height away
        const drift  = Math.abs(labelY - (lineY + FONT_SIZE * 0.35));
        return (
          <g key={`level-${level.id}`}>
            {/* Dashed leader from right end of line to label */}
            {drift > FONT_SIZE * 0.7 && (
              <line
                x1={LINE_X2}      y1={lineY}
                x2={LABEL_X - 1}  y2={labelY - FONT_SIZE * 0.35}
                stroke="#bfdbfe"
                strokeWidth={0.8}
                strokeDasharray="3,2"
              />
            )}
            {/* Horizontal level line */}
            <line x1={LINE_X1} y1={lineY} x2={LINE_X2} y2={lineY}
              stroke="#1e40af" strokeWidth={2.2} strokeLinecap="round" />
            {/* Label – right of the line, vertically centred */}
            <text
              x={LABEL_X}
              y={labelY}
              textAnchor="start"
              fontSize={FONT_SIZE}
              fill="#1e293b"
              fontFamily="system-ui, sans-serif"
            >
              {level.name}
            </text>
          </g>
        );
      })}

      {/* ── Transitions (manual arrowheads – no SVG markers) ── */}
      {transitions.map(tr => {
        const fromLv = levelMap.get(tr.fromLevelId);
        const toLv   = levelMap.get(tr.toLevelId);
        if (!fromLv || !toLv) return null;

        const y1   = eToY(fromLv.energy, minE, maxE);
        const y2   = eToY(toLv.energy,   minE, maxE);
        const cx   = ARROW_CX + tr.xOffset;
        const isUp = toLv.energy > fromLv.energy; // endothermic → arrow UP
        const color = isUp ? '#2563eb' : '#dc2626';
        const labelY = transLabelYs.get(tr.id) ?? (y1 + y2) / 2 + FONT_SIZE * 0.35;

        // Arrowhead tip is at y2; base is AH pixels back along the shaft
        const tipY  = y2;
        const baseY = isUp ? tipY + AH : tipY - AH;

        return (
          <g key={`tr-${tr.id}`}>
            {/* Shaft (stops at arrowhead base, not tip) */}
            <line
              x1={cx} y1={y1}
              x2={cx} y2={baseY}
              stroke={color} strokeWidth={1.6}
            />
            {/* Arrowhead – open V, manually drawn */}
            <polyline
              points={`${cx - AW},${baseY} ${cx},${tipY} ${cx + AW},${baseY}`}
              fill="none"
              stroke={color}
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Transition label */}
            {tr.label && (
              <text
                x={cx + AW + 4}
                y={labelY}
                fontSize={FONT_SIZE}
                fill={color}
                fontFamily="system-ui, sans-serif"
              >
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
