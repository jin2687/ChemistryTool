import type { Level, Transition } from './types';

// Born-Haber cycle for NaCl (approximate values in kJ/mol)
export const initialLevels: Level[] = [
  { id: 'l1', name: 'Na(s) + ½Cl₂(g)', energy: 0 },
  { id: 'l2', name: 'Na(g) + ½Cl₂(g)', energy: 108 },
  { id: 'l3', name: 'Na(g) + Cl(g)', energy: 229 },
  { id: 'l4', name: 'Na⁺(g) + Cl(g) + e⁻', energy: 765 },
  { id: 'l5', name: 'Na⁺(g) + Cl⁻(g)', energy: 417 },
  { id: 'l6', name: 'NaCl(s)', energy: -411 },
];

export const initialTransitions: Transition[] = [
  { id: 't1', fromLevelId: 'l1', toLevelId: 'l2', label: '昇華熱 +108', xOffset: 0 },
  { id: 't2', fromLevelId: 'l2', toLevelId: 'l3', label: '解離エネルギー +121', xOffset: 60 },
  { id: 't3', fromLevelId: 'l3', toLevelId: 'l4', label: 'イオン化エネルギー +536', xOffset: 120 },
  { id: 't4', fromLevelId: 'l4', toLevelId: 'l5', label: '電子親和力 −348', xOffset: 60 },
  { id: 't5', fromLevelId: 'l5', toLevelId: 'l6', label: '格子エネルギー −788', xOffset: 0 },
];
