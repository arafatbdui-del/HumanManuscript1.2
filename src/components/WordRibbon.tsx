/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modern Microsoft Word-Style Dropdown Menu & Compact Formatting Ribbon
 * Extended with Layout Menu (Page Setup, Margins, Orientation, Columns, Breaks, Line Numbers, Paragraph Flow)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  FileText,
  Bookmark,
  BookOpen,
  ShieldCheck,
  CheckCircle,
  Search,
  PlusCircle,
  Download,
  Upload,
  Printer,
  History,
  FileCheck,
  Scale,
  Split,
  MessageSquare,
  Feather,
  BookMarked,
  Sliders,
  ChevronDown,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Lock,
  Minus,
  Settings,
  Maximize,
  Minimize,
  Columns,
  Hash,
  RefreshCw,
  Link2,
  Table,
  Pilcrow,
  Ruler,
  Navigation,
  Scissors,
  Table2,
  BarChart3,
} from 'lucide-react';
import { FontFamilyDropdown } from './editor/FontFamilyDropdown';
import {
  DocumentViewMode,
  MarginPresetId,
  PageOrientation,
  PageSetupConfig,
  PaperSizeId,
} from '../types/manuscript';
import { MARGIN_PRESETS, PAPER_SIZES } from '../services/pageLayout';

interface WordRibbonProps {
  editor: Editor | null;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
  fontFamily: string;
  onChangeFontFamily: (font: string) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  isRightSidebarOpen: boolean;
  onToggleRightSidebar: () => void;
  onOpenUploadModal: () => void;
  onOpenImportReferences: () => void;
  onInsertFootnote: () => void;
  onOpenAddSource: () => void;
  onToggleTrackChanges: () => void;
  trackChangesActive: boolean;
  onOpenSection: (tab: 'library' | 'workbench' | 'review' | 'guard' | 'language' | 'ai') => void;
  onRunCitationAudit: () => void;
  onRunOriginalityScan: () => void;
  onOpenPreSubmissionChecklist: () => void;
  onExportWord: () => void;
  onOpenPrintModal: () => void;
  onExportResponseLetter: () => void;
  onExportAIStatement: () => void;
  onOpenSettings: () => void;
  viewMode: DocumentViewMode;
  onSetViewMode: (mode: DocumentViewMode) => void;
  onOpenCommandSearch: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Multi-page Layout & Fields actions
  pageSetup: PageSetupConfig;
  onQuickPaperSize: (size: PaperSizeId) => void;
  onQuickOrientation: (orientation: PageOrientation) => void;
  onQuickMarginPreset: (preset: Exclude<MarginPresetId, 'custom'>) => void;
  onQuickColumns: (columns: 1 | 2) => void;
  onToggleLineNumbers: () => void;
  onOpenPageSetupModal: () => void;
  onInsertPageBreak: () => void;
  onInsertSectionBreak: (type: 'next-page' | 'continuous') => void;
  onInsertToc: () => void;
  onOpenCrossRefModal: () => void;
  onUpdateFields: () => void;
  onEditHeaderFooter: (zone: 'header' | 'footer') => void;
  onToggleParagraphFlow: (attr: 'pageBreakBefore' | 'keepWithNext' | 'keepLinesTogether' | 'widowOrphanControl') => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  showFormattingMarks: boolean;
  onToggleFormattingMarks: () => void;
  onOpenGoTo: () => void;
  onInsertTable: () => void;
  onOpenChartModal: () => void;
}

export const WordRibbon: React.FC<WordRibbonProps> = ({
  editor,
  fontSize,
  onChangeFontSize,
  fontFamily,
  onChangeFontFamily,
  isLeftSidebarOpen,
  onToggleLeftSidebar,
  isRightSidebarOpen,
  onToggleRightSidebar,
  onOpenUploadModal,
  onOpenImportReferences,
  onInsertFootnote,
  onOpenAddSource,
  onToggleTrackChanges,
  trackChangesActive,
  onOpenSection,
  onRunCitationAudit,
  onRunOriginalityScan,
  onOpenPreSubmissionChecklist,
  onExportWord,
  onOpenPrintModal,
  onExportResponseLetter,
  onExportAIStatement,
  onOpenSettings,
  viewMode,
  onSetViewMode,
  onOpenCommandSearch,
  isFullscreen = false,
  onToggleFullscreen,
  pageSetup,
  onQuickPaperSize,
  onQuickOrientation,
  onQuickMarginPreset,
  onQuickColumns,
  onToggleLineNumbers,
  onOpenPageSetupModal,
  onInsertPageBreak,
  onInsertSectionBreak,
  onInsertToc,
  onOpenCrossRefModal,
  onUpdateFields,
  onEditHeaderFooter,
  onToggleParagraphFlow,
  showRuler,
  onToggleRuler,
  showFormattingMarks,
  onToggleFormattingMarks,
  onOpenGoTo,
  onInsertTable,
  onOpenChartModal,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  const handleAction = (cb: () => void) => {
    cb();
    setOpenDropdown(null);
  };

  const currentHeading = editor?.isActive('heading', { level: 1 })
    ? 'h1'
    : editor?.isActive('heading', { level: 2 })
    ? 'h2'
    : editor?.isActive('heading', { level: 3 })
    ? 'h3'
    : 'p';

  const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!editor) return;
    const val = e.target.value;
    if (val === 'p') editor.chain().focus().setParagraph().run();
    else if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  return (
    <header className="bg-slate-50 border-b border-slate-300 select-none shadow-2xs no-print relative z-40">
      {/* 1. Word Menu Bar */}
      <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-slate-200/80 bg-slate-100/70 text-xs">
        <div className="flex items-center space-x-0.5 flex-wrap" ref={dropdownRef}>
          {/* FILE Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('file')}
              className={`px-3 py-1 font-semibold rounded transition flex items-center gap-1 ${
                openDropdown === 'file' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:bg-slate-200'
              }`}
            >
              <span>File</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'file' && (
              <div className="absolute left-0 top-full mt-1 w-68 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(onOpenUploadModal)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="block text-slate-900 font-semibold">Upload Document</span>
                    <span className="text-[10px] text-slate-500 font-normal">.docx (Mammoth), .pdf, .txt</span>
                  </div>
                </button>
                <button
                  onClick={() => handleAction(onExportWord)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="block text-slate-900 font-semibold">Export Word (.docx)</span>
                    <span className="text-[10px] text-slate-500 font-normal">OOXML page setup, headers &amp; footnotes</span>
                  </div>
                </button>
                <button
                  onClick={() => handleAction(onOpenPrintModal)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <div>
                    <span className="block text-slate-900">Print / Export PDF...</span>
                    <span className="text-[10px] text-slate-500 font-normal">Page range, scale &amp; live fields</span>
                  </div>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(onOpenPreSubmissionChecklist)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Submission Readiness Checklist</span>
                </button>
                <button
                  onClick={() => handleAction(onExportResponseLetter)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Response to Reviewers Table</span>
                </button>
                <button
                  onClick={() => handleAction(onExportAIStatement)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>AI-Use Disclosure Draft</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(onOpenSettings)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 text-slate-700"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Settings &amp; AI Providers</span>
                </button>
              </div>
            )}
          </div>

          {/* INSERT Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('insert')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'insert' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Insert</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'insert' && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(onInsertFootnote)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Bookmark className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="block font-semibold">Footnote [fn]</span>
                    <span className="text-[10px] text-slate-500 font-normal">Shortcut: Ctrl+Alt+F</span>
                  </div>
                </button>
                <button
                  onClick={() => handleAction(onInsertPageBreak)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <Scissors className="w-4 h-4 text-indigo-600" />
                    <span>Page Break</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Ctrl+Enter</span>
                </button>
                <button
                  onClick={() => handleAction(() => onInsertSectionBreak('next-page'))}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Split className="w-4 h-4 text-indigo-500" />
                  <span>Section Break (Next Page)</span>
                </button>
                <button
                  onClick={() => handleAction(() => onInsertSectionBreak('continuous'))}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Split className="w-4 h-4 text-slate-500" />
                  <span>Section Break (Continuous)</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(onInsertToc)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Table className="w-4 h-4 text-blue-600" />
                  <span>Table of Contents (Live Field)</span>
                </button>
                <button
                  onClick={() => handleAction(onOpenCrossRefModal)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Link2 className="w-4 h-4 text-blue-600" />
                  <span>Cross-Reference (Page Ref)</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(() => onEditHeaderFooter('header'))}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Edit Header</span>
                </button>
                <button
                  onClick={() => handleAction(() => onEditHeaderFooter('footer'))}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Edit Footer</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(onOpenAddSource)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>New Source to Library</span>
                </button>
                <button
                  onClick={() => handleAction(onInsertTable)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Table2 className="w-4 h-4 text-blue-600" />
                  <span>Smart Table (3×3)</span>
                </button>
                <button
                  onClick={() => handleAction(onOpenChartModal)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <span>Insert Chart (CSV)...</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(() => editor?.chain().focus().toggleBlockquote().run())}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Quote className="w-4 h-4 text-slate-600" />
                  <span>Block Quote (Legal extract)</span>
                </button>
                <button
                  onClick={() => handleAction(() => editor?.chain().focus().setHorizontalRule().run())}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Minus className="w-4 h-4 text-slate-500" />
                  <span>Horizontal Rule</span>
                </button>
              </div>
            )}
          </div>

          {/* LAYOUT Menu (New MS Word Print Layout Controls) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('layout')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'layout' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Layout</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'layout' && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 text-slate-800 text-xs max-h-[80vh] overflow-y-auto">
                <button
                  onClick={() => handleAction(onOpenPageSetupModal)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between font-semibold text-blue-800 border-b border-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    <span>Page Setup Dialog...</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {pageSetup.paperSize} · {pageSetup.orientation}
                  </span>
                </button>

                {/* Paper Size Quick Pick */}
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Paper Size
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.keys(PAPER_SIZES) as PaperSizeId[]).map(sz => (
                      <button
                        key={sz}
                        onClick={() => handleAction(() => onQuickPaperSize(sz))}
                        className={`py-1 rounded border text-[11px] font-medium ${
                          pageSetup.paperSize === sz
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation */}
                <div className="px-3 py-1.5 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Orientation
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['portrait', 'landscape'] as PageOrientation[]).map(o => (
                      <button
                        key={o}
                        onClick={() => handleAction(() => onQuickOrientation(o))}
                        className={`py-1 px-2 rounded border capitalize text-[11px] font-medium ${
                          pageSetup.orientation === o
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Margin Presets */}
                <div className="px-3 py-1.5 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Margins
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(MARGIN_PRESETS) as Exclude<MarginPresetId, 'custom'>[]).map(id => (
                      <button
                        key={id}
                        onClick={() => handleAction(() => onQuickMarginPreset(id))}
                        className={`py-1 px-2 rounded border text-left text-[11px] ${
                          pageSetup.marginPreset === id
                            ? 'bg-blue-50 text-blue-800 border-blue-400 font-semibold'
                            : 'border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {MARGIN_PRESETS[id].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Columns & Line Numbers */}
                <div className="px-3 py-1.5 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Columns &amp; Line Numbers
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleAction(() => onQuickColumns(1))}
                      className={`py-1 px-2 rounded border flex items-center justify-center gap-1 text-[11px] ${
                        pageSetup.columns === 1
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                          : 'border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Columns className="w-3 h-3" />
                      <span>1 Column</span>
                    </button>
                    <button
                      onClick={() => handleAction(() => onQuickColumns(2))}
                      className={`py-1 px-2 rounded border flex items-center justify-center gap-1 text-[11px] ${
                        pageSetup.columns === 2
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                          : 'border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Columns className="w-3 h-3" />
                      <span>2 Columns</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleAction(onToggleLineNumbers)}
                    className="w-full py-1.5 px-2 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-between text-[11px]"
                  >
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Line Numbers (restart per page)</span>
                    </span>
                    <span className={`font-bold ${pageSetup.lineNumbers ? 'text-blue-700' : 'text-slate-400'}`}>
                      {pageSetup.lineNumbers ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {/* Paragraph Pagination Flow */}
                <div className="px-3 pt-1.5 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Paragraph Flow (Selection)
                  </span>
                  <button
                    onClick={() => handleAction(() => onToggleParagraphFlow('pageBreakBefore'))}
                    className="w-full py-1 px-2 rounded hover:bg-slate-100 text-left flex items-center justify-between"
                  >
                    <span>Page Break Before</span>
                    <span className="text-[10px] text-slate-400">Toggle</span>
                  </button>
                  <button
                    onClick={() => handleAction(() => onToggleParagraphFlow('keepWithNext'))}
                    className="w-full py-1 px-2 rounded hover:bg-slate-100 text-left flex items-center justify-between"
                  >
                    <span>Keep With Next</span>
                    <span className="text-[10px] text-slate-400">Toggle</span>
                  </button>
                  <button
                    onClick={() => handleAction(() => onToggleParagraphFlow('keepLinesTogether'))}
                    className="w-full py-1 px-2 rounded hover:bg-slate-100 text-left flex items-center justify-between"
                  >
                    <span>Keep Lines Together</span>
                    <span className="text-[10px] text-slate-400">Toggle</span>
                  </button>
                  <button
                    onClick={() => handleAction(() => onToggleParagraphFlow('widowOrphanControl'))}
                    className="w-full py-1 px-2 rounded hover:bg-slate-100 text-left flex items-center justify-between"
                  >
                    <span>Widow / Orphan Control</span>
                    <span className="text-[10px] text-slate-400">Toggle</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* REFERENCES Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('references')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'references' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>References</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'references' && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(onUpdateFields)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2.5 font-semibold text-blue-800"
                >
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="block">Update Fields</span>
                    <span className="text-[10px] text-slate-500 font-normal">Refresh TOC &amp; cross-reference pages</span>
                  </div>
                </button>
                <button
                  onClick={() => handleAction(onInsertToc)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Table className="w-4 h-4 text-slate-600" />
                  <span>Insert Table of Contents</span>
                </button>
                <button
                  onClick={() => handleAction(onOpenCrossRefModal)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <Link2 className="w-4 h-4 text-slate-600" />
                  <span>Insert Cross-Reference...</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(onOpenImportReferences)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <BookMarked className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="block font-semibold text-indigo-950">Import Mendeley / Zotero</span>
                    <span className="text-[10px] text-slate-500 font-normal">.bib (BibTeX) and .ris files</span>
                  </div>
                </button>
                <button
                  onClick={() => handleAction(() => onOpenSection('library'))}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Open Reference Library Panel</span>
                </button>
                <button
                  onClick={() => handleAction(onRunCitationAudit)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Run 10-Point Citation Audit</span>
                </button>
              </div>
            )}
          </div>

          {/* RESEARCH Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('research')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'research' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Research</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'research' && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(() => onOpenSection('workbench'))}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Scale className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="block font-semibold">Evidence Workbench</span>
                    <span className="text-[10px] text-slate-500 font-normal">Extract &amp; compare legal authorities</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* REVIEW Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('review')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'review' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Review</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'review' && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(onToggleTrackChanges)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between font-medium"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-600" />
                    <span>Track Changes</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    trackChangesActive ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {trackChangesActive ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => handleAction(() => onOpenSection('review'))}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span>Review Desk</span>
                </button>
                <button
                  onClick={() => handleAction(onExportResponseLetter)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 text-slate-700"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Generate Response Letter</span>
                </button>
              </div>
            )}
          </div>

          {/* LANGUAGE Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('language')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'language' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Language</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'language' && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(() => onOpenSection('language'))}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <Feather className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="block font-semibold">Language Studio</span>
                    <span className="text-[10px] text-slate-500 font-normal">British English (en-GB) &amp; phrase bank</span>
                  </div>
                </button>
                <div className="p-2.5 bg-emerald-50 text-[11px] text-emerald-900 flex items-center gap-1.5 border-t border-slate-100">
                  <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Legal Meaning Guard: modal verbs shall/may locked</span>
                </div>
              </div>
            )}
          </div>

          {/* ORIGINALITY Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('originality')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'originality' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Originality</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'originality' && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                <button
                  onClick={() => handleAction(() => onOpenSection('guard'))}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium"
                >
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>Originality Guard</span>
                </button>
                <button
                  onClick={() => handleAction(onRunOriginalityScan)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 text-slate-700"
                >
                  <Search className="w-4 h-4 text-slate-500" />
                  <span>Run Similarity Scan Now</span>
                </button>
              </div>
            )}
          </div>

          {/* VIEW Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('view')}
              className={`px-3 py-1 rounded transition flex items-center gap-1 ${
                openDropdown === 'view' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>View</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {openDropdown === 'view' && (
              <div className="absolute left-0 top-full mt-1 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                {[
                  { id: 'pages' as DocumentViewMode, label: 'Print Layout (Pages)' },
                  { id: 'draft' as DocumentViewMode, label: 'Draft View (Continuous)' },
                  { id: 'read' as DocumentViewMode, label: 'Read Mode (Locked)' },
                  { id: 'focus' as DocumentViewMode, label: 'Focus Mode (Hide Sidebars)' },
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleAction(() => onSetViewMode(v.id))}
                    className={`w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between ${
                      viewMode === v.id ? 'font-bold text-blue-700' : ''
                    }`}
                  >
                    <span>{v.label}</span>
                    {viewMode === v.id && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleAction(onToggleRuler)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Ruler className="w-3.5 h-3.5 text-slate-500" />
                    <span>Show Ruler</span>
                  </span>
                  {showRuler && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => handleAction(onToggleFormattingMarks)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Pilcrow className="w-3.5 h-3.5 text-slate-500" />
                    <span>Formatting Marks (¶)</span>
                  </span>
                  {showFormattingMarks && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => handleAction(onOpenGoTo)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between border-t border-slate-100 mt-1"
                >
                  <span className="flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Go To Page / Footnote...</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Ctrl+G</span>
                </button>
                {onToggleFullscreen && (
                  <button
                    onClick={() => handleAction(() => onToggleFullscreen())}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between border-t border-slate-100"
                  >
                    <span className="flex items-center gap-2">
                      {isFullscreen ? (
                        <Minimize className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Maximize className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">F11</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenCommandSearch}
            className="flex items-center gap-1.5 px-2 py-0.5 text-slate-500 bg-white hover:bg-slate-100 rounded border border-slate-200 shadow-2xs transition text-[11px]"
            title="Search commands, sections, or authorities (Ctrl+K)"
          >
            <Search className="w-3 h-3 text-slate-400" />
            <span className="hidden md:inline">Commands</span>
            <kbd className="hidden md:inline font-mono text-[9px] bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
              Ctrl+K
            </kbd>
          </button>

          <button
            onClick={onToggleLeftSidebar}
            className={`p-1.5 rounded transition ${
              isLeftSidebarOpen ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'
            }`}
            title={isLeftSidebarOpen ? 'Collapse Left Navigation (Ctrl+[)' : 'Expand Left Navigation'}
          >
            {isLeftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleRightSidebar}
            className={`p-1.5 rounded transition ${
              isRightSidebarOpen ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-200'
            }`}
            title={isRightSidebarOpen ? 'Collapse Right Panels' : 'Expand Right Panels'}
          >
            {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`p-1.5 rounded transition ${
                isFullscreen
                  ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Essential Formatting Ribbon */}
      <div className="h-10 px-3 flex items-center gap-1.5 text-slate-700 bg-white overflow-x-auto text-xs">
        <div className="flex items-center pr-1 border-r border-slate-200">
          <button
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-700 transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-700 transition"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center pr-1 border-r border-slate-200">
          <FontFamilyDropdown
            editor={editor}
            currentFontFamily={fontFamily}
            onChangeFontFamily={onChangeFontFamily}
          />
        </div>

        <div className="flex items-center pr-1 border-r border-slate-200">
          <select
            value={fontSize}
            onChange={e => onChangeFontSize(e.target.value)}
            className="h-7 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1 text-slate-800 font-medium focus:outline-none w-15"
            title="Font Size"
          >
            <option value="10pt">10 pt</option>
            <option value="11pt">11 pt</option>
            <option value="12pt">12 pt</option>
            <option value="14pt">14 pt</option>
            <option value="16pt">16 pt</option>
            <option value="18pt">18 pt</option>
          </select>
        </div>

        <div className="flex items-center pr-1 border-r border-slate-200">
          <select
            value={currentHeading}
            onChange={handleHeadingChange}
            className="h-7 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 font-medium text-slate-800 focus:outline-none"
            title="Paragraph Style / Heading"
          >
            <option value="p">Normal (Body)</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        </div>

        <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200">
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('bold') ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('italic') ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('underline') ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('strike') ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('highlight') ? 'bg-amber-200 text-amber-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Highlight Text"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleSubscript().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('subscript') ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Subscript"
          >
            <SubscriptIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('superscript') ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Superscript"
          >
            <SuperscriptIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200">
          <button
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Align Centre"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Justify"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200">
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('bulletList') ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('orderedList') ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded transition ${
              editor?.isActive('blockquote') ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Block Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Insert Smart Table & Modern Chart Buttons */}
        <div className="flex items-center gap-1 pr-1 border-r border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onInsertTable}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
              editor?.isActive('table')
                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                : 'hover:bg-slate-100 text-slate-700 border border-transparent'
            }`}
            title="Insert Smart Table (3×3, resizable)"
          >
            <Table2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden lg:inline">Insert Table</span>
          </button>
          <button
            type="button"
            onClick={onOpenChartModal}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 text-xs font-medium border border-transparent transition"
            title="Insert Chart (Bar, Line, Pie from CSV)"
          >
            <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden lg:inline">Insert Chart</span>
          </button>
        </div>

        {/* Quick Layout & Legal Actions */}
        <div className="flex items-center gap-1.5 pl-1 ml-auto shrink-0">
          <button
            onClick={onOpenPageSetupModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-medium transition"
            title="Page Setup (Size, Margins, Columns, Headers/Footers)"
          >
            <Sliders className="w-3 h-3 text-slate-600" />
            <span className="hidden xl:inline">{pageSetup.paperSize}</span>
          </button>

          <button
            onClick={onUpdateFields}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-medium transition"
            title="Update TOC & Cross-Reference page numbers"
          >
            <RefreshCw className="w-3 h-3 text-blue-600" />
            <span className="hidden xl:inline">Update Fields</span>
          </button>

          <button
            onClick={onInsertFootnote}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 text-xs font-semibold shadow-2xs transition"
            title="Insert Footnote (Ctrl+Alt+F)"
          >
            <Bookmark className="w-3 h-3 text-blue-600" />
            <span>Footnote</span>
          </button>

          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold shadow-2xs transition"
            title="Upload Word (.docx), PDF (.pdf), or Text (.txt)"
          >
            <Upload className="w-3 h-3 text-emerald-600" />
            <span>Upload</span>
          </button>
        </div>
      </div>
    </header>
  );
};
