import React, { useState } from 'react';
import type { Level, Transition } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  levels: Level[];
  transitions: Transition[];
  onAdd: (transition: Transition) => void;
  onUpdate: (transition: Transition) => void;
  onDelete: (id: string) => void;
}

const TransitionForm: React.FC<Props> = ({ levels, transitions, onAdd, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fromLevelId, setFromLevelId] = useState('');
  const [toLevelId, setToLevelId] = useState('');
  const [label, setLabel] = useState('');
  const [xOffset, setXOffset] = useState(0);

  const resetForm = () => {
    setEditingId(null);
    setFromLevelId('');
    setToLevelId('');
    setLabel('');
    setXOffset(0);
  };

  const handleEdit = (tr: Transition) => {
    setEditingId(tr.id);
    setFromLevelId(tr.fromLevelId);
    setToLevelId(tr.toLevelId);
    setLabel(tr.label);
    setXOffset(tr.xOffset);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLevelId || !toLevelId || fromLevelId === toLevelId) return;

    const data: Transition = {
      id: editingId || uuidv4(),
      fromLevelId,
      toLevelId,
      label: label.trim(),
      xOffset,
    };

    if (editingId) {
      onUpdate(data);
    } else {
      onAdd(data);
    }
    resetForm();
  };

  const getLevelName = (id: string) => levels.find((l) => l.id === id)?.name ?? '(不明)';

  const getArrowType = (tr: Transition) => {
    const from = levels.find((l) => l.id === tr.fromLevelId);
    const to = levels.find((l) => l.id === tr.toLevelId);
    if (!from || !to) return null;
    if (to.energy > from.energy) return { label: '↑ 吸熱', cls: 'text-blue-600' };
    if (to.energy < from.energy) return { label: '↓ 発熱', cls: 'text-red-600' };
    return null;
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">始点と終点を選択して矢印を追加してください</p>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1 ml-1">始点（From）</label>
            <select
              value={fromLevelId}
              onChange={(e) => setFromLevelId(e.target.value)}
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">選択...</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 ml-1">終点（To）</label>
            <select
              value={toLevelId}
              onChange={(e) => setToLevelId(e.target.value)}
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">選択...</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input
          type="text"
          placeholder="ラベル（例: 格子エネルギー）"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />

        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">X オフセット（矢印位置）</label>
            <span className="text-xs font-medium text-gray-700">{xOffset}px</span>
          </div>
          <input
            type="range"
            min={-200}
            max={300}
            value={xOffset}
            onChange={(e) => setXOffset(Number(e.target.value))}
            className="w-full accent-blue-600 h-5"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-3 text-base font-medium bg-blue-600 text-white rounded-xl active:bg-blue-700"
          >
            {editingId ? '更新' : '追加'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-3 text-base bg-gray-200 text-gray-700 rounded-xl active:bg-gray-300"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {transitions.map((tr) => {
          const arrowType = getArrowType(tr);
          return (
            <div
              key={tr.id}
              className="flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-xl"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {arrowType && (
                    <span className={`text-xs font-bold ${arrowType.cls}`}>
                      {arrowType.label}
                    </span>
                  )}
                  {tr.label && (
                    <span className="text-gray-800 text-sm font-medium truncate">{tr.label}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {getLevelName(tr.fromLevelId)} → {getLevelName(tr.toLevelId)}
                </p>
              </div>
              <div className="flex gap-2 ml-3 shrink-0">
                <button
                  onClick={() => handleEdit(tr)}
                  className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg active:bg-amber-200"
                >
                  編集
                </button>
                <button
                  onClick={() => onDelete(tr.id)}
                  className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg active:bg-red-200"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}
        {transitions.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">遷移がありません</p>
        )}
      </div>
    </div>
  );
};

export default TransitionForm;
