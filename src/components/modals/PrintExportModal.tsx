/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Print / PDF Export Dialog with Page Range, Scale, Paper Size CSS & Word Pagination Notice
 */

import React, { useState } from 'react';
import { PageSetupConfig } from '../../types/manuscript';
import { PAPER_SIZES } from '../../services/pageLayout';
import { Printer, Info, Download } from 'lucide-react';

interface PrintExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPages: number;
  currentPage: number;
  pageSetup: PageSetupConfig;
  onBeforePrintUpdateFields: () => void;
  onExportDocx: () => void;
}

function parsePageRange(spec: string, totalPages: number): Set<number> {
  const result = new Set<number>();
  const parts = spec.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [aStr, bStr] = part.split('-');
      const a = Math.max(1, parseInt(aStr, 10) || 1);
      const b = Math.min(totalPages, parseInt(bStr, 10) || totalPages);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        result.add(i);
      }
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
        result.add(n);
      }
    }
  }
  return result;
}

export const PrintExportModal: React.FC<PrintExportModalProps> = ({
  isOpen,
  onClose,
  totalPages,
  currentPage,
  pageSetup,
  onBeforePrintUpdateFields,
  onExportDocx,
}) => {
  const [rangeMode, setRangeMode] = useState<'all' | 'current' | 'custom'>('all');
  const [customRange, setCustomRange] = useState(`1-${Math.max(1, totalPages)}`);
  const [scalePercent, setScalePercent] = useState<number>(100);

  if (!isOpen) return null;

  const handlePrintPdf = () => {
    // Auto-update TOC & Cross-Reference fields before printing
    onBeforePrintUpdateFields();

    const spec = PAPER_SIZES[pageSetup.paperSize] || PAPER_SIZES.A4;
    const isLandscape = pageSetup.orientation === 'landscape';
    const wMm = isLandscape ? spec.heightMm : spec.widthMm;
    const hMm = isLandscape ? spec.widthMm : spec.heightMm;

    let allowedPages: Set<number> | null = null;
    if (rangeMode === 'current') {
      allowedPages = new Set([currentPage]);
    } else if (rangeMode === 'custom') {
      allowedPages = parsePageRange(customRange, Math.max(1, totalPages));
    }

    const hiddenPageRules =
      allowedPages && allowedPages.size > 0
        ? Array.from({ length: Math.max(1, totalPages) }, (_, idx) => idx + 1)
            .filter(p => !allowedPages!.has(p))
            .map(p => `[data-print-page="${p}"] { display: none !important; }`)
            .join('\n')
        : '';

    const styleEl = document.createElement('style');
    styleEl.id = 'hm-dynamic-print-style';
    styleEl.textContent = `
      @page {
        size: ${wMm}mm ${hMm}mm;
        margin: 0;
      }
      @media print {
        .hm-print-stage-reset {
          zoom: ${scalePercent / 100} !important;
        }
        ${hiddenPageRules}
      }
    `;
    document.head.appendChild(styleEl);

    const cleanup = () => {
      styleEl.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    onClose();
    setTimeout(() => {
      window.print();
    }, 120);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full p-6 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900">Print &amp; PDF Export</h3>
              <p className="text-xs text-slate-500">
                {PAPER_SIZES[pageSetup.paperSize].label} · {pageSetup.orientation} · {totalPages} pages
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Page Range */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Page Range</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printRange"
                  checked={rangeMode === 'all'}
                  onChange={() => setRangeMode('all')}
                  className="accent-blue-600"
                />
                <span>All pages (1 – {totalPages})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printRange"
                  checked={rangeMode === 'current'}
                  onChange={() => setRangeMode('current')}
                  className="accent-blue-600"
                />
                <span>Current page only (Page {currentPage})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printRange"
                  checked={rangeMode === 'custom'}
                  onChange={() => setRangeMode('custom')}
                  className="accent-blue-600"
                />
                <span>Custom range:</span>
                <input
                  type="text"
                  disabled={rangeMode !== 'custom'}
                  value={customRange}
                  onChange={e => setCustomRange(e.target.value)}
                  placeholder="e.g. 1-3, 5"
                  className="flex-1 border border-slate-300 rounded px-2 py-1 font-mono disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          {/* Print Scale */}
          <div>
            <label className="font-bold text-slate-700 flex items-center justify-between mb-1">
              <span>Print Scale</span>
              <span className="font-mono text-blue-700">{scalePercent}%</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={50}
                max={150}
                step={5}
                value={scalePercent}
                onChange={e => setScalePercent(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-600"
              />
              <button
                type="button"
                onClick={() => setScalePercent(100)}
                className="px-2 py-1 border border-slate-300 rounded text-[11px] hover:bg-slate-100"
              >
                100%
              </button>
            </div>
          </div>

          {/* Honest Word Pagination Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Pagination Notice:</strong> Page count is approximate; Word may paginate slightly differently due to platform font hinting and printer metrics.
            </div>
          </div>
        </div>

        <div className="pt-4 mt-5 border-t border-slate-200 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              onBeforePrintUpdateFields();
              onExportDocx();
              onClose();
            }}
            className="px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 rounded font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .docx instead</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
