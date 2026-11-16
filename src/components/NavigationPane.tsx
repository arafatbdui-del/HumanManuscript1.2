/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Document Outline & Page Thumbnails Navigation Sidebar (MS Word-Style Left Pane)
 */

import React, { useState } from 'react';
import { DocumentSectionOutline } from '../services/outlineManager';
import { ComputedPageInfo } from '../services/paginationEngine';
import {
  FileText,
  Plus,
  X,
  EyeOff,
  BookOpen,
  Heading1,
  FileCode,
  CheckCircle2,
  Library,
  Target,
  PanelLeftClose,
  RotateCcw,
  Layers,
  LayoutGrid,
} from 'lucide-react';

interface NavigationPaneProps {
  sections: DocumentSectionOutline[];
  activeSectionId: string | null;
  totalWordCount: number;
  pages: ComputedPageInfo[];
  currentPage: number;
  onNavigateToSection: (sectionId: string) => void;
  onNavigateToPage: (pageNumber: number) => void;
  onAddSection: (title: string, wordTarget?: number) => void;
  onRemoveOrHideSection: (sectionId: string) => void;
  onRestoreSection: (sectionId: string) => void;
  onToggleCollapse?: () => void;
}

export const NavigationPane: React.FC<NavigationPaneProps> = ({
  sections,
  activeSectionId,
  totalWordCount,
  pages,
  currentPage,
  onNavigateToSection,
  onNavigateToPage,
  onAddSection,
  onRemoveOrHideSection,
  onRestoreSection,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'outline' | 'pages'>('outline');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionTarget, setNewSectionTarget] = useState('1500');
  const [showHiddenTray, setShowHiddenTray] = useState(false);

  const visibleSections = sections.filter(s => !s.isHidden);
  const hiddenSections = sections.filter(s => s.isHidden);

  const handleCreateSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    const target = parseInt(newSectionTarget, 10) || 1500;
    onAddSection(newSectionTitle.trim(), target);
    setNewSectionTitle('');
    setIsAddingSection(false);
  };

  const getSectionIcon = (type: DocumentSectionOutline['type']) => {
    switch (type) {
      case 'title':
        return <Heading1 className="w-3.5 h-3.5 text-blue-600" />;
      case 'metadata':
        return <FileText className="w-3.5 h-3.5 text-indigo-600" />;
      case 'abstract':
        return <FileCode className="w-3.5 h-3.5 text-amber-600" />;
      case 'intro':
        return <BookOpen className="w-3.5 h-3.5 text-emerald-600" />;
      case 'conclusion':
        return <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />;
      case 'bibliography':
        return <Library className="w-3.5 h-3.5 text-slate-600" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-teal-600" />;
    }
  };

  const presetSuggestions = [
    'Methodology',
    'Literature Review',
    'Doctrinal Analysis',
    'Comparative Analysis',
    'Discussion & Arguments',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none text-slate-800 text-xs w-full">
      {/* 1. Header with Live Total Words and Collapse Control */}
      <div className="p-3 border-b border-slate-200 bg-slate-100/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-700" />
          <div>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800 block leading-tight">
              Navigation
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              {totalWordCount.toLocaleString()} words · {Math.max(1, pages.length)} pages
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === 'outline' && (
            <button
              onClick={() => setIsAddingSection(true)}
              className="p-1 rounded text-slate-600 hover:text-blue-700 hover:bg-slate-200 transition"
              title="Add New Custom Section (+)"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
              title="Collapse Navigation Panel"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Outline | Pages Tab Bar */}
      <div className="px-2 pt-2 pb-1.5 border-b border-slate-200 bg-white flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('outline')}
          className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'outline'
              ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Outline</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pages')}
          className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'pages'
              ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Pages ({Math.max(1, pages.length)})</span>
        </button>
      </div>

      {/* 2. Body: Either Outline List OR Miniature Page Thumbnails */}
      {activeTab === 'outline' ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Sections &amp; Headings</span>
            <span className="font-normal text-[9px] text-slate-400">Click to navigate</span>
          </div>

          {visibleSections.map(sec => {
            const isActive = activeSectionId === sec.id;
            return (
              <div
                key={sec.id}
                onClick={() => onNavigateToSection(sec.id)}
                className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition border ${
                  isActive
                    ? 'bg-blue-100/80 text-blue-950 font-semibold border-blue-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="shrink-0 p-1 bg-slate-50 rounded border border-slate-200/60">
                    {getSectionIcon(sec.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-slate-900 group-hover:text-blue-900">
                        {sec.title}
                      </span>
                    </div>
                    {sec.subtitle && (
                      <span className="text-[10px] text-slate-400 block truncate">
                        {sec.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {sec.wordCount.toLocaleString()}w
                  </span>

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onRemoveOrHideSection(sec.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                    title={`Hide "${sec.title}" from outline`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {isAddingSection ? (
            <form
              onSubmit={handleCreateSectionSubmit}
              className="p-3 bg-white rounded-lg border border-blue-300 shadow-sm space-y-2 mt-2"
            >
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  Add New Section
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingSection(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                  Section Title
                </label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                  placeholder="e.g. Methodology, Literature Review..."
                  autoFocus
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                  Target Word Count Budget
                </label>
                <input
                  type="number"
                  value={newSectionTarget}
                  onChange={e => setNewSectionTarget(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <span className="text-[9px] text-slate-400 block mb-1">Quick Presets:</span>
                <div className="flex flex-wrap gap-1">
                  {presetSuggestions.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewSectionTitle(preset)}
                      className="text-[9px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200/80 transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5 pt-1">
                <button
                  type="submit"
                  disabled={!newSectionTitle.trim()}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-semibold text-xs transition"
                >
                  Add Section
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSection(false)}
                  className="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingSection(true)}
              className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-700 rounded-md flex items-center justify-center gap-1.5 transition text-xs font-medium bg-white/60 hover:bg-blue-50/50 mt-2"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Add Section</span>
            </button>
          )}

          {hiddenSections.length > 0 && (
            <div className="pt-3 border-t border-slate-200/80 mt-3">
              <button
                onClick={() => setShowHiddenTray(p => !p)}
                className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-slate-800 p-1 rounded"
              >
                <span className="flex items-center gap-1">
                  <EyeOff className="w-3 h-3 text-slate-400" />
                  Hidden from Outline ({hiddenSections.length})
                </span>
                <span className="font-semibold text-blue-600">
                  {showHiddenTray ? 'Hide' : 'Show'}
                </span>
              </button>

              {showHiddenTray && (
                <div className="mt-1 space-y-1">
                  {hiddenSections.map(h => (
                    <div
                      key={h.id}
                      className="p-1.5 bg-slate-100 rounded text-[11px] text-slate-600 flex items-center justify-between"
                    >
                      <span className="truncate">{h.title}</span>
                      <button
                        onClick={() => onRestoreSection(h.id)}
                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold px-1.5 py-0.5 bg-white rounded border border-slate-200 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* PAGE THUMBNAILS TAB */
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-200/60">
          {pages.map(pg => {
            const isActive = pg.pageNumber === currentPage;
            const isLandscape = pg.metrics.orientation === 'landscape';
            return (
              <button
                key={`thumb-${pg.pageNumber}`}
                type="button"
                onClick={() => onNavigateToPage(pg.pageNumber)}
                className={`w-full text-left flex flex-col items-center group transition ${
                  isActive ? '' : 'opacity-90 hover:opacity-100'
                }`}
              >
                <div
                  className={`bg-white border rounded-[2px] p-2.5 shadow-sm transition flex flex-col justify-between overflow-hidden ${
                    isLandscape ? 'w-44 h-28' : 'w-32 h-44'
                  } ${
                    isActive
                      ? 'ring-2 ring-blue-600 border-blue-600 shadow-md'
                      : 'border-slate-300 group-hover:border-blue-400'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-[7px] text-slate-400 border-b border-slate-100 pb-0.5 truncate">
                      {pg.setup.paperSize} · Sec {pg.sectionIndex + 1}
                    </div>
                    <div className="text-[8.5px] font-serif font-bold text-slate-800 line-clamp-2 leading-tight">
                      {pg.previewTitle}
                    </div>
                    <div className="text-[7px] font-serif text-slate-500 line-clamp-5 leading-snug">
                      {pg.previewExcerpt || 'Continuing text flow...'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[7px] text-slate-400 font-mono">
                    <span>
                      {pg.footnotes.length > 0 ? `${pg.footnotes.length} fn` : ''}
                    </span>
                    <span>{pg.formattedPageNumber}</span>
                  </div>
                </div>

                <span
                  className={`mt-1 text-[10px] font-mono px-2 py-0.5 rounded ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-600 group-hover:text-slate-900'
                  }`}
                >
                  Page {pg.pageNumber}
                  {pg.formattedPageNumber !== String(pg.pageNumber)
                    ? ` (${pg.formattedPageNumber})`
                    : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Target Progress Summary */}
      <div className="p-2.5 border-t border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 mb-1">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3 text-emerald-600" />
            Target Progress
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {totalWordCount} / 8,000w
          </span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.round((totalWordCount / 8000) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
