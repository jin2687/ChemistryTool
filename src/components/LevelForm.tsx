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
      <form onSubmit={handleSubmit} className="mb-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="状態名 (例: Na(s) + ½Cl₂)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="number"
            placeholder="エネルギー"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
            className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {editingId ? '更新' : '追加'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      <div className="space-y-1.5">
        {levels.map((level) => (
          <div
            key={level.id}
            className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-800 truncate block">{level.name}</span>
              <span className="text-gray-500 text-xs">{level.energy} kJ/mol</span>
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <button
                onClick={() => handleEdit(level)}
                className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
              >
                編集
              </button>
              <button
                onClick={() => onDelete(level.id)}
                className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              >
                削除
              </button>
            </div>
          </div>
        ))}
        {levels.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-3">状態がありません</p>
        )}
      </div>
    </div>
  );
};

export default LevelForm;
