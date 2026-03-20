import React, { useState, useRef, useCallback } from 'react';
import type { Level, Transition } from './types';
import { initialLevels, initialTransitions } from './mockData';
import LevelForm from './components/LevelForm';
import TransitionForm from './components/TransitionForm';
import EnergyDiagram from './components/EnergyDiagram';

type ActiveTab = 'levels' | 'transitions';

// Serialize SVG and produce a PNG data URL via canvas
async function svgToPngDataUrl(svgEl: SVGSVGElement, scale = 3): Promise<string> {
  const serializer = new XMLSerializer();
  // Clone so we can set explicit dimensions
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const W = 600;
  const H = 340;
  clone.setAttribute('width', String(W * scale));
  clone.setAttribute('height', String(H * scale));
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 2d unavailable')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')); };
    img.src = url;
  });
}

const App: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [transitions, setTransitions] = useState<Transition[]>(initialTransitions);
  const [activeTab, setActiveTab] = useState<ActiveTab>('levels');
  const [exportPng, setExportPng] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

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

  const handleExport = useCallback(async () => {
    if (!svgRef.current || levels.length === 0) return;
    setExporting(true);
    try {
      const dataUrl = await svgToPngDataUrl(svgRef.current, 3);
      setExportPng(dataUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }, [levels]);

  const handleDownload = () => {
    if (!exportPng) return;
    const a = document.createElement('a');
    a.href = exportPng;
    a.download = 'energy-diagram.png';
    a.click();
  };

  return (
    <div className="flex flex-col bg-gray-100" style={{ height: '100dvh' }}>
      {/* Header */}
      <header
        className="bg-white border-b border-gray-200 px-4 flex items-center gap-2 shrink-0"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          minHeight: 'calc(48px + env(safe-area-inset-top))',
        }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h1 className="text-base font-semibold text-gray-800 leading-tight flex-1">エネルギー準位図メーカー</h1>
      </header>

      {/* Top: Form area */}
      <div className="flex flex-col shrink-0" style={{ height: '52%' }}>
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

        <div className="flex-1 overflow-y-auto overscroll-contain">
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

      <div className="h-px bg-gray-300 shrink-0" />

      {/* Bottom: SVG Preview */}
      <div
        className="flex flex-col flex-1 bg-white overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Preview header with export button */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">プレビュー</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />吸熱
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />発熱
            </span>
          </div>
          <button
            onClick={handleExport}
            disabled={levels.length === 0 || exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg active:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none"
          >
            {exporting ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4 4m0 0l4-4m-4 4V4m6 12h4a2 2 0 002-2V6a2 2 0 00-2-2h-4" />
              </svg>
            )}
            出力
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {levels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
              <svg viewBox="0 0 24 24" className="w-10 h-10 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4-4 4 4 4-8 4 4" />
              </svg>
              <p className="text-sm">上のフォームで状態を追加</p>
            </div>
          ) : (
            <EnergyDiagram ref={svgRef} levels={levels} transitions={transitions} />
          )}
        </div>
      </div>

      {/* Export Modal */}
      {exportPng && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 shrink-0">
            <span className="text-white font-medium text-sm">出力画像</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg active:bg-blue-600"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                保存
              </button>
              <button
                onClick={() => setExportPng(null)}
                className="flex items-center justify-center w-8 h-8 text-gray-400 active:text-white"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Image display */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <img
              src={exportPng}
              alt="エネルギー準位図"
              className="w-full rounded-lg shadow-2xl"
              style={{ maxWidth: 600, background: 'white' }}
            />
          </div>

          <p className="text-center text-gray-500 text-xs pb-3 shrink-0">
            長押しで画像を保存できます
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
