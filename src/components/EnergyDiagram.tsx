import React, { useMemo } from 'react';
import type { Level, Transition } from '../types';

interface Props {
  levels: Level[];
  transitions: Transition[];
}

const SVG_WIDTH = 700;
const SVG_HEIGHT = 580;
const MARGIN = { top: 40, right: 40, bottom: 40, left: 80 };
const PLOT_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
const LEVEL_LINE_WIDTH = 140;
const LEVEL_LINE_X = MARGIN.left + 20;
const ARROW_BASE_X = LEVEL_LINE_X + LEVEL_LINE_WIDTH / 2 + 10;

function energyToY(energy: number, minE: number, maxE: number): number {
  if (maxE === minE) return MARGIN.top + PLOT_HEIGHT / 2;
  const ratio = (energy - minE) / (maxE - minE);
  // Invert: higher energy → smaller Y (top of SVG)
  return MARGIN.top + PLOT_HEIGHT * (1 - ratio);
}

const EnergyDiagram: React.FC<Props> = ({ levels, transitions }) => {
  const { minE, maxE } = useMemo(() => {
    if (levels.length === 0) return { minE: 0, maxE: 100 };
    const energies = levels.map((l) => l.energy);
    const min = Math.min(...energies);
    const max = Math.max(...energies);
    const padding = (max - min) * 0.1 || 50;
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
      style={{ maxHeight: '100%' }}
    >
      {/* Background */}
      <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="white" />

      {/* Y-axis */}
      <line
        x1={MARGIN.left}
        y1={MARGIN.top - 10}
        x2={MARGIN.left}
        y2={MARGIN.top + PLOT_HEIGHT + 10}
        stroke="#374151"
        strokeWidth={2}
      />
      {/* Y-axis arrow head */}
      <polygon
        points={`${MARGIN.left - 5},${MARGIN.top - 10} ${MARGIN.left + 5},${MARGIN.top - 10} ${MARGIN.left},${MARGIN.top - 20}`}
        fill="#374151"
      />
      {/* Y-axis label */}
      <text
        x={MARGIN.left - 10}
        y={MARGIN.top - 22}
        textAnchor="middle"
        fontSize={18}
        fontWeight="bold"
        fill="#374151"
        fontStyle="italic"
      >
        E
      </text>

      {/* Tick marks & grid lines */}
      {levels.map((level) => {
        const y = energyToY(level.energy, minE, maxE);
        return (
          <g key={`tick-${level.id}`}>
            <line
              x1={MARGIN.left - 5}
              y1={y}
              x2={MARGIN.left}
              y2={y}
              stroke="#374151"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#6b7280"
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
              strokeWidth={2.5}
            />
            <text
              x={LEVEL_LINE_X - 5}
              y={y - 5}
              textAnchor="end"
              fontSize={11}
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

        // Arrow direction: always from y1 to y2
        const arrowY2 = y2;
        const arrowY1 = y1;

        const midY = (arrowY1 + arrowY2) / 2;

        return (
          <g key={`tr-${tr.id}`}>
            <defs>
              <marker
                id={`arrow-${tr.id}`}
                markerWidth={8}
                markerHeight={8}
                refX={4}
                refY={4}
                orient="auto"
              >
                <path
                  d={isEndothermic ? 'M0,8 L4,0 L8,8' : 'M0,0 L4,8 L8,0'}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
              </marker>
            </defs>
            <line
              x1={x}
              y1={arrowY1}
              x2={x}
              y2={arrowY2}
              stroke={color}
              strokeWidth={2}
              markerEnd={`url(#arrow-${tr.id})`}
            />
            <text
              x={x + 8}
              y={midY + 4}
              fontSize={10}
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
