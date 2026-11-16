/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * HumanManuscript: Main Legal & Human Rights Studio Application
 * Multi-page Print Layout, Page Setup, Headers/Footers, Footnotes, Live Fields, Zoom & OOXML .docx Export
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  Manuscript,
  Section,
  Footnote,
  Source,
  OriginalityFlag,
  DocumentViewMode,
  ZoomMode,
  PageSetupConfig,
  HeaderFooterConfig,
  PaperSizeId,
  PageOrientation,
  MarginPresetId,
  MeasurementUnit,
} from './types/manuscript';
import {
  loadManuscript,
  saveManuscript,
  exportProjectBundle,
  exportToWordDocument,
  generateAIUseStatement,
} from './services/storage';
import { runFullOriginalityScan } from './services/originalityGuard';
import { ParsedDocumentResult } from './services/documentParser';
import { formatCitationForEditor } from './services/referenceParser';
import {
  DocumentSectionOutline,
  DEFAULT_OUTLINE_SECTIONS,
  calculateSectionWordCounts,
  generateInitialFullManuscriptHtml,
} from './services/outlineManager';
import {
  DEFAULT_PAGE_SETUP,
  MARGIN_PRESETS,
  mergePageSetup,
  resolveEffectivePageSetup,
} from './services/pageLayout';
import { PaginationResult } from './services/paginationEngine';
import { TitleBar } from './components/TitleBar';
import { WordRibbon } from './components/WordRibbon';
import { NavigationPane } from './components/NavigationPane';
import { TipTapEditor, TipTapEditorHandle } from './components/editor/TipTapEditor';
import { TaskPane, AccordionSectionKey } from './components/TaskPane';
import { Editor } from '@tiptap/react';
import { StatusBar } from './components/StatusBar';
import { AddSourceModal } from './components/modals/AddSourceModal';
import { DocumentUploadModal } from './components/modals/DocumentUploadModal';
import { ImportReferencesModal } from './components/modals/ImportReferencesModal';
import { ResponseLetterModal } from './components/modals/ResponseLetterModal';
import { PreSubmissionModal } from './components/modals/PreSubmissionModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { CommandSearchModal } from './components/modals/CommandSearchModal';
import { ContractInspectorModal } from './components/modals/ContractInspectorModal';
import { PageSetupModal } from './components/modals/PageSetupModal';
import { GoToModal } from './components/modals/GoToModal';
import { PrintExportModal } from './components/modals/PrintExportModal';
import { CrossRefModal } from './components/modals/CrossRefModal';
import { InsertChartModal } from './components/modals/InsertChartModal';

export default function App() {
  const [manuscript, setManuscript] = useState<Manuscript>(() => loadManuscript());
  const [outlineSections, setOutlineSections] = useState<DocumentSectionOutline[]>(() =>
    DEFAULT_OUTLINE_SECTIONS
  );
  const [activeSectionId, setActiveSectionId] = useState<string>('sec-title');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevSidebarsRef = useRef<{ left: boolean; right: boolean }>({ left: true, right: true });
  const [activeAccordion, setActiveAccordion] = useState<AccordionSectionKey | null>('library');
  const [selectedFootnote, setSelectedFootnote] = useState<Footnote | null>(null);

  // Persisted Layout, View & Zoom preferences
  const [viewMode, setViewModeState] = useState<DocumentViewMode>(
    () => manuscript.settings.lastViewMode || 'pages'
  );
  const [zoomLevel, setZoomLevelState] = useState<number>(
    () => manuscript.settings.lastZoomLevel || 100
  );
  const [zoomMode, setZoomModeState] = useState<ZoomMode>(
    () => manuscript.settings.lastZoomMode || 'custom'
  );
  const [showRuler, setShowRuler] = useState<boolean>(
    () => manuscript.settings.showRuler !== false
  );
  const [showFormattingMarks, setShowFormattingMarks] = useState<boolean>(
    () => manuscript.settings.showFormattingMarks ?? false
  );
  const [unit, setUnit] = useState<MeasurementUnit>(
    () => manuscript.settings.preferredUnit || 'cm'
  );
  const [fontSize, setFontSize] = useState<string>(
    () => manuscript.settings.fontSize || '12pt'
  );
  const [fontFamily, setFontFamily] = useState<string>(
    () => manuscript.settings.fontFamily || 'Times New Roman'
  );

  // Pagination state
  const [paginationResult, setPaginationResult] = useState<PaginationResult | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [currentSectionKey, setCurrentSectionKey] = useState<string>('default');

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('Saved locally');

  // Full document continuous HTML state
  const [fullContentHtml, setFullContentHtml] = useState<string>(
    () => manuscript.editorHtml || generateInitialFullManuscriptHtml()
  );

  // Modals state
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isImportRefsOpen, setIsImportRefsOpen] = useState(false);
  const [isResponseLetterOpen, setIsResponseLetterOpen] = useState(false);
  const [isPreSubmissionOpen, setIsPreSubmissionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandSearchOpen, setIsCommandSearchOpen] = useState(false);
  const [isPageSetupOpen, setIsPageSetupOpen] = useState(false);
  const [isGoToOpen, setIsGoToOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCrossRefOpen, setIsCrossRefOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [contractInspectorSection, setContractInspectorSection] = useState<Section | null>(null);

  const tipTapRef = useRef<TipTapEditorHandle>(null);

  const pageSetup: PageSetupConfig = manuscript.pageSetup || DEFAULT_PAGE_SETUP;
  const useJournalPageSetup = manuscript.settings.useJournalPageSetup ?? false;

  // Persist view/zoom/layout settings back into manuscript state cleanly
  const setViewMode = useCallback((mode: DocumentViewMode) => {
    setViewModeState(mode);
    setManuscript(prev => ({
      ...prev,
      settings: { ...prev.settings, lastViewMode: mode },
    }));
  }, []);

  const handleZoomChange = useCallback((newZoom: number, mode: ZoomMode = 'custom') => {
    const clamped = Math.max(25, Math.min(500, Math.round(newZoom)));
    setZoomLevelState(clamped);
    setZoomModeState(mode);
    setManuscript(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        lastZoomLevel: clamped,
        lastZoomMode: mode,
      },
    }));
  }, []);

  const handleToggleRuler = useCallback(() => {
    setShowRuler(prev => {
      const next = !prev;
      setManuscript(m => ({ ...m, settings: { ...m.settings, showRuler: next } }));
      return next;
    });
  }, []);

  const handleToggleFormattingMarks = useCallback(() => {
    setShowFormattingMarks(prev => {
      const next = !prev;
      setManuscript(m => ({
        ...m,
        settings: { ...m.settings, showFormattingMarks: next },
      }));
      return next;
    });
  }, []);

  const handleChangeUnit = useCallback((nextUnit: MeasurementUnit) => {
    setUnit(nextUnit);
    setManuscript(m => ({ ...m, settings: { ...m.settings, preferredUnit: nextUnit } }));
  }, []);

  const handleChangeFontSize = useCallback((size: string) => {
    setFontSize(size);
    setManuscript(m => ({ ...m, settings: { ...m.settings, fontSize: size } }));
  }, []);

  const handleChangeFontFamily = useCallback((font: string) => {
    setFontFamily(font);
    setManuscript(m => ({ ...m, settings: { ...m.settings, fontFamily: font } }));
  }, []);

  // Auto-Save Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSaving(true);
      saveManuscript(manuscript);
      const now = new Date();
      setLastSavedText(
        `Saved ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      );
      setIsSaving(false);
    }, manuscript.settings.autoSaveIntervalMs || 5000);

    return () => clearTimeout(timer);
  }, [manuscript]);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+Alt+F, Ctrl+K, Ctrl+G, Ctrl+/- /0, Ctrl+[, Ctrl+])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveManuscript(manuscript);
        setIsSaving(true);
        setTimeout(() => {
          setIsSaving(false);
          setLastSavedText('Saved now');
        }, 300);
      } else if (mod && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleInsertFootnote();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandSearchOpen(prev => !prev);
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setIsGoToOpen(prev => !prev);
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPrintModalOpen(true);
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomChange(zoomLevel + 10, 'custom');
      } else if (mod && e.key === '-') {
        e.preventDefault();
        handleZoomChange(zoomLevel - 10, 'custom');
      } else if (mod && e.key === '0') {
        e.preventDefault();
        handleZoomChange(100, 'custom');
      } else if (mod && e.key === '[') {
        e.preventDefault();
        setIsLeftSidebarOpen(prev => !prev);
      } else if (mod && e.key === ']') {
        e.preventDefault();
        setIsRightSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manuscript, zoomLevel, handleZoomChange]);

  // Listen to browser native Fullscreen API changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      if (isNowFullscreen) {
        setIsLeftSidebarOpen(false);
        setIsRightSidebarOpen(false);
        setViewMode('focus');
      } else {
        setIsLeftSidebarOpen(prevSidebarsRef.current.left);
        setIsRightSidebarOpen(prevSidebarsRef.current.right);
        setViewMode('pages');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setViewMode]);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        prevSidebarsRef.current = {
          left: isLeftSidebarOpen,
          right: isRightSidebarOpen,
        };
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen(prev => {
        const next = !prev;
        if (next) {
          prevSidebarsRef.current = { left: isLeftSidebarOpen, right: isRightSidebarOpen };
          setIsLeftSidebarOpen(false);
          setIsRightSidebarOpen(false);
          setViewMode('focus');
        } else {
          setIsLeftSidebarOpen(prevSidebarsRef.current.left);
          setIsRightSidebarOpen(prevSidebarsRef.current.right);
          setViewMode('pages');
        }
        return next;
      });
    }
  };

  const activeSection =
    manuscript.sections.find(s => s.id === activeSectionId) || manuscript.sections[0];

  const totalManuscriptWords = outlineSections
    .filter(s => !s.isHidden)
    .reduce((acc, s) => acc + s.wordCount, 0);

  const activeSectionWordCount =
    outlineSections.find(s => s.id === activeSectionId)?.wordCount || 0;

  const originalityRedCount = manuscript.originalityFlags.filter(
    f => f.kind === 'verbatim-match' && f.status === 'open'
  ).length;

  const originalityOrangeCount = manuscript.originalityFlags.filter(
    f => f.kind === 'close-paraphrase' && f.status === 'open'
  ).length;

  // Real-time Content Change handler from TipTap
  const handleTipTapContentChange = (html: string) => {
    setFullContentHtml(html);
    setManuscript(prev => ({
      ...prev,
      editorHtml: html,
    }));
    const updatedCounts = calculateSectionWordCounts(html, outlineSections);
    setOutlineSections(prev =>
      prev.map(sec => ({
        ...sec,
        wordCount: updatedCounts[sec.id] !== undefined ? updatedCounts[sec.id] : sec.wordCount,
      }))
    );
  };

  const handlePaginationChange = useCallback(
    (result: PaginationResult, currPg: number, secKey: string) => {
      setPaginationResult(result);
      setCurrentPage(currPg);
      setCurrentSectionKey(secKey);
    },
    []
  );

  // Page Setup handlers
  const handleApplyPageSetup = (
    nextSetup: PageSetupConfig,
    scope: 'document' | 'section',
    targetSectionKey: string
  ) => {
    if (scope === 'section' && targetSectionKey !== 'default') {
      setManuscript(prev => ({
        ...prev,
        sectionPageSetups: {
          ...(prev.sectionPageSetups || {}),
          [targetSectionKey]: nextSetup,
        },
      }));
    } else {
      setManuscript(prev => ({
        ...prev,
        pageSetup: nextSetup,
      }));
    }
  };

  const handleQuickPaperSize = (paperSize: PaperSizeId) => {
    setManuscript(prev => ({
      ...prev,
      pageSetup: mergePageSetup(prev.pageSetup || DEFAULT_PAGE_SETUP, { paperSize }),
    }));
  };

  const handleQuickOrientation = (orientation: PageOrientation) => {
    setManuscript(prev => ({
      ...prev,
      pageSetup: mergePageSetup(prev.pageSetup || DEFAULT_PAGE_SETUP, { orientation }),
    }));
  };

  const handleQuickMarginPreset = (presetId: Exclude<MarginPresetId, 'custom'>) => {
    const preset = MARGIN_PRESETS[presetId];
    setManuscript(prev => ({
      ...prev,
      pageSetup: mergePageSetup(prev.pageSetup || DEFAULT_PAGE_SETUP, {
        marginPreset: presetId,
        marginsCm: {
          ...preset.marginsCm,
          gutter: prev.pageSetup?.marginsCm?.gutter || 0,
        },
      }),
    }));
  };

  const handleQuickColumns = (columns: 1 | 2) => {
    setManuscript(prev => ({
      ...prev,
      pageSetup: mergePageSetup(prev.pageSetup || DEFAULT_PAGE_SETUP, { columns }),
    }));
  };

  const handleToggleLineNumbers = () => {
    setManuscript(prev => {
      const curr = prev.pageSetup || DEFAULT_PAGE_SETUP;
      return {
        ...prev,
        pageSetup: mergePageSetup(curr, { lineNumbers: !curr.lineNumbers }),
      };
    });
  };

  const handleMarginsChangeFromRuler = useCallback(
    (leftCm: number, rightCm: number) => {
      setManuscript(prev => {
        const curr = prev.pageSetup || DEFAULT_PAGE_SETUP;
        return {
          ...prev,
          pageSetup: mergePageSetup(curr, {
            marginPreset: 'custom',
            marginsCm: {
              ...curr.marginsCm,
              left: leftCm,
              right: rightCm,
            },
          }),
        };
      });
    },
    []
  );

  const handleUpdateHeaderFooter = useCallback(
    (hfPatch: Partial<HeaderFooterConfig>, sectionKey?: string) => {
      if (sectionKey && sectionKey !== 'default') {
        setManuscript(prev => {
          const existing = prev.sectionPageSetups?.[sectionKey] || {};
          const mergedHf = {
            ...(prev.pageSetup?.headerFooter || DEFAULT_PAGE_SETUP.headerFooter),
            ...(existing.headerFooter || {}),
            ...hfPatch,
          };
          return {
            ...prev,
            sectionPageSetups: {
              ...(prev.sectionPageSetups || {}),
              [sectionKey]: {
                ...existing,
                headerFooter: mergedHf,
              },
            },
          };
        });
      } else {
        setManuscript(prev => {
          const curr = prev.pageSetup || DEFAULT_PAGE_SETUP;
          return {
            ...prev,
            pageSetup: mergePageSetup(curr, {
              headerFooter: {
                ...curr.headerFooter,
                ...hfPatch,
              },
            }),
          };
        });
      }
    },
    []
  );

  const handleToggleParagraphFlow = (
    attr: 'pageBreakBefore' | 'keepWithNext' | 'keepLinesTogether' | 'widowOrphanControl'
  ) => {
    if (!editor) return;
    const isPara = editor.isActive('paragraph');
    const currentAttrs = isPara
      ? editor.getAttributes('paragraph')
      : editor.getAttributes('heading');
    const currVal = currentAttrs?.[attr];
    const nextVal =
      attr === 'widowOrphanControl'
        ? currVal === false
        : attr === 'keepWithNext'
        ? !(currVal === true || (currVal === null && editor.isActive('heading')))
        : !currVal;
    tipTapRef.current?.setParagraphFlow({ [attr]: nextVal });
  };

  // Smooth Navigation
  const handleNavigateToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    tipTapRef.current?.scrollToSection(sectionId);
  };

  const handleAddOutlineSection = (title: string, wordTarget: number = 1500) => {
    const cleanId = `sec-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()
      .toString()
      .slice(-4)}`;
    const newSec: DocumentSectionOutline = {
      id: cleanId,
      type: 'custom',
      title,
      subtitle: 'Substantive section analysis',
      wordCount: 0,
      wordTarget,
      isHidden: false,
      isDefault: false,
      order: outlineSections.length + 1,
    };

    setOutlineSections(prev => {
      const conclusionIdx = prev.findIndex(s => s.type === 'conclusion');
      if (conclusionIdx >= 0) {
        const copy = [...prev];
        copy.splice(conclusionIdx, 0, newSec);
        return copy;
      }
      return [...prev, newSec];
    });

    const manuscriptSection: Section = {
      id: cleanId,
      manuscriptId: manuscript.id,
      order: manuscript.sections.length + 1,
      role: title,
      title,
      wordTarget,
      status: 'drafting',
      contract: {
        role: title,
        description: `Substantive analysis and jurisprudence for ${title}.`,
        wordTarget,
        wordTolerance: 150,
        requiredMoves: ['doctrinal-analysis', 'primary-authority', 'concluding-argument'],
        citationRules: ['Cite relevant treaties, statutes, or regional court precedents.'],
      },
      blocks: [
        {
          id: `blk_${cleanId}_01`,
          sectionId: cleanId,
          order: 1,
          type: 'paragraph',
          content: `Analysis for ${title}...`,
        },
      ],
    };

    setManuscript(prev => ({
      ...prev,
      sections: [...prev.sections, manuscriptSection],
    }));

    const headingHtml = `<h2 id="${cleanId}" class="font-serif font-bold text-lg text-slate-800 mt-8 mb-2.5">${title}</h2><p>Write your substantive analysis for ${title} here...</p>`;
    tipTapRef.current?.insertHtml(headingHtml);

    setTimeout(() => {
      handleNavigateToSection(cleanId);
    }, 150);
  };

  const handleRemoveOrHideSection = (sectionId: string) => {
    setOutlineSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, isHidden: true } : s))
    );
  };

  const handleRestoreSection = (sectionId: string) => {
    setOutlineSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, isHidden: false } : s))
    );
  };

  const handleInsertFootnote = (targetBlockId?: string) => {
    const nextNumber =
      manuscript.footnotes.reduce((max, f) => Math.max(max, f.number), 0) + 1;
    const newFootnoteId = `fn_${Date.now()}`;

    const newFootnote: Footnote = {
      id: newFootnoteId,
      number: nextNumber,
      blockId: targetBlockId || activeSection.blocks[0]?.id || `blk_${Date.now()}`,
      content: `Author footnote citation ${nextNumber}.`,
      citations: [],
    };

    tipTapRef.current?.insertCitation(`[fn${nextNumber}]`);

    setManuscript(prev => ({
      ...prev,
      footnotes: [...prev.footnotes, newFootnote],
    }));

    setSelectedFootnote(newFootnote);
    setIsRightSidebarOpen(true);
    setActiveAccordion('library');
  };

  const handleInsertParsedDocument = (
    result: ParsedDocumentResult,
    mode: 'replace-section' | 'append-section' | 'new-section'
  ) => {
    if (mode === 'replace-section') {
      tipTapRef.current?.setContent(result.htmlContent);
      handleTipTapContentChange(result.htmlContent);
    } else if (mode === 'append-section') {
      tipTapRef.current?.insertHtml(result.htmlContent);
    } else if (mode === 'new-section') {
      handleAddOutlineSection(result.title, result.wordCount || 1500);
      setTimeout(() => {
        tipTapRef.current?.insertHtml(result.htmlContent);
      }, 200);
    }
  };

  const handleImportMendeleySources = (importedSources: Source[]) => {
    setManuscript(prev => ({
      ...prev,
      sources: [...importedSources, ...prev.sources],
    }));
    setIsRightSidebarOpen(true);
    setActiveAccordion('library');
  };

  const handleInsertCitationToEditor = (
    source: Source,
    style: 'oscola-footnote' | 'in-text-author-year' | 'in-text-numeric' | 'apa'
  ) => {
    if (style === 'oscola-footnote') {
      const nextNum =
        manuscript.footnotes.reduce((max, f) => Math.max(max, f.number), 0) + 1;
      const fnId = `fn_${Date.now()}`;
      const newFn: Footnote = {
        id: fnId,
        number: nextNum,
        blockId: activeSection.blocks[0]?.id || `blk_${Date.now()}`,
        content: source.citationString || `${source.title} (${source.year})`,
        citations: [
          {
            id: `cit_${Date.now()}`,
            footnoteId: fnId,
            sourceId: source.id,
          },
        ],
      };

      tipTapRef.current?.insertCitation(`[fn${nextNum}]`);

      setManuscript(prev => ({
        ...prev,
        footnotes: [...prev.footnotes, newFn],
      }));
    } else {
      const indexNum = manuscript.sources.findIndex(s => s.id === source.id) + 1;
      const citeStr = formatCitationForEditor(source, style, indexNum > 0 ? indexNum : 1);
      tipTapRef.current?.insertCitation(citeStr);
    }
  };

  const handleAddSource = (src: Source) => {
    setManuscript(prev => ({
      ...prev,
      sources: [src, ...prev.sources],
    }));
  };

  const handleApplyProposal = (proposalId: string) => {
    const prop = manuscript.proposals.find(p => p.id === proposalId);
    if (!prop) return;

    for (const op of prop.operations) {
      if (op.op === 'replace_text') {
        tipTapRef.current?.insertHtml(`<p><strong>[Proposal Accepted]</strong> ${op.after}</p>`);
      }
    }

    setManuscript(prev => ({
      ...prev,
      proposals: prev.proposals.map(p => (p.id === proposalId ? { ...p, status: 'accepted' } : p)),
      reviewerComments: prev.reviewerComments.map(c =>
        c.id === prop.commentId ? { ...c, status: 'applied' } : c
      ),
    }));
  };

  const handleRejectProposal = (proposalId: string) => {
    setManuscript(prev => ({
      ...prev,
      proposals: prev.proposals.map(p => (p.id === proposalId ? { ...p, status: 'rejected' } : p)),
    }));
  };

  const handleFixOriginalityFlag = (
    flag: OriginalityFlag,
    fixType: 'quote' | 'cite' | 'dismiss'
  ) => {
    if (fixType === 'dismiss') {
      setManuscript(prev => ({
        ...prev,
        originalityFlags: prev.originalityFlags.map(f =>
          f.id === flag.id ? { ...f, status: 'dismissed' } : f
        ),
      }));
      return;
    }

    if (fixType === 'quote') {
      tipTapRef.current?.insertCitation(`'${flag.textSpan}'`);
      setManuscript(prev => ({
        ...prev,
        originalityFlags: prev.originalityFlags.map(f =>
          f.id === flag.id ? { ...f, status: 'fixed', kind: 'properly-quoted' } : f
        ),
      }));
    } else if (fixType === 'cite') {
      handleInsertFootnote(flag.blockId);
      setManuscript(prev => ({
        ...prev,
        originalityFlags: prev.originalityFlags.map(f =>
          f.id === flag.id ? { ...f, status: 'fixed' } : f
        ),
      }));
    }
  };

  const handleRunOriginalityScan = () => {
    const updatedFlags = runFullOriginalityScan(manuscript);
    setManuscript(prev => ({
      ...prev,
      originalityFlags: updatedFlags,
    }));
    setIsRightSidebarOpen(true);
    setActiveAccordion('guard');
  };

  const handleUpdateContract = (secId: string, updatedContract: Section['contract']) => {
    setManuscript(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === secId
          ? { ...s, contract: updatedContract, wordTarget: updatedContract.wordTarget }
          : s
      ),
    }));
  };

  const handleUpdateFootnoteContent = (fnId: string, newContent: string) => {
    setManuscript(prev => ({
      ...prev,
      footnotes: prev.footnotes.map(f => (f.id === fnId ? { ...f, content: newContent } : f)),
    }));
  };

  const handleUpdateSettings = (newSettings: Manuscript['settings']) => {
    setManuscript(prev => ({
      ...prev,
      settings: newSettings,
    }));
  };

  const handleExportAIStatement = () => {
    const stmt = generateAIUseStatement(manuscript);
    const blob = new Blob([stmt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Use_Disclosure_${manuscript.journalProfile.name.replace(
      /[^a-zA-Z0-9]/g,
      '_'
    )}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDocx = async () => {
    tipTapRef.current?.updateFields();
    const latestHtml = tipTapRef.current?.getHtml() || fullContentHtml;
    await exportToWordDocument(
      manuscript,
      manuscript.settings.trackChanges,
      fontFamily,
      latestHtml,
      fontSize
    );
  };

  const hideSidebars = viewMode === 'focus' || viewMode === 'read';
  const effectiveSetupForCurrentSection = resolveEffectivePageSetup(
    pageSetup,
    manuscript.journalProfile,
    useJournalPageSetup,
    currentSectionKey !== 'default' ? manuscript.sectionPageSetups?.[currentSectionKey] : undefined
  );

  const activePageInfo = paginationResult?.pages[currentPage - 1];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* 1. Title Bar */}
      <TitleBar
        documentTitle={manuscript.title}
        onSave={() => {
          saveManuscript(manuscript);
          setIsSaving(true);
          setTimeout(() => {
            setIsSaving(false);
            setLastSavedText('Saved now');
          }, 300);
        }}
        onBackup={() => exportProjectBundle(manuscript)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSaving={isSaving}
        lastSavedText={lastSavedText}
      />

      {/* 2. Word Ribbon & Menu Bar */}
      <WordRibbon
        editor={editor}
        fontSize={fontSize}
        onChangeFontSize={handleChangeFontSize}
        fontFamily={fontFamily}
        onChangeFontFamily={handleChangeFontFamily}
        isLeftSidebarOpen={isLeftSidebarOpen && !hideSidebars}
        onToggleLeftSidebar={() => {
          setIsLeftSidebarOpen(prev => {
            const next = !prev;
            if (!isFullscreen) prevSidebarsRef.current.left = next;
            return next;
          });
        }}
        isRightSidebarOpen={isRightSidebarOpen && !hideSidebars}
        onToggleRightSidebar={() => {
          setIsRightSidebarOpen(prev => {
            const next = !prev;
            if (!isFullscreen) prevSidebarsRef.current.right = next;
            return next;
          });
        }}
        onOpenUploadModal={() => setIsUploadDocOpen(true)}
        onOpenImportReferences={() => setIsImportRefsOpen(true)}
        onInsertFootnote={() => handleInsertFootnote()}
        onOpenAddSource={() => setIsAddSourceOpen(true)}
        onToggleTrackChanges={() => {
          setManuscript(prev => ({
            ...prev,
            settings: { ...prev.settings, trackChanges: !prev.settings.trackChanges },
          }));
        }}
        trackChangesActive={manuscript.settings.trackChanges}
        onOpenSection={tab => {
          setIsRightSidebarOpen(true);
          setActiveAccordion(tab);
        }}
        onRunCitationAudit={() => {
          setIsRightSidebarOpen(true);
          setActiveAccordion('library');
        }}
        onRunOriginalityScan={() => {
          handleRunOriginalityScan();
          setIsRightSidebarOpen(true);
          setActiveAccordion('guard');
        }}
        onOpenPreSubmissionChecklist={() => setIsPreSubmissionOpen(true)}
        onExportWord={handleExportDocx}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onExportResponseLetter={() => setIsResponseLetterOpen(true)}
        onExportAIStatement={handleExportAIStatement}
        onOpenSettings={() => setIsSettingsOpen(true)}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onOpenCommandSearch={() => setIsCommandSearchOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        pageSetup={effectiveSetupForCurrentSection}
        onQuickPaperSize={handleQuickPaperSize}
        onQuickOrientation={handleQuickOrientation}
        onQuickMarginPreset={handleQuickMarginPreset}
        onQuickColumns={handleQuickColumns}
        onToggleLineNumbers={handleToggleLineNumbers}
        onOpenPageSetupModal={() => setIsPageSetupOpen(true)}
        onInsertPageBreak={() => tipTapRef.current?.insertPageBreak()}
        onInsertSectionBreak={t => tipTapRef.current?.insertSectionBreak(t)}
        onInsertToc={() => tipTapRef.current?.insertToc()}
        onOpenCrossRefModal={() => setIsCrossRefOpen(true)}
        onUpdateFields={() => tipTapRef.current?.updateFields()}
        onEditHeaderFooter={z => tipTapRef.current?.openHeaderFooterEditor(z)}
        onToggleParagraphFlow={handleToggleParagraphFlow}
        showRuler={showRuler}
        onToggleRuler={handleToggleRuler}
        showFormattingMarks={showFormattingMarks}
        onToggleFormattingMarks={handleToggleFormattingMarks}
        onOpenGoTo={() => setIsGoToOpen(true)}
        onInsertTable={() => tipTapRef.current?.insertTable(3, 3)}
        onOpenChartModal={() => setIsChartModalOpen(true)}
      />

      {/* 3. Three-Column Workspace */}
      <div className="flex-1 overflow-hidden relative">
        <Group orientation="horizontal" className="h-full w-full">
          {isLeftSidebarOpen && !hideSidebars && (
            <>
              <Panel
                id="panel-outline"
                defaultSize="22%"
                minSize="14%"
                maxSize="38%"
                className="h-full overflow-hidden bg-slate-50 border-r border-slate-200 shadow-2xs z-10 no-print"
              >
                <NavigationPane
                  sections={outlineSections}
                  activeSectionId={activeSectionId}
                  totalWordCount={totalManuscriptWords}
                  pages={paginationResult?.pages || []}
                  currentPage={currentPage}
                  onNavigateToSection={handleNavigateToSection}
                  onNavigateToPage={pgNum => tipTapRef.current?.scrollToPage(pgNum)}
                  onAddSection={handleAddOutlineSection}
                  onRemoveOrHideSection={handleRemoveOrHideSection}
                  onRestoreSection={handleRestoreSection}
                  onToggleCollapse={() => setIsLeftSidebarOpen(false)}
                />
              </Panel>

              <Separator className="w-1.5 hover:w-2 bg-slate-200 hover:bg-blue-500 active:bg-blue-600 transition-all duration-150 cursor-col-resize flex items-center justify-center group relative z-20 outline-none select-none no-print">
                <div className="w-0.5 h-7 bg-slate-400 group-hover:bg-white rounded-full transition-colors pointer-events-none" />
              </Separator>
            </>
          )}

          {/* Center Multi-Page Editor */}
          <Panel id="panel-editor" minSize="35%" className="h-full overflow-hidden flex flex-col z-0">
            <TipTapEditor
              ref={tipTapRef}
              initialContent={fullContentHtml}
              manuscriptTitle={manuscript.title}
              authorLabel={
                manuscript.journalProfile?.publisher
                  ? `Author · ${manuscript.journalProfile.publisher}`
                  : 'Research Fellow'
              }
              activeSection={activeSection}
              footnotes={manuscript.footnotes}
              viewMode={viewMode}
              zoomLevel={zoomLevel}
              zoomMode={zoomMode}
              onZoomChange={handleZoomChange}
              pageSetup={pageSetup}
              sectionPageSetups={manuscript.sectionPageSetups}
              journalProfile={manuscript.journalProfile}
              useJournalPageSetup={useJournalPageSetup}
              unit={unit}
              showRuler={showRuler}
              showFormattingMarks={showFormattingMarks}
              onContentChange={handleTipTapContentChange}
              onMarginsChange={handleMarginsChangeFromRuler}
              onUpdateHeaderFooter={handleUpdateHeaderFooter}
              onPaginationChange={handlePaginationChange}
              onSelectFootnote={fn => {
                setSelectedFootnote(fn);
                setIsRightSidebarOpen(true);
                setActiveAccordion('library');
              }}
              fontSize={fontSize}
              fontFamily={fontFamily}
              onEditorReady={setEditor}
            />
          </Panel>

          {isRightSidebarOpen && !hideSidebars && (
            <>
              <Separator className="w-1.5 hover:w-2 bg-slate-200 hover:bg-blue-500 active:bg-blue-600 transition-all duration-150 cursor-col-resize flex items-center justify-center group relative z-20 outline-none select-none no-print">
                <div className="w-0.5 h-7 bg-slate-400 group-hover:bg-white rounded-full transition-colors pointer-events-none" />
              </Separator>

              <Panel
                id="panel-taskpane"
                defaultSize="26%"
                minSize="18%"
                maxSize="45%"
                className="h-full overflow-hidden bg-slate-50 border-l border-slate-200 shadow-2xs z-10 no-print"
              >
                <TaskPane
                  isOpen={isRightSidebarOpen}
                  onClose={() => setIsRightSidebarOpen(false)}
                  activeAccordion={activeAccordion}
                  onToggleAccordion={key => setActiveAccordion(prev => (prev === key ? null : key))}
                  manuscript={manuscript}
                  activeSection={activeSection}
                  getEditorHtml={() => tipTapRef.current?.getHtml() || fullContentHtml}
                  onUpdateGeminiApiKey={key =>
                    setManuscript(prev => ({
                      ...prev,
                      settings: { ...prev.settings, geminiApiKey: key || undefined },
                    }))
                  }
                  selectedFootnote={selectedFootnote}
                  onSelectFootnote={setSelectedFootnote}
                  onOpenAddSource={() => setIsAddSourceOpen(true)}
                  onOpenImportReferences={() => setIsImportRefsOpen(true)}
                  onInsertCitationToEditor={handleInsertCitationToEditor}
                  onApplyProposal={handleApplyProposal}
                  onRejectProposal={handleRejectProposal}
                  onUpdateFootnoteContent={handleUpdateFootnoteContent}
                  onFixOriginalityFlag={handleFixOriginalityFlag}
                  onAddSourceDirectly={handleAddSource}
                />
              </Panel>
            </>
          )}
        </Group>
      </div>

      {/* 4. Bottom Status Bar */}
      <StatusBar
        currentPage={currentPage}
        totalPages={paginationResult?.totalPages || 1}
        formattedPageNumber={activePageInfo?.formattedPageNumber}
        onOpenGoTo={() => setIsGoToOpen(true)}
        currentSectionWords={activeSectionWordCount}
        sectionTargetWords={activeSection.wordTarget || 1500}
        totalManuscriptWords={totalManuscriptWords}
        originalityRedCount={originalityRedCount}
        originalityOrangeCount={originalityOrangeCount}
        trackChangesActive={manuscript.settings.trackChanges}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        showRuler={showRuler}
        onToggleRuler={handleToggleRuler}
        showFormattingMarks={showFormattingMarks}
        onToggleFormattingMarks={handleToggleFormattingMarks}
        zoomLevel={zoomLevel}
        zoomMode={zoomMode}
        onZoomChange={handleZoomChange}
        lastBackupText={lastSavedText}
      />

      {/* 5. Modals */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onAddSource={handleAddSource}
      />

      <DocumentUploadModal
        isOpen={isUploadDocOpen}
        onClose={() => setIsUploadDocOpen(false)}
        onInsertParsedContent={handleInsertParsedDocument}
      />

      <ImportReferencesModal
        isOpen={isImportRefsOpen}
        onClose={() => setIsImportRefsOpen(false)}
        onImportSources={handleImportMendeleySources}
      />

      <ResponseLetterModal
        isOpen={isResponseLetterOpen}
        onClose={() => setIsResponseLetterOpen(false)}
        manuscript={manuscript}
      />

      <PreSubmissionModal
        isOpen={isPreSubmissionOpen}
        onClose={() => setIsPreSubmissionOpen(false)}
        manuscript={manuscript}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        manuscript={manuscript}
        onUpdateSettings={handleUpdateSettings}
      />

      <CommandSearchModal
        isOpen={isCommandSearchOpen}
        onClose={() => setIsCommandSearchOpen(false)}
        manuscript={manuscript}
        onSelectSection={handleNavigateToSection}
        onOpenAddSource={() => setIsAddSourceOpen(true)}
        onInsertFootnote={() => handleInsertFootnote()}
        onOpenPageSetup={() => setIsPageSetupOpen(true)}
        onOpenGoTo={() => setIsGoToOpen(true)}
        onInsertPageBreak={() => tipTapRef.current?.insertPageBreak()}
        onInsertSectionBreak={() => tipTapRef.current?.insertSectionBreak('next-page')}
        onInsertToc={() => tipTapRef.current?.insertToc()}
        onOpenCrossRef={() => setIsCrossRefOpen(true)}
        onUpdateFields={() => tipTapRef.current?.updateFields()}
        onExportDocx={handleExportDocx}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
      />

      <ContractInspectorModal
        isOpen={!!contractInspectorSection}
        onClose={() => setContractInspectorSection(null)}
        section={contractInspectorSection}
        onUpdateContract={handleUpdateContract}
      />

      <PageSetupModal
        isOpen={isPageSetupOpen}
        onClose={() => setIsPageSetupOpen(false)}
        currentSetup={effectiveSetupForCurrentSection}
        currentSectionKey={currentSectionKey}
        sectionKeys={Object.keys(manuscript.sectionPageSetups || {})}
        unit={unit}
        onChangeUnit={handleChangeUnit}
        journalProfile={manuscript.journalProfile}
        useJournalOverride={useJournalPageSetup}
        onToggleJournalOverride={enabled =>
          setManuscript(prev => ({
            ...prev,
            settings: { ...prev.settings, useJournalPageSetup: enabled },
          }))
        }
        onApplySetup={handleApplyPageSetup}
      />

      <GoToModal
        isOpen={isGoToOpen}
        onClose={() => setIsGoToOpen(false)}
        pages={paginationResult?.pages || []}
        currentPage={currentPage}
        footnotes={manuscript.footnotes}
        footnotePageMap={paginationResult?.footnotePageMap || {}}
        sections={outlineSections.filter(s => !s.isHidden).map(s => ({ id: s.id, title: s.title }))}
        onGoToPage={pgNum => tipTapRef.current?.scrollToPage(pgNum)}
        onGoToSection={handleNavigateToSection}
        onGoToFootnote={(fn, pgNum) => {
          setSelectedFootnote(fn);
          setIsRightSidebarOpen(true);
          setActiveAccordion('library');
          if (pgNum) tipTapRef.current?.scrollToPage(pgNum);
        }}
      />

      <PrintExportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        totalPages={paginationResult?.totalPages || 1}
        currentPage={currentPage}
        pageSetup={effectiveSetupForCurrentSection}
        onBeforePrintUpdateFields={() => tipTapRef.current?.updateFields()}
        onExportDocx={handleExportDocx}
      />

      <CrossRefModal
        isOpen={isCrossRefOpen}
        onClose={() => setIsCrossRefOpen(false)}
        pagination={paginationResult}
        footnotes={manuscript.footnotes}
        onInsertCrossRef={attrs => tipTapRef.current?.insertCrossRef(attrs)}
      />

      <InsertChartModal
        isOpen={isChartModalOpen}
        onClose={() => setIsChartModalOpen(false)}
        onInsertChartImage={(base64Src, altText) =>
          tipTapRef.current?.insertImage(base64Src, altText)
        }
      />
    </div>
  );
}
