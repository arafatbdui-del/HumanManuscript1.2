/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Go To Page / Section / Footnote Modal (Ctrl+G)
 */

import React, { useState, useEffect } from 'react';
import { Footnote } from '../../types/manuscript';
import { ComputedPageInfo } from '../../services/paginationEngine';
import { Navigation, FileText, Bookmark, ArrowRight } from 'lucide-react';

interface GoToModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: ComputedPageInfo[];
  currentPage: number;
  footnotes: Footnote[];
  footnotePageMap: Record<number, { pageNumber: number; formattedPage: string; displayNumber: number }>;
  sections: { id: string; title: string }[];
  onGoToPage: (pageNumber: number) => void;
  onGoToSection: (sectionId: string) => void;
  onGoToFootnote: (fn: Footnote, pageNumber?: number) => void;
}

export const GoToModal: React.FC<GoToModalProps> = ({
  isOpen,
  onClose,
  pages,
  currentPage,
  footnotes,
  footnotePageMap,
  sections,
  onGoToPage,
  onGoToSection,
  onGoToFootnote,
}) => {
  const [targetType, setTargetType] = useState<'page' | 'section' | 'footnote'>('page');
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id || '');
  const [selectedFnNumber, setSelectedFnNumber] = useState(footnotes[0]?.number || 1);

  useEffect(() => {
    if (isOpen) {
      setPageInput(String(currentPage));
      if (sections[0]) setSelectedSectionId(sections[0].id);
      if (footnotes[0]) setSelectedFnNumber(footnotes[0].number);
    }
  }, [isOpen, currentPage, sections, footnotes]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, pages.length);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === 'page') {
      const n = Math.max(1, Math.min(totalPages, parseInt(pageInput, 10) || 1));
      onGoToPage(n);
      onClose();
    } else if (targetType === 'section') {
      if (selectedSectionId) onGoToSection(selectedSectionId);
      onClose();
    } else if (targetType === 'footnote') {
      const fn = footnotes.find(f => f.number === selectedFnNumber);
      const pg = footnotePageMap[selectedFnNumber]?.pageNumber;
      if (fn) onGoToFootnote(fn, pg);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full p-5 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Go To (Ctrl+G)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setTargetType('page')}
              className={`py-1.5 rounded font-semibold flex items-center justify-center gap-1 transition ${
                targetType === 'page' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Page</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetType('section')}
              className={`py-1.5 rounded font-semibold flex items-center justify-center gap-1 transition ${
                targetType === 'section' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Section</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetType('footnote')}
              className={`py-1.5 rounded font-semibold flex items-center justify-center gap-1 transition ${
                targetType === 'footnote' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Footnote</span>
            </button>
          </div>

          {targetType === 'page' && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Enter page number (1 – {totalPages})
              </label>
              <input
                type="number"
                min={1}
                max={totalPages}
                autoFocus
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {targetType === 'section' && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Section</label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'footnote' && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Footnote</label>
              <select
                value={selectedFnNumber}
                onChange={e => setSelectedFnNumber(Number(e.target.value))}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white"
              >
                {footnotes.map(fn => {
                  const info = footnotePageMap[fn.number];
                  return (
                    <option key={fn.id} value={fn.number}>
                      [{info?.displayNumber || fn.number}] {fn.content.slice(0, 50)}
                      {info ? ` (p. ${info.formattedPage})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1"
            >
              <span>Go To</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
