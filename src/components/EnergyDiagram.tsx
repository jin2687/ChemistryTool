import React, { useMemo } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

// Landscape viewBox optimized for mobile bottom pane
const SVG_WIDTH = 600;
const SVG_HEIGHT = 340;
const MARGIN = { top: 28, right: 20, bottom: 20, left: 64 };
const PLOT_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
const LEVEL_LINE_WIDTH = 110;
const LEVEL_LINE_X = MARGIN.left + 16;
const ARROW_BASE_X = LEVEL_LINE_X + LEVEL_LINE_WIDTH / 2 + 8;

function energyToY(energy: number, minE: number, maxE: number): number {
  if (maxE === minE) return MARGIN.top + PLOT_HEIGHT / 2;
  const ratio = (energy - minE) / (maxE - minE);
  return MARGIN.top + PLOT_HEIGHT * (1 - ratio);
}

const EnergyDiagram: React.FC<Props> = ({ levels, transitions }) => {
  const { minE, maxE } = useMemo(() => {
    if (levels.length === 0) return { minE: 0, maxE: 100 };
    const energies = levels.map((l) => l.energy);
    const min = Math.min(...energies);
    const max = Math.max(...energies);
    const padding = (max - min) * 0.12 || 40;
    return { minE: min - padding, maxE: max + padding };
  }, [levels]);

  const levelMap = useMemo(() => {
    const map = new Map<string, Level>();
    levels.forEach((l) => map.set(l.id, l));
    return map;
  }, [levels]);

  return (
    <svg
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
      {/* Arrow head */}
      <polygon
        points={`${MARGIN.left - 4},${MARGIN.top - 8} ${MARGIN.left + 4},${MARGIN.top - 8} ${MARGIN.left},${MARGIN.top - 16}`}
        fill="#374151"
      />
      {/* E label */}
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

      {/* Tick marks + energy labels */}
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

      {/* Level lines */}
      {levels.map((level) => {
        const y = energyToY(level.energy, minE, maxE);
        return (
          <g key={`level-${level.id}`}>
            <line
              x1={LEVEL_LINE_X}
              y1={y}
              x2={LEVEL_LINE_X + LEVEL_LINE_WIDTH}
              y2={y}
              stroke="#1e40af"
              strokeWidth={2}
            />
            <text
              x={LEVEL_LINE_X - 4}
              y={y - 4}
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
        const midY = (y1 + y2) / 2;

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
            <text
              x={x + 6}
              y={midY + 3.5}
              fontSize={8.5}
              fill={color}
              fontFamily="system-ui, sans-serif"
            >
              {tr.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default EnergyDiagram;
