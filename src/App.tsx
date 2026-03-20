import React, { useState } from 'react';
import type { Level, Transition } from './types';
import { initialLevels, initialTransitions } from './mockData';
import LevelForm from './components/LevelForm';
import TransitionForm from './components/TransitionForm';
import EnergyDiagram from './components/EnergyDiagram';

type ActiveTab = 'levels' | 'transitions';

const App: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [transitions, setTransitions] = useState<Transition[]>(initialTransitions);
  const [activeTab, setActiveTab] = useState<ActiveTab>('levels');

  const addLevel = (level: Level) => setLevels((prev) => [...prev, level]);
  const updateLevel = (updated: Level) =>
    setLevels((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  const deleteLevel = (id: string) => {
    setLevels((prev) => prev.filter((l) => l.id !== id));
    setTransitions((prev) =>
      prev.filter((t) => t.fromLevelId !== id && t.toLevelId !== id)
    );
  };

  const addTransition = (tr: Transition) => setTransitions((prev) => [...prev, tr]);
  const updateTransition = (updated: Transition) =>
    setTransitions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  const deleteTransition = (id: string) =>
    setTransitions((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      className="flex flex-col bg-gray-100"
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 flex items-center gap-2 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(48px + env(safe-area-inset-top))' }}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h1 className="text-base font-semibold text-gray-800 leading-tight">エネルギー準位図メーカー</h1>
      </header>

      {/* Top: Form area (scrollable) */}
      <div className="flex flex-col shrink-0" style={{ height: '52%' }}>
        {/* Tab bar */}
        <div className="flex bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={() => setActiveTab('levels')}
            className={`flex-1 py-3 text-sm font-medium transition-colors active:bg-gray-100 ${
              activeTab === 'levels'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500'
            }`}
          >
            状態 ({levels.length})
          </button>
          <button
            onClick={() => setActiveTab('transitions')}
            className={`flex-1 py-3 text-sm font-medium transition-colors active:bg-gray-100 ${
              activeTab === 'transitions'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500'
            }`}
          >
            遷移 ({transitions.length})
          </button>
        </div>

        {/* Scrollable form content */}
        <div className="flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch">
          <div className="p-4">
            {activeTab === 'levels' ? (
              <LevelForm
                levels={levels}
                onAdd={addLevel}
                onUpdate={updateLevel}
                onDelete={deleteLevel}
              />
            ) : (
              <TransitionForm
                levels={levels}
                transitions={transitions}
                onAdd={addTransition}
                onUpdate={updateTransition}
                onDelete={deleteTransition}
              />
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-300 shrink-0" />

      {/* Bottom: SVG Preview (fixed) */}
      <div className="flex flex-col flex-1 bg-white overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Preview header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">プレビュー</span>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />
              吸熱
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />
              発熱
            </span>
          </div>
        </div>

        {/* SVG */}
        <div className="flex-1 overflow-hidden">
          {levels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
              <svg viewBox="0 0 24 24" className="w-10 h-10 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4-4 4 4 4-8 4 4" />
              </svg>
              <p className="text-sm">上のフォームで状態を追加</p>
            </div>
          ) : (
            <EnergyDiagram levels={levels} transitions={transitions} />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
