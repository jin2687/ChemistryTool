import React, { useState } from 'react';
import type { Level } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  levels: Level[];
  onAdd: (level: Level) => void;
  onUpdate: (level: Level) => void;
  onDelete: (id: string) => void;
}

const LevelForm: React.FC<Props> = ({ levels, onAdd, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [energy, setEnergy] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEnergy('');
  };

  const handleEdit = (level: Level) => {
    setEditingId(level.id);
    setName(level.name);
    setEnergy(String(level.energy));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const energyNum = parseFloat(energy);
    if (!name.trim() || isNaN(energyNum)) return;

    if (editingId) {
      onUpdate({ id: editingId, name: name.trim(), energy: energyNum });
    } else {
      onAdd({ id: uuidv4(), name: name.trim(), energy: energyNum });
    }
    resetForm();
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">状態名とエネルギー値（kJ/mol）を入力してください</p>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="状態名（例: Na(s) + ½Cl₂(g)）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <input
          type="number"
          inputMode="decimal"
          placeholder="エネルギー (kJ/mol)"
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          className="w-full px-3 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
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
        {levels.map((level) => (
          <div
            key={level.id}
            className="flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-xl"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">{level.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{level.energy} kJ/mol</p>
            </div>
            <div className="flex gap-2 ml-3 shrink-0">
              <button
                onClick={() => handleEdit(level)}
                className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg active:bg-amber-200"
              >
                編集
              </button>
              <button
                onClick={() => onDelete(level.id)}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg active:bg-red-200"
              >
                削除
              </button>
            </div>
          </div>
        ))}
        {levels.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">状態がありません</p>
        )}
      </div>
    </div>
  );
};

export default LevelForm;
