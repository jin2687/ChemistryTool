import { useMemo, forwardRef } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 340;
const MARGIN = { top: 28, right: 20, bottom: 20, left: 64 };
const PLOT_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
const LEVEL_LINE_WIDTH = 110;
const LEVEL_LINE_X = MARGIN.left + 16;
const ARROW_BASE_X = LEVEL_LINE_X + LEVEL_LINE_WIDTH / 2 + 8;
const LABEL_MIN_GAP = 13; // px, minimum gap between adjacent level labels
const TRANS_LABEL_MIN_GAP = 11;

function energyToY(energy: number, minE: number, maxE: number): number {
  if (maxE === minE) return MARGIN.top + PLOT_HEIGHT / 2;
  const ratio = (energy - minE) / (maxE - minE);
  return MARGIN.top + PLOT_HEIGHT * (1 - ratio);
}

/** Push overlapping items apart until stable or max iterations reached. */
function resolveCollisions(
  items: { id: string; y: number }[],
  minGap: number
): Map<string, number> {
  const arr = items.map((it) => ({ ...it }));
  arr.sort((a, b) => a.y - b.y);

  for (let iter = 0; iter < 40; iter++) {
    let stable = true;
    for (let k = 0; k < arr.length - 1; k++) {
      const gap = arr[k + 1].y - arr[k].y;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        arr[k].y -= push;
        arr[k + 1].y += push;
        stable = false;
      }
    }
    if (stable) break;
  }

  const map = new Map<string, number>();
  arr.forEach(({ id, y }) => map.set(id, y));
  return map;
}

const EnergyDiagram = forwardRef<SVGSVGElement, Props>(({ levels, transitions }, ref) => {
  const { minE, maxE } = useMemo(() => {
    if (levels.length === 0) return { minE: 0, maxE: 100 };
    const energies = levels.map((l) => l.energy);
    const min = Math.min(...energies);
    const max = Math.max(...energies);
    const padding = (max - min) * 0.14 || 40;
    return { minE: min - padding, maxE: max + padding };
  }, [levels]);

  const levelMap = useMemo(() => {
    const map = new Map<string, Level>();
    levels.forEach((l) => map.set(l.id, l));
    return map;
  }, [levels]);

  /** Adjusted label Y positions for level labels (avoid overlap). */
  const levelLabelYs = useMemo(() => {
    const items = levels.map((l) => ({
      id: l.id,
      y: energyToY(l.energy, minE, maxE) - 5,
    }));
    return resolveCollisions(items, LABEL_MIN_GAP);
  }, [levels, minE, maxE]);

  /** Adjusted label Y positions for transition labels (avoid overlap). */
  const transLabelYs = useMemo(() => {
    const items = transitions.map((tr) => {
      const from = levelMap.get(tr.fromLevelId);
      const to = levelMap.get(tr.toLevelId);
      if (!from || !to) return { id: tr.id, y: SVG_HEIGHT / 2 };
      const y1 = energyToY(from.energy, minE, maxE);
      const y2 = energyToY(to.energy, minE, maxE);
      return { id: tr.id, y: (y1 + y2) / 2 };
    });
    return resolveCollisions(items, TRANS_LABEL_MIN_GAP);
  }, [transitions, levelMap, minE, maxE]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="white" />

      {/* Y-axis */}
      <line
        x1={MARGIN.left}
        y1={MARGIN.top - 8}
        x2={MARGIN.left}
        y2={MARGIN.top + PLOT_HEIGHT + 8}
        stroke="#374151"
        strokeWidth={1.5}
      />
      <polygon
        points={`${MARGIN.left - 4},${MARGIN.top - 8} ${MARGIN.left + 4},${MARGIN.top - 8} ${MARGIN.left},${MARGIN.top - 16}`}
        fill="#374151"
      />
      <text
        x={MARGIN.left}
        y={MARGIN.top - 18}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill="#374151"
        fontStyle="italic"
      >
        E
      </text>

      {/* Tick marks + energy axis labels */}
      {levels.map((level) => {
        const y = energyToY(level.energy, minE, maxE);
        return (
          <g key={`tick-${level.id}`}>
            <line
              x1={MARGIN.left - 4}
              y1={y}
              x2={MARGIN.left}
              y2={y}
              stroke="#9ca3af"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 6}
              y={y + 3.5}
              textAnchor="end"
              fontSize={8}
              fill="#9ca3af"
            >
              {level.energy}
            </text>
          </g>
        );
      })}

      {/* Level lines + labels (labels use collision-resolved Y) */}
      {levels.map((level) => {
        const lineY = energyToY(level.energy, minE, maxE);
        const labelY = levelLabelYs.get(level.id) ?? lineY - 5;
        return (
          <g key={`level-${level.id}`}>
            {/* Dotted connector from line to label when they diverge */}
            {Math.abs(labelY - (lineY - 5)) > 2 && (
              <line
                x1={LEVEL_LINE_X}
                y1={lineY}
                x2={LEVEL_LINE_X - 2}
                y2={labelY + 3}
                stroke="#93c5fd"
                strokeWidth={0.8}
                strokeDasharray="2,2"
              />
            )}
            <line
              x1={LEVEL_LINE_X}
              y1={lineY}
              x2={LEVEL_LINE_X + LEVEL_LINE_WIDTH}
              y2={lineY}
              stroke="#1e40af"
              strokeWidth={2}
            />
            <text
              x={LEVEL_LINE_X - 4}
              y={labelY}
              textAnchor="end"
              fontSize={9}
              fill="#1e293b"
              fontFamily="system-ui, sans-serif"
            >
              {level.name}
            </text>
          </g>
        );
      })}

      {/* Transitions */}
      {transitions.map((tr) => {
        const fromLevel = levelMap.get(tr.fromLevelId);
        const toLevel = levelMap.get(tr.toLevelId);
        if (!fromLevel || !toLevel) return null;

        const y1 = energyToY(fromLevel.energy, minE, maxE);
        const y2 = energyToY(toLevel.energy, minE, maxE);
        const x = ARROW_BASE_X + tr.xOffset;
        const isEndothermic = toLevel.energy > fromLevel.energy;
        const color = isEndothermic ? '#2563eb' : '#dc2626';
        const labelY = transLabelYs.get(tr.id) ?? (y1 + y2) / 2;

        return (
          <g key={`tr-${tr.id}`}>
            <defs>
              <marker
                id={`arrow-${tr.id}`}
                markerWidth={7}
                markerHeight={7}
                refX={3.5}
                refY={3.5}
                orient="auto"
              >
                <path
                  d={isEndothermic ? 'M0,7 L3.5,0 L7,7' : 'M0,0 L3.5,7 L7,0'}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
              </marker>
            </defs>
            <line
              x1={x}
              y1={y1}
              x2={x}
              y2={y2}
              stroke={color}
              strokeWidth={1.5}
              markerEnd={`url(#arrow-${tr.id})`}
            />
            {tr.label && (
              <text
                x={x + 6}
                y={labelY + 3.5}
                fontSize={8.5}
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
