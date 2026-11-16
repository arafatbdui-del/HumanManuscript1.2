/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * MS Word Page Setup Modal (Paper Size, Orientation, Margins, Gutter, Columns, Line Numbers, Headers/Footers)
 */

import React, { useState, useEffect } from 'react';
import {
  JournalProfile,
  MarginPresetId,
  MeasurementUnit,
  PageNumberFormat,
  PageSetupConfig,
  PaperSizeId,
} from '../../types/manuscript';
import {
  MARGIN_PRESETS,
  PAPER_SIZES,
  cmToIn,
  inToCm,
  mergePageSetup,
} from '../../services/pageLayout';
import { Sliders, Check, BookOpen, Columns, Hash } from 'lucide-react';

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSetup: PageSetupConfig;
  currentSectionKey: string;
  sectionKeys: string[];
  unit: MeasurementUnit;
  onChangeUnit: (u: MeasurementUnit) => void;
  journalProfile: JournalProfile;
  useJournalOverride: boolean;
  onToggleJournalOverride: (enabled: boolean) => void;
  onApplySetup: (setup: PageSetupConfig, scope: 'document' | 'section', targetSectionKey: string) => void;
}

export const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  currentSetup,
  currentSectionKey,
  sectionKeys,
  unit,
  onChangeUnit,
  journalProfile,
  useJournalOverride,
  onToggleJournalOverride,
  onApplySetup,
}) => {
  const [tab, setTab] = useState<'margins' | 'paper' | 'headers'>('margins');
  const [draft, setDraft] = useState<PageSetupConfig>(currentSetup);
  const [scope, setScope] = useState<'document' | 'section'>('document');

  useEffect(() => {
    if (isOpen) {
      setDraft(mergePageSetup(currentSetup));
    }
  }, [isOpen, currentSetup]);

  if (!isOpen) return null;

  const toDisplay = (cm: number) => (unit === 'in' ? cmToIn(cm).toFixed(2) : cm.toFixed(2));
  const fromInput = (raw: string): number => {
    const val = parseFloat(raw);
    if (Number.isNaN(val) || val < 0) return 0;
    const cm = unit === 'in' ? inToCm(val) : val;
    return Math.min(10, Math.max(0.4, Number(cm.toFixed(2))));
  };

  const applyPreset = (presetId: Exclude<MarginPresetId, 'custom'>) => {
    const preset = MARGIN_PRESETS[presetId];
    setDraft(prev => ({
      ...prev,
      marginPreset: presetId,
      marginsCm: { ...preset.marginsCm, gutter: prev.marginsCm.gutter },
    }));
  };

  const updateMarginField = (field: 'top' | 'bottom' | 'left' | 'right' | 'gutter', raw: string) => {
    const numCm = field === 'gutter' ? Math.max(0, Math.min(5, unit === 'in' ? inToCm(parseFloat(raw) || 0) : parseFloat(raw) || 0)) : fromInput(raw);
    setDraft(prev => ({
      ...prev,
      marginPreset: field === 'gutter' ? prev.marginPreset : 'custom',
      marginsCm: {
        ...prev.marginsCm,
        [field]: Number(numCm.toFixed(2)),
      },
    }));
  };

  const handleSave = () => {
    onApplySetup(draft, scope, currentSectionKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900">Page Setup</h3>
              <p className="text-xs text-slate-500">
                Configure paper geometry, margins, columns, numbering, and headers/footers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded border border-slate-300 overflow-hidden text-[11px] bg-white">
              <button
                type="button"
                onClick={() => onChangeUnit('cm')}
                className={`px-2 py-1 font-semibold ${
                  unit === 'cm' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                cm
              </button>
              <button
                type="button"
                onClick={() => onChangeUnit('in')}
                className={`px-2 py-1 font-semibold ${
                  unit === 'in' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                in
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 px-1.5">
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex gap-4 text-xs font-semibold bg-white">
          <button
            type="button"
            onClick={() => setTab('margins')}
            className={`pb-2.5 border-b-2 transition ${
              tab === 'margins'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Margins &amp; Orientation
          </button>
          <button
            type="button"
            onClick={() => setTab('paper')}
            className={`pb-2.5 border-b-2 transition ${
              tab === 'paper'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Paper, Columns &amp; Line Numbers
          </button>
          <button
            type="button"
            onClick={() => setTab('headers')}
            className={`pb-2.5 border-b-2 transition ${
              tab === 'headers'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Headers, Footers &amp; Numbering
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5 text-xs">
          {tab === 'margins' && (
            <>
              {/* Presets */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">Margin Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(MARGIN_PRESETS) as Exclude<MarginPresetId, 'custom'>[]).map(id => {
                    const p = MARGIN_PRESETS[id];
                    const active = draft.marginPreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyPreset(id)}
                        className={`p-2.5 text-left rounded-lg border transition ${
                          active
                            ? 'bg-blue-50 border-blue-500 text-blue-950 ring-1 ring-blue-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold">{p.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{p.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Margin Inputs */}
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Top ({unit})</label>
                  <input
                    type="number"
                    step="0.05"
                    defaultValue={toDisplay(draft.marginsCm.top)}
                    key={`top-${draft.marginsCm.top}-${unit}`}
                    onBlur={e => updateMarginField('top', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Bottom ({unit})</label>
                  <input
                    type="number"
                    step="0.05"
                    defaultValue={toDisplay(draft.marginsCm.bottom)}
                    key={`bottom-${draft.marginsCm.bottom}-${unit}`}
                    onBlur={e => updateMarginField('bottom', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    {draft.marginPreset === 'mirrored' ? `Inside (${unit})` : `Left (${unit})`}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    defaultValue={toDisplay(draft.marginsCm.left)}
                    key={`left-${draft.marginsCm.left}-${unit}`}
                    onBlur={e => updateMarginField('left', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    {draft.marginPreset === 'mirrored' ? `Outside (${unit})` : `Right (${unit})`}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    defaultValue={toDisplay(draft.marginsCm.right)}
                    key={`right-${draft.marginsCm.right}-${unit}`}
                    onBlur={e => updateMarginField('right', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Gutter ({unit})</label>
                  <input
                    type="number"
                    step="0.05"
                    defaultValue={toDisplay(draft.marginsCm.gutter)}
                    key={`gutter-${draft.marginsCm.gutter}-${unit}`}
                    onBlur={e => updateMarginField('gutter', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">Orientation</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['portrait', 'landscape'] as const).map(orient => (
                    <button
                      key={orient}
                      type="button"
                      onClick={() => setDraft(p => ({ ...p, orientation: orient }))}
                      className={`p-3 rounded-lg border flex items-center gap-3 transition ${
                        draft.orientation === orient
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-semibold'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`border-2 border-slate-400 bg-white ${
                          orient === 'portrait' ? 'w-5 h-7' : 'w-7 h-5'
                        }`}
                      />
                      <span className="capitalize">{orient}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'paper' && (
            <>
              <div>
                <label className="font-bold text-slate-700 block mb-2">Paper Size</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(PAPER_SIZES) as PaperSizeId[]).map(sz => {
                    const spec = PAPER_SIZES[sz];
                    const active = draft.paperSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setDraft(p => ({ ...p, paperSize: sz }))}
                        className={`p-2.5 text-left rounded-lg border transition ${
                          active
                            ? 'bg-blue-50 border-blue-500 text-blue-950 font-semibold'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>{spec.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {spec.widthPx} × {spec.heightPx} px (96 dpi)
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Columns */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Columns className="w-4 h-4 text-blue-600" />
                    <span>Columns</span>
                  </label>
                  <div className="flex gap-2">
                    {([1, 2] as const).map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setDraft(p => ({ ...p, columns: col }))}
                        className={`flex-1 py-2 px-3 rounded border font-semibold transition ${
                          draft.columns === col
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {col === 1 ? 'One Column' : 'Two Columns'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Hash className="w-4 h-4 text-indigo-600" />
                    <span>Line Numbers</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.lineNumbers}
                      onChange={e => setDraft(p => ({ ...p, lineNumbers: e.target.checked }))}
                      className="accent-blue-600"
                    />
                    <span>Show line numbers (restarting on each page)</span>
                  </label>
                </div>
              </div>

              {/* Journal Profile Layout Override */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <BookOpen className="w-4 h-4 text-indigo-700 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-indigo-950">
                      Journal Profile Layout Override ({journalProfile.name})
                    </div>
                    <div className="text-[11px] text-indigo-800/80">
                      Allows target journal submission profile to override paper size &amp; margin standards.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useJournalOverride}
                  onChange={e => onToggleJournalOverride(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4"
                />
              </div>
            </>
          )}

          {tab === 'headers' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Number Format</label>
                  <select
                    value={draft.headerFooter.numberFormat}
                    onChange={e =>
                      setDraft(p => ({
                        ...p,
                        headerFooter: {
                          ...p.headerFooter,
                          numberFormat: e.target.value as PageNumberFormat,
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                  >
                    <option value="1">1, 2, 3 (Arabic)</option>
                    <option value="i">i, ii, iii (Lower Roman)</option>
                    <option value="I">I, II, III (Upper Roman)</option>
                    <option value="a">a, b, c (Letters)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Start At</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.headerFooter.startAt}
                    onChange={e =>
                      setDraft(p => ({
                        ...p,
                        headerFooter: {
                          ...p.headerFooter,
                          startAt: Math.max(1, parseInt(e.target.value, 10) || 1),
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div className="flex flex-col justify-end gap-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.headerFooter.differentFirstPage}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: { ...p.headerFooter, differentFirstPage: e.target.checked },
                        }))
                      }
                      className="accent-blue-600"
                    />
                    <span>Different first page</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.headerFooter.differentOddEven}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: { ...p.headerFooter, differentOddEven: e.target.checked },
                        }))
                      }
                      className="accent-blue-600"
                    />
                    <span>Different odd &amp; even</span>
                  </label>
                </div>
              </div>

              {scope === 'section' && (
                <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.headerFooter.restartNumbering}
                    onChange={e =>
                      setDraft(p => ({
                        ...p,
                        headerFooter: { ...p.headerFooter, restartNumbering: e.target.checked },
                      }))
                    }
                    className="accent-blue-600"
                  />
                  <span>Restart page numbering in this section</span>
                </label>
              )}

              <div className="text-[11px] bg-slate-50 border border-slate-200 rounded p-2 text-slate-600">
                Available field tokens:{' '}
                <code className="font-mono text-blue-700">{'{page}'}</code>,{' '}
                <code className="font-mono text-blue-700">{'{pages}'}</code>,{' '}
                <code className="font-mono text-blue-700">{'{title}'}</code>,{' '}
                <code className="font-mono text-blue-700">{'{author}'}</code>,{' '}
                <code className="font-mono text-blue-700">{'{date}'}</code>.
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  Tip: You can also double-click any page header or footer directly on the page to edit inline.
                </span>
              </div>

              {/* Default Header & Footer slots */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Header (Left / Centre / Right)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={draft.headerFooter.defaultHeader.left}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: {
                            ...p.headerFooter,
                            defaultHeader: { ...p.headerFooter.defaultHeader, left: e.target.value },
                          },
                        }))
                      }
                      placeholder="Left"
                      className="border border-slate-300 rounded px-2 py-1"
                    />
                    <input
                      value={draft.headerFooter.defaultHeader.center}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: {
                            ...p.headerFooter,
                            defaultHeader: { ...p.headerFooter.defaultHeader, center: e.target.value },
                          },
                        }))
                      }
                      placeholder="Centre"
                      className="border border-slate-300 rounded px-2 py-1 text-center"
                    />
                    <input
                      value={draft.headerFooter.defaultHeader.right}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: {
                            ...p.headerFooter,
                            defaultHeader: { ...p.headerFooter.defaultHeader, right: e.target.value },
                          },
                        }))
                      }
                      placeholder="Right"
                      className="border border-slate-300 rounded px-2 py-1 text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Footer (Left / Centre / Right)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={draft.headerFooter.defaultFooter.left}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: {
                            ...p.headerFooter,
                            defaultFooter: { ...p.headerFooter.defaultFooter, left: e.target.value },
                          },
                        }))
                      }
                      placeholder="Left"
                      className="border border-slate-300 rounded px-2 py-1"
                    />
                    <input
                      value={draft.headerFooter.defaultFooter.center}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: {
                            ...p.headerFooter,
                            defaultFooter: { ...p.headerFooter.defaultFooter, center: e.target.value },
                          },
                        }))
                      }
                      placeholder="Centre"
                      className="border border-slate-300 rounded px-2 py-1 text-center"
                    />
                    <input
                      value={draft.headerFooter.defaultFooter.right}
                      onChange={e =>
                        setDraft(p => ({
                          ...p,
                          headerFooter: {
                            ...p.headerFooter,
                            defaultFooter: { ...p.headerFooter.defaultFooter, right: e.target.value },
                          },
                        }))
                      }
                      placeholder="Right"
                      className="border border-slate-300 rounded px-2 py-1 text-right"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Apply to:</span>
            <select
              value={scope}
              onChange={e => setScope(e.target.value as 'document' | 'section')}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 font-medium"
            >
              <option value="document">Whole document</option>
              <option value="section">
                This section ({currentSectionKey === 'default' ? 'Section 1' : currentSectionKey})
              </option>
            </select>
            {sectionKeys.length > 1 && scope === 'section' && (
              <span className="text-[10px] text-slate-400">({sectionKeys.length} sections detected)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Page Setup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
