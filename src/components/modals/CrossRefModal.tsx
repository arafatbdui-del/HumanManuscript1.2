/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Insert Cross-Reference Modal (Headings & Footnotes with live page numbers)
 */

import React, { useState } from 'react';
import { Footnote } from '../../types/manuscript';
import { PaginationResult } from '../../services/paginationEngine';
import { Link2, Plus } from 'lucide-react';

interface CrossRefModalProps {
  isOpen: boolean;
  onClose: () => void;
  pagination: PaginationResult | null;
  footnotes: Footnote[];
  onInsertCrossRef: (attrs: {
    targetId: string;
    refKind: 'section' | 'footnote';
    label: string;
    pageNumber: number;
    formattedPage: string;
  }) => void;
}

export const CrossRefModal: React.FC<CrossRefModalProps> = ({
  isOpen,
  onClose,
  pagination,
  footnotes,
  onInsertCrossRef,
}) => {
  const [refKind, setRefKind] = useState<'section' | 'footnote'>('section');

  if (!isOpen) return null;

  const headingItems = pagination
    ? Object.entries(pagination.headingPageMap).map(([id, info]) => ({
        id,
        ...info,
      }))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full p-5 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Insert Cross-Reference</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg mb-3 text-xs">
          <button
            type="button"
            onClick={() => setRefKind('section')}
            className={`flex-1 py-1.5 rounded font-semibold ${
              refKind === 'section' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Headings ({headingItems.length})
          </button>
          <button
            type="button"
            onClick={() => setRefKind('footnote')}
            className={`flex-1 py-1.5 rounded font-semibold ${
              refKind === 'footnote' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Footnotes ({footnotes.length})
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1.5 text-xs">
          {refKind === 'section' &&
            (headingItems.length > 0 ? (
              headingItems.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    onInsertCrossRef({
                      targetId: h.id,
                      refKind: 'section',
                      label: `above (${h.title.slice(0, 32)}${h.title.length > 32 ? '…' : ''})`,
                      pageNumber: h.pageNumber,
                      formattedPage: h.formattedPage,
                    });
                    onClose();
                  }}
                  className="w-full p-2.5 rounded border border-slate-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-between text-left transition"
                >
                  <span className="font-medium text-slate-800 truncate pr-2">{h.title}</span>
                  <span className="font-mono text-[11px] text-blue-700 font-semibold shrink-0 flex items-center gap-1">
                    p. {h.formattedPage}
                    <Plus className="w-3 h-3" />
                  </span>
                </button>
              ))
            ) : (
              <div className="py-6 text-center text-slate-400">
                No headings detected yet.
              </div>
            ))}

          {refKind === 'footnote' &&
            (footnotes.length > 0 ? (
              footnotes.map(fn => {
                const info = pagination?.footnotePageMap[fn.number];
                const dispNum = info?.displayNumber || fn.number;
                const pgStr = info?.formattedPage || '1';
                const pgNum = info?.pageNumber || 1;
                return (
                  <button
                    key={fn.id}
                    type="button"
                    onClick={() => {
                      onInsertCrossRef({
                        targetId: String(fn.number),
                        refKind: 'footnote',
                        label: `n ${dispNum}`,
                        pageNumber: pgNum,
                        formattedPage: pgStr,
                      });
                      onClose();
                    }}
                    className="w-full p-2.5 rounded border border-slate-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-between text-left transition"
                  >
                    <span className="text-slate-800 truncate pr-2">
                      <strong>n {dispNum}:</strong> {fn.content}
                    </span>
                    <span className="font-mono text-[11px] text-blue-700 font-semibold shrink-0 flex items-center gap-1">
                      p. {pgStr}
                      <Plus className="w-3 h-3" />
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-slate-400">No footnotes yet.</div>
            ))}
        </div>
      </div>
    </div>
  );
};
