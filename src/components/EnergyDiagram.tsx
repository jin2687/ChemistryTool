import { useMemo, forwardRef } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

// ── Layout ────────────────────────────────────────────────────────────────────
const SVG_W  = 600;
const SVG_H  = 340;
const ML     = 36;          // left margin  (Y-axis)
const MT     = 32;          // top  margin
const MB     = 24;          // bottom margin
const MR     = 16;          // right margin
const PH     = SVG_H - MT - MB;

// Level lines: wide, spanning the bulk of the diagram
const LINE_X1 = ML + 10;    // 46  – left edge of level line
const LINE_X2 = SVG_W - MR - 160; // 424 – right edge  (160 px for labels)
const LABEL_X  = LINE_X2 + 7;     // 431 – state label starts here

// Arrows default center is inside the level-line span
const ARROW_DEFAULT_X = LINE_X1 + (LINE_X2 - LINE_X1) * 0.30; // ≈ 145

const FONT_SIZE   = 9;
const LABEL_H     = FONT_SIZE * 1.4;   // ≈ 12.6 px  (estimated bbox height)
const LABEL_GAP   = LABEL_H + 2;       // ≈ 14.6 px  minimum baseline gap
const ARROW_W     = 5;                  // arrowhead half-width
const ARROW_H     = 7;                  // arrowhead height
// ─────────────────────────────────────────────────────────────────────────────

function eToY(energy: number, minE: number, maxE: number): number {
  if (maxE === minE) return MT + PH / 2;
  return MT + PH * (1 - (energy - minE) / (maxE - minE));
}

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
        arr[k].y     -= half;
        arr[k + 1].y += half;
        stable = false;
      }
    }
    if (stable) break;
  }

  arr.forEach(it => {
    it.y = Math.max(MT + LABEL_H, Math.min(SVG_H - MB, it.y));
  });

  const map = new Map<string, number>();
  arr.forEach(({ id, y }) => map.set(id, y));
  return map;
}

const EnergyDiagram = forwardRef<SVGSVGElement, Props>(({ levels, transitions }, ref) => {
  const { minE, maxE } = useMemo(() => {
    if (levels.length === 0) return { minE: 0, maxE: 100 };
    const es  = levels.map(l => l.energy);
    const lo  = Math.min(...es);
    const hi  = Math.max(...es);
    const pad = (hi - lo) * 0.15 || 40;
    return { minE: lo - pad, maxE: hi + pad };
  }, [levels]);

  const levelMap = useMemo(() => {
    const m = new Map<string, Level>();
    levels.forEach(l => m.set(l.id, l));
    return m;
  }, [levels]);

  // Label Y positions for state names (right side of lines)
  const levelLabelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: eToY(l.energy, minE, maxE) + FONT_SIZE * 0.35,
    }));
    return resolveCollisions(items, LABEL_GAP);
  }, [levels, minE, maxE]);

  // Label Y positions for transition energy labels (beside arrows)
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
      <line x1={ML} y1={MT - 8} x2={ML} y2={MT + PH + 6}
        stroke="#374151" strokeWidth={1.5} />
      <polygon
        points={`${ML - 4},${MT - 8} ${ML + 4},${MT - 8} ${ML},${MT - 18}`}
        fill="#374151"
      />
      <text x={ML} y={MT - 20} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#374151" fontStyle="italic">E</text>
      {/* 高/低 labels */}
      <text x={ML - 2} y={MT - 6} textAnchor="middle" fontSize={8} fill="#6b7280">高</text>
      <text x={ML - 2} y={MT + PH + 18} textAnchor="middle" fontSize={8} fill="#6b7280">低</text>

      {/* ── Axis tick marks ── */}
      {levels.map(level => {
        const y = eToY(level.energy, minE, maxE);
        return (
          <g key={`tick-${level.id}`}>
            <line x1={ML - 4} y1={y} x2={ML} y2={y} stroke="#9ca3af" strokeWidth={1} />
            <text x={ML - 6} y={y + 3.5} textAnchor="end" fontSize={7} fill="#9ca3af">
              {level.energy}
            </text>
          </g>
        );
      })}

      {/* ── Level lines ── */}
      {levels.map(level => {
        const lineY  = eToY(level.energy, minE, maxE);
        const labelY = levelLabelYs.get(level.id) ?? lineY + FONT_SIZE * 0.35;
        const drift  = Math.abs(labelY - (lineY + FONT_SIZE * 0.35));

        return (
          <g key={`level-${level.id}`}>
            {/* Dashed leader when label is pushed away */}
            {drift > FONT_SIZE * 0.7 && (
              <line
                x1={LINE_X2 + 2} y1={lineY}
                x2={LABEL_X - 1} y2={labelY - FONT_SIZE * 0.35}
                stroke="#bfdbfe" strokeWidth={0.8} strokeDasharray="3,2"
              />
            )}
            {/* Wide horizontal level line */}
            <line x1={LINE_X1} y1={lineY} x2={LINE_X2} y2={lineY}
              stroke="#1e3a8a" strokeWidth={2.5} strokeLinecap="round" />
            {/* State label – right of line */}
            <text
              x={LABEL_X} y={labelY}
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

      {/* ── Transitions (arrows overlaid on the level-line span) ── */}
      {transitions.map(tr => {
        const fromLv = levelMap.get(tr.fromLevelId);
        const toLv   = levelMap.get(tr.toLevelId);
        if (!fromLv || !toLv) return null;

        const y1     = eToY(fromLv.energy, minE, maxE);
        const y2     = eToY(toLv.energy,   minE, maxE);
        // Arrow X: default inside the line span, adjusted by xOffset
        const cx     = ARROW_DEFAULT_X + tr.xOffset;
        const isUp   = toLv.energy > fromLv.energy;
        const color  = isUp ? '#d97706' : '#d97706'; // amber like reference image
        const labelY = transLabelYs.get(tr.id) ?? (y1 + y2) / 2 + FONT_SIZE * 0.35;

        const tipY   = y2;
        const baseY  = isUp ? tipY + ARROW_H : tipY - ARROW_H;

        return (
          <g key={`tr-${tr.id}`}>
            {/* Shaft */}
            <line
              x1={cx} y1={y1}
              x2={cx} y2={baseY}
              stroke={color} strokeWidth={2}
            />
            {/* Arrowhead – open V */}
            <polyline
              points={`${cx - ARROW_W},${baseY} ${cx},${tipY} ${cx + ARROW_W},${baseY}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Energy label beside arrow */}
            {tr.label && (
              <text
                x={cx + ARROW_W + 4}
                y={labelY}
                fontSize={FONT_SIZE}
                fill={color}
                fontFamily="system-ui, sans-serif"
                fontWeight="500"
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
