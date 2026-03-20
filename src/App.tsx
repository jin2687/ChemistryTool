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
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h1 className="text-lg font-semibold text-gray-800">エネルギー準位図メーカー</h1>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          ヘスの法則 / ボルン・ハーバーサイクル
        </span>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('levels')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'levels'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              状態 ({levels.length})
            </button>
            <button
              onClick={() => setActiveTab('transitions')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'transitions'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              遷移 ({transitions.length})
            </button>
          </div>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'levels' ? (
              <>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">状態（エネルギー準位）</h2>
                  <p className="text-xs text-gray-400 mt-0.5">水平線として描画されます</p>
                </div>
                <LevelForm
                  levels={levels}
                  onAdd={addLevel}
                  onUpdate={updateLevel}
                  onDelete={deleteLevel}
                />
              </>
            ) : (
              <>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">遷移（エネルギー変化）</h2>
                  <p className="text-xs text-gray-400 mt-0.5">垂直矢印として描画されます</p>
                </div>
                <TransitionForm
                  levels={levels}
                  transitions={transitions}
                  onAdd={addTransition}
                  onUpdate={updateTransition}
                  onDelete={deleteTransition}
                />
              </>
            )}
          </div>

          {/* Footer stats */}
          <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
            <div className="flex gap-4 text-xs text-gray-500">
              <span>
                <span className="font-medium text-blue-600">{levels.length}</span> 状態
              </span>
              <span>
                <span className="font-medium text-blue-600">{transitions.length}</span> 遷移
              </span>
              {levels.length >= 2 && (
                <span>
                  範囲:{' '}
                  <span className="font-medium text-gray-700">
                    {Math.min(...levels.map((l) => l.energy))} ~{' '}
                    {Math.max(...levels.map((l) => l.energy))} kJ/mol
                  </span>
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* Right pane - SVG Preview */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">プレビュー</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 bg-blue-600 rounded"></span>
                吸熱（上向き）
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 bg-red-600 rounded"></span>
                発熱（下向き）
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-4 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full h-full flex items-center justify-center overflow-hidden">
              {levels.length === 0 ? (
                <div className="text-center text-gray-400">
                  <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4-4 4 4 4-8 4 4" />
                  </svg>
                  <p className="text-sm">左のフォームで状態を追加してください</p>
                </div>
              ) : (
                <EnergyDiagram levels={levels} transitions={transitions} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
