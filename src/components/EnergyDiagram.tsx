import { useMemo, forwardRef } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

// ── Layout constants ──────────────────────────────────────────────────────────
const SVG_W = 600;
const SVG_H = 340;
const ML    = 36;
const MT    = 32;
const MB    = 24;
const PH    = SVG_H - MT - MB;   // 284

const LINE_X1 = ML + 10;             // 46  — left edge of level lines
const LINE_X2 = SVG_W - 16 - 160;   // 424 — right edge (160 px for state labels)
const LABEL_X = LINE_X2 + 7;        // 431 — state label left edge

// Arrow columns: ARROW_BASE_X is the x of column 0, each column is SLOT_W apart
const ARROW_BASE_X = LINE_X1 + 96;  // ≈ 142
const SLOT_W       = 40;

// Minimum vertical gap enforced between adjacent level lines
const MIN_LEVEL_GAP = 44;

// Typography
const FS        = 9;                 // font-size px
const LABEL_H   = FS * 1.4;         // ≈ 12.6 — estimated glyph height
const LABEL_GAP = LABEL_H + 2;      // ≈ 14.6 — minimum baseline-to-baseline gap
const AW        = 5;                 // arrowhead half-width
const AH        = 7;                 // arrowhead height

// Forbidden zone around each level line for label baselines:
//   baseline must be ≤ lineY - PIN_ABOVE  (text sits above the line), OR
//   baseline must be ≥ lineY + PIN_BELOW  (text sits below the line)
const PIN_ABOVE = 2;        // px above line
const PIN_BELOW = FS + 3;   // px below line (glyph top clears the line)
// ─────────────────────────────────────────────────────────────────────────────

/** Linear energy→SVG-Y mapping (used only as a starting point for layout). */
function eToY(e: number, lo: number, hi: number): number {
  if (hi === lo) return MT + PH / 2;
  return MT + PH * (1 - (e - lo) / (hi - lo));
}

/** CJK-aware text width estimate. */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    w += ch.charCodeAt(0) > 0x2FFF ? FS * 1.05 : FS * 0.62;
  }
  return w;
}

/**
 * Push items apart so no two sorted-adjacent items are closer than `gap`.
 * Clamps to [topBound, botBound]. Order-preserving.
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
 * Place label baselines satisfying two constraints simultaneously:
 *
 *   1. Level-line avoidance: baseline must not be in the forbidden zone
 *      (lineY − PIN_ABOVE, lineY + PIN_BELOW) for any level line.
 *
 *   2. Label-label separation: two labels whose X spans overlap must have
 *      baselines at least `gap` apart.
 *
 * Each pass:
 *   a. Snap every label away from its nearest forbidden zone.
 *   b. Sort by Y, then push apart every X-overlapping adjacent pair.
 * Repeat until stable (or 300 passes).
 */
function resolveLabels(
  raw: Array<{ id: string; x: number; lw: number; y: number }>,
  pins: number[],
  gap: number,
  topBound = MT + LABEL_H,
  botBound = SVG_H - MB,
): Map<string, number> {
  const arr = raw.map(it => ({ ...it }));

  for (let pass = 0; pass < 300; pass++) {
    let stable = true;

    // ── a. Snap labels away from level-line forbidden zones ──────────────────
    for (const item of arr) {
      for (const pin of pins) {
        if (item.y > pin - PIN_ABOVE && item.y < pin + PIN_BELOW) {
          const toAbove = item.y - (pin - PIN_ABOVE); // dist to "above" safe edge
          const toBelow = (pin + PIN_BELOW) - item.y; // dist to "below" safe edge
          item.y = toAbove <= toBelow ? pin - PIN_ABOVE : pin + PIN_BELOW;
          stable = false;
        }
      }
    }

    // ── b. Push X-overlapping label pairs apart in Y ─────────────────────────
    arr.sort((a, b) => a.y - b.y);
    for (let i = 0; i < arr.length - 1; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const d = arr[j].y - arr[i].y;
        if (d >= gap) break; // sorted ⇒ all further j are also OK

        // Only enforce Y gap when the two labels actually overlap in X
        const xOverlap = arr[i].x < arr[j].x + arr[j].lw &&
                         arr[j].x < arr[i].x + arr[i].lw;
        if (!xOverlap) continue;

        if (d < gap - 0.1) {
          const half = (gap - d) / 2;
          arr[i].y -= half;
          arr[j].y += half;
          stable = false;
        }
      }
    }

    arr.forEach(it => { it.y = Math.max(topBound, Math.min(botBound, it.y)); });
    if (stable) break;
  }

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

  // ── Phase 1: Level line Y positions ─────────────────────────────────────────
  // Energy proportionality is used as a starting point; close levels are pushed
  // apart to MIN_LEVEL_GAP so arrows and labels have room between them.
  const levelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: eToY(l.energy, minE, maxE),
    }));
    return resolveYCollisions(items, MIN_LEVEL_GAP, MT + 4, MT + PH - 4);
  }, [levels, minE, maxE]);

  // State label Y (fine collision resolution on top of level line positions)
  const levelLabelYs = useMemo(() => {
    const items = levels.map(l => ({
      id: l.id,
      y: (levelYs.get(l.id) ?? eToY(l.energy, minE, maxE)) + FS * 0.35,
    }));
    return resolveYCollisions(items, LABEL_GAP);
  }, [levels, levelYs, minE, maxE]);

  // Arrow start/end Y (based on adjusted level positions)
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

  // ── Phase 2: Arrow X assignment (span-based) ─────────────────────────────────
  //
  // "Span" = number of levels whose energy lies STRICTLY between the two endpoint
  // energies.  Transitions that span more levels go further RIGHT.
  //
  // Algorithm:
  //   1. Sort transitions by (span ASC, original index ASC).
  //   2. Assign each the leftmost column c ≥ span such that no arrow already in
  //      column c has a Y range that actually overlaps (> 2 px) with this one.
  //   3. x = ARROW_BASE_X + c × SLOT_W, clamped inside the line span.
  const arrowXs = useMemo(() => {
    // Compute span for each transition
    const withSpan = transitions.map((tr, idx) => {
      const f = levelMap.get(tr.fromLevelId);
      const t = levelMap.get(tr.toLevelId);
      const span = f && t
        ? levels.filter(l => {
            const lo = Math.min(f.energy, t.energy);
            const hi = Math.max(f.energy, t.energy);
            return l.energy > lo && l.energy < hi;
          }).length
        : 0;
      return { tr, span, idx };
    });

    // Sort: span ascending, original index as tie-breaker
    withSpan.sort((a, b) => a.span - b.span || a.idx - b.idx);

    // Greedy column assignment
    // columns[c] = list of Y ranges placed in column c
    const columns: Array<Array<{ yMin: number; yMax: number }>> = [];

    const result = new Map<string, number>();

    for (const { tr, span } of withSpan) {
      const r = arrowRanges.get(tr.id);
      if (!r) continue;

      // Find the leftmost column ≥ span with no Y overlap
      let col = span;
      for (;;) {
        const existing = columns[col] ?? [];
        const conflict = existing.some(p =>
          Math.min(r.yMax, p.yMax) - Math.max(r.yMin, p.yMin) > 2,
        );
        if (!conflict) break;
        col++;
      }

      if (!columns[col]) columns[col] = [];
      columns[col].push({ yMin: r.yMin, yMax: r.yMax });

      const x = Math.min(
        Math.max(ARROW_BASE_X + col * SLOT_W, LINE_X1 + AW + 2),
        LINE_X2 - AW - 2,
      );
      result.set(tr.id, x);
    }

    return result;
  }, [transitions, levels, levelMap, arrowRanges]);

  // ── Phase 3: Transition label placement ──────────────────────────────────────
  //
  // 3a. Determine X side (right preferred, left fallback).
  //     "Right blocked" if:
  //       • right edge would reach state-label column, OR
  //       • another arrow shaft passes through the label's horizontal span at
  //         the label's ARROW midpoint Y.
  //     Same check for left side.  If both blocked, default to right.
  //
  // 3b. Determine Y position via resolveLabels (level-line avoidance +
  //     X-overlap-aware inter-label separation).
  const transLabelPositions = useMemo(() => {
    // Build shaft registry
    const shafts = transitions.flatMap(tr => {
      const x = arrowXs.get(tr.id);
      const r = arrowRanges.get(tr.id);
      return x != null && r != null ? [{ id: tr.id, x, ...r }] : [];
    });

    // 3a — decide X side for each label
    type LabelDraft = { id: string; x: number; lw: number; y: number };
    const drafts: LabelDraft[] = [];

    for (const tr of transitions) {
      if (!tr.label) continue;
      const cx = arrowXs.get(tr.id);
      const r  = arrowRanges.get(tr.id);
      if (cx == null || r == null) continue;

      const midY = (r.y1 + r.y2) / 2;
      const lw   = textWidth(tr.label);

      // Right-side candidate
      const rx    = cx + AW + 4;
      const rxEnd = rx + lw;
      const rightOk =
        rxEnd < LABEL_X - 4 &&
        !shafts.some(s =>
          s.id !== tr.id &&
          s.x > rx && s.x < rxEnd &&
          midY > s.yMin && midY < s.yMax,
        );

      // Left-side candidate
      const lxEnd = cx - AW - 4;
      const lx    = Math.max(LINE_X1 + 2, lxEnd - lw);
      const leftOk =
        lx + lw <= cx - AW - 2 &&   // label actually fits left of own shaft
        !shafts.some(s =>
          s.id !== tr.id &&
          s.x > lx && s.x < lx + lw &&
          midY > s.yMin && midY < s.yMax,
        );

      const chosenX = rightOk ? rx : leftOk ? lx : rx; // prefer right, then left, else right

      drafts.push({ id: tr.id, x: chosenX, lw, y: midY + FS * 0.35 });
    }

    // 3b — resolve label Y positions (all labels together, X-overlap-aware)
    const levelPins = Array.from(levelYs.values());
    const resolved  = resolveLabels(drafts, levelPins, LABEL_GAP);

    const result = new Map<string, { x: number; y: number }>();
    drafts.forEach(d => {
      result.set(d.id, { x: d.x, y: resolved.get(d.id) ?? d.y });
    });
    return result;
  }, [transitions, arrowXs, arrowRanges, levelYs]);

  // ── Render ────────────────────────────────────────────────────────────────────
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
      <polygon points={`${ML-4},${MT-8} ${ML+4},${MT-8} ${ML},${MT-18}`} fill="#374151" />
      <text x={ML} y={MT - 20} textAnchor="middle" fontSize={11}
        fontWeight="bold" fill="#374151" fontStyle="italic">E</text>
      <text x={ML - 2} y={MT - 6}       textAnchor="middle" fontSize={8} fill="#6b7280">高</text>
      <text x={ML - 2} y={MT + PH + 18} textAnchor="middle" fontSize={8} fill="#6b7280">低</text>

      {/* Tick marks — aligned to adjusted level positions */}
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
              <line
                x1={LINE_X2 + 2} y1={lineY}
                x2={LABEL_X - 1} y2={labelY - FS * 0.35}
                stroke="#bfdbfe" strokeWidth={0.8} strokeDasharray="3,2"
              />
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

        const isUp  = r.y2 < r.y1;
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
