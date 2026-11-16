/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Word-Style Bottom Status Bar (Page X of Y, View Modes, Ruler/Marks Toggles, Words Budget, Zoom Presets)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  FileText,
  AlignJustify,
  BookOpen,
  Maximize2,
  Ruler,
  Pilcrow,
} from 'lucide-react';
import { DocumentViewMode, ZoomMode } from '../types/manuscript';

interface StatusBarProps {
  currentPage: number;
  totalPages: number;
  formattedPageNumber?: string;
  onOpenGoTo: () => void;
  currentSectionWords: number;
  sectionTargetWords: number;
  totalManuscriptWords: number;
  originalityRedCount: number;
  originalityOrangeCount: number;
  trackChangesActive: boolean;
  viewMode: DocumentViewMode;
  onSetViewMode: (mode: DocumentViewMode) => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  showFormattingMarks: boolean;
  onToggleFormattingMarks: () => void;
  zoomLevel: number;
  zoomMode: ZoomMode;
  onZoomChange: (newZoom: number, mode?: ZoomMode) => void;
  lastBackupText: string;
}

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300];

export const StatusBar: React.FC<StatusBarProps> = ({
  currentPage,
  totalPages,
  formattedPageNumber,
  onOpenGoTo,
  currentSectionWords,
  sectionTargetWords,
  totalManuscriptWords,
  originalityRedCount,
  originalityOrangeCount,
  trackChangesActive,
  viewMode,
  onSetViewMode,
  showRuler,
  onToggleRuler,
  showFormattingMarks,
  onToggleFormattingMarks,
  zoomLevel,
  zoomMode,
  onZoomChange,
  lastBackupText,
}) => {
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setZoomMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <footer className="h-7 bg-slate-100 border-t border-slate-200 px-3 flex items-center justify-between text-[11px] text-slate-600 select-none no-print relative z-30">
      {/* Left: Page Indicator + Word Metrics + Locale */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenGoTo}
          className="px-1.5 py-0.5 rounded hover:bg-slate-200 text-slate-800 font-medium transition flex items-center gap-1"
          title="Go To Page / Section / Footnote (Ctrl+G)"
        >
          <span>
            Page <strong>{currentPage}</strong> of <strong>{Math.max(1, totalPages)}</strong>
          </span>
          {formattedPageNumber && formattedPageNumber !== String(currentPage) && (
            <span className="text-[10px] font-mono text-blue-700">({formattedPageNumber})</span>
          )}
        </button>

        <span className="text-slate-300">|</span>

        <span title="Section word count against contract target" className="hidden sm:inline">
          Section: <strong className="text-slate-800">{currentSectionWords}</strong> /{' '}
          {sectionTargetWords} wds
        </span>
        <span className="text-slate-300 hidden sm:inline">|</span>
        <span title="Total manuscript word count">
          <strong className="text-slate-800">{totalManuscriptWords.toLocaleString()}</strong> words
        </span>
        <span className="text-slate-300 hidden md:inline">|</span>
        <span className="text-emerald-800 font-medium hidden md:inline">English (UK) en-GB</span>
      </div>

      {/* Center: Originality & Status */}
      <div className="hidden lg:flex items-center gap-3">
        <span className="flex items-center gap-1.5" title="Live originality flags">
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
            {originalityRedCount} verbatim
          </span>
          <span className="text-slate-300">,</span>
          <span className="flex items-center gap-1 text-amber-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {originalityOrangeCount} paraphrase
          </span>
        </span>

        <span className="text-slate-300">|</span>

        <span
          className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
            trackChangesActive ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-400'
          }`}
        >
          Track Changes: {trackChangesActive ? 'ON' : 'OFF'}
        </span>

        <span className="text-slate-300">|</span>

        <span className="text-slate-500">{lastBackupText}</span>
      </div>

      {/* Right: Quick View Toggles + Ruler/Marks + Zoom Controls (25%-500% + Fit Modes) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
          <button
            type="button"
            onClick={onToggleRuler}
            className={`p-1 rounded transition ${
              showRuler ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-500'
            }`}
            title="Show / Hide Ruler"
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleFormattingMarks}
            className={`p-1 rounded transition ${
              showFormattingMarks
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-slate-200 text-slate-500'
            }`}
            title="Show / Hide Formatting Marks (¶)"
          >
            <Pilcrow className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
          <button
            type="button"
            onClick={() => onSetViewMode('pages')}
            className={`p-1 rounded transition ${
              viewMode === 'pages' ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-500'
            }`}
            title="Print Layout"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('draft')}
            className={`p-1 rounded transition ${
              viewMode === 'draft' ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-500'
            }`}
            title="Draft View"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('read')}
            className={`p-1 rounded transition ${
              viewMode === 'read' ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-500'
            }`}
            title="Read Mode"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('focus')}
            className={`p-1 rounded transition ${
              viewMode === 'focus' ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-500'
            }`}
            title="Focus Mode"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Slider & Popover */}
        <div className="flex items-center gap-1.5 relative" ref={zoomMenuRef}>
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(25, zoomLevel - 10), 'custom')}
            className="hover:text-slate-900 p-0.5 rounded hover:bg-slate-200 transition"
            title="Zoom out (Ctrl+-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="25"
            max="500"
            step="5"
            value={zoomLevel}
            onChange={e => onZoomChange(parseInt(e.target.value, 10), 'custom')}
            className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
            title="Zoom scale (25% – 500%)"
          />

          <button
            type="button"
            onClick={() => onZoomChange(Math.min(500, zoomLevel + 10), 'custom')}
            className="hover:text-slate-900 p-0.5 rounded hover:bg-slate-200 transition"
            title="Zoom in (Ctrl+=)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomMenuOpen(p => !p)}
            className="px-1.5 py-0.5 rounded hover:bg-slate-200 font-mono text-[10.5px] font-semibold text-slate-800 min-w-[44px] text-right"
            title="Zoom presets & page fit modes"
          >
            {zoomLevel}%
          </button>

          {zoomMenuOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs text-slate-800">
              <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400">
                Page Fit Modes
              </div>
              {[
                { id: 'fit-width' as ZoomMode, label: 'Fit Width' },
                { id: 'whole-page' as ZoomMode, label: 'Whole Page' },
                { id: 'two-pages' as ZoomMode, label: 'Two Pages Scale' },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onZoomChange(zoomLevel, m.id);
                    setZoomMenuOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between ${
                    zoomMode === m.id ? 'font-bold text-blue-700 bg-blue-50/50' : ''
                  }`}
                >
                  <span>{m.label}</span>
                </button>
              ))}

              <div className="border-t border-slate-100 my-1" />
              <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400">
                Percentages
              </div>
              <div className="grid grid-cols-3 gap-1 px-2 pb-1">
                {ZOOM_PRESETS.map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      onZoomChange(pct, 'custom');
                      setZoomMenuOpen(false);
                    }}
                    className={`py-1 rounded text-center font-mono text-[10.5px] border ${
                      zoomMode === 'custom' && zoomLevel === pct
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
