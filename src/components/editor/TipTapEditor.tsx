/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Microsoft Word-Style Multi-Page TipTap Print Layout Canvas
 *
 * Architecture:
 * - Single continuous ProseMirror document & undo history; selections span across pages naturally
 * - Layer 1 (Underlay): Virtualized white page sheets with shadow & gap on grey desk (96 DPI)
 * - Layer 2 (Content): Single EditorContent with non-destructive Decoration.widget page spacers
 * - Layer 3 (Overlay): Double-click inline Headers & Footers, Per-page Footnotes, Line Numbers
 * - Scale-invariant pagination computed at 100% layout metrics; CSS `zoom` scales visually only
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import {
  DocumentViewMode,
  Footnote,
  HeaderFooterConfig,
  HeaderFooterSlot,
  JournalProfile,
  MeasurementUnit,
  PageSetupConfig,
  Section,
  ZoomMode,
} from '../../types/manuscript';
import { WordRuler } from './WordRuler';
import { getFontCssStack } from './FontFamilyDropdown';
import { TableBubbleMenu } from './TableBubbleMenu';
import {
  CrossRefNode,
  PAGINATION_PLUGIN_KEY,
  PageBreakNode,
  PaginationPluginExtension,
  ParagraphFlowExtension,
  SectionBreakNode,
  TocFieldNode,
} from './extensions/PaginationExtensions';
import {
  ComputedPageInfo,
  PaginationCache,
  PaginationResult,
  computeDocumentPagination,
} from '../../services/paginationEngine';
import {
  PAGE_GAP_PX,
  getActiveHeaderFooterSlots,
  mergePageSetup,
  resolveEffectivePageSetup,
  resolveFieldTokens,
  resolvePageMetrics,
} from '../../services/pageLayout';
import { Check, X } from 'lucide-react';

export interface TipTapEditorHandle {
  insertCitation: (citationText: string) => void;
  insertHtml: (html: string) => void;
  setContent: (htmlOrText: string) => void;
  getHtml: () => string;
  getText: () => string;
  scrollToSection: (sectionId: string) => void;
  scrollToPage: (pageNumber: number) => void;
  insertPageBreak: () => void;
  insertSectionBreak: (breakType?: 'next-page' | 'continuous') => void;
  insertToc: () => void;
  insertCrossRef: (attrs: {
    targetId: string;
    refKind: 'section' | 'footnote';
    label: string;
    pageNumber: number;
    formattedPage: string;
  }) => void;
  updateFields: () => void;
  setParagraphFlow: (attrs: {
    pageBreakBefore?: boolean;
    keepWithNext?: boolean | null;
    keepLinesTogether?: boolean;
    widowOrphanControl?: boolean;
  }) => void;
  repaginate: () => void;
  openHeaderFooterEditor: (zone: 'header' | 'footer') => void;
  insertTable: (rows?: number, cols?: number) => void;
  insertImage: (src: string, alt?: string) => void;
}

interface TipTapEditorProps {
  initialContent: string;
  manuscriptTitle: string;
  authorLabel: string;
  activeSection: Section;
  footnotes: Footnote[];
  viewMode: DocumentViewMode;
  zoomLevel: number;
  zoomMode: ZoomMode;
  onZoomChange: (newZoom: number, mode?: ZoomMode) => void;
  pageSetup: PageSetupConfig;
  sectionPageSetups?: Record<string, Partial<PageSetupConfig>>;
  journalProfile: JournalProfile;
  useJournalPageSetup: boolean;
  unit: MeasurementUnit;
  showRuler: boolean;
  showFormattingMarks: boolean;
  onContentChange: (html: string, plainText: string, wordCount: number) => void;
  onMarginsChange: (leftCm: number, rightCm: number) => void;
  onUpdateHeaderFooter: (hfPatch: Partial<HeaderFooterConfig>, sectionKey?: string) => void;
  onPaginationChange: (result: PaginationResult, currentPage: number, currentSectionKey: string) => void;
  onSelectFootnote: (fn: Footnote) => void;
  fontSize: string;
  fontFamily: string;
  onEditorReady?: (editor: any) => void;
}

interface EditingZoneState {
  zone: 'header' | 'footer';
  pageNumber: number;
  sectionKey: string;
  slotKey: 'first' | 'even' | 'default';
  draft: HeaderFooterSlot;
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(
  (
    {
      initialContent,
      manuscriptTitle,
      authorLabel,
      footnotes,
      viewMode,
      zoomLevel,
      zoomMode,
      onZoomChange,
      pageSetup,
      sectionPageSetups,
      journalProfile,
      useJournalPageSetup,
      unit,
      showRuler,
      showFormattingMarks,
      onContentChange,
      onMarginsChange,
      onUpdateHeaderFooter,
      onPaginationChange,
      onSelectFootnote,
      fontSize,
      fontFamily,
      onEditorReady,
    },
    ref
  ) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cacheRef = useRef<PaginationCache>(new PaginationCache());
    const idleTimerRef = useRef<number | null>(null);
    const fontsReadyRef = useRef<boolean>(false);

    const [pagination, setPagination] = useState<PaginationResult | null>(null);
    const [currentPageNum, setCurrentPageNum] = useState<number>(1);
    const [scrollTopPx, setScrollTopPx] = useState<number>(0);
    const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
      width: 960,
      height: 760,
    });
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const [editingZone, setEditingZone] = useState<EditingZoneState | null>(null);

    const effectiveDefaultSetup = useMemo(
      () =>
        resolveEffectivePageSetup(
          pageSetup,
          journalProfile,
          useJournalPageSetup,
          undefined
        ),
      [pageSetup, journalProfile, useJournalPageSetup]
    );
    const defaultMetrics = useMemo(
      () => resolvePageMetrics(effectiveDefaultSetup, 1),
      [effectiveDefaultSetup]
    );

    const isPagedView = viewMode !== 'draft';
    const scale = Math.max(0.25, Math.min(5, zoomLevel / 100));

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
        }),
        Heading.configure({ levels: [1, 2, 3, 4] }).extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              id: {
                default: null,
                parseHTML: element => element.getAttribute('id'),
                renderHTML: attributes => {
                  if (!attributes.id) return {};
                  return { id: attributes.id };
                },
              },
            };
          },
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          defaultAlignment: 'justify',
        }),
        Highlight.configure({
          multicolor: true,
        }),
        Subscript,
        Superscript,
        TextStyle,
        FontFamily,
        Table.configure({
          resizable: true,
          cellMinWidth: 50,
          handleWidth: 6,
          lastColumnResizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: 'hm-editor-image',
          },
        }),
        PageBreakNode,
        SectionBreakNode,
        TocFieldNode,
        CrossRefNode,
        ParagraphFlowExtension,
        PaginationPluginExtension,
      ],
      content: initialContent,
      editable: viewMode !== 'read',
      editorProps: {
        attributes: {
          class: `focus:outline-none text-justify selection:bg-amber-200 ${
            showFormattingMarks ? 'hm-show-marks' : ''
          } ${viewMode === 'draft' ? 'hm-draft-surface' : ''}`,
          style: `font-size: ${fontSize}; font-family: ${getFontCssStack(fontFamily)};`,
        },
        handleKeyDown: (_view, event) => {
          if (event.key === 'PageDown' || event.key === 'PageUp') {
            if (isPagedView && pagination && pagination.pages.length > 0) {
              event.preventDefault();
              const target =
                event.key === 'PageDown'
                  ? Math.min(pagination.pages.length, currentPageNum + 1)
                  : Math.max(1, currentPageNum - 1);
              scrollToPageInternal(target);
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        const html = currentEditor.getHTML();
        const text = currentEditor.getText();
        const matches = text.trim().match(/\b[\w'-]+\b/g);
        const wordCount = matches ? matches.length : 0;
        onContentChange(html, text, wordCount);
        scheduleRepagination();
      },
    });

    // Keep editable state synced with Read Mode
    useEffect(() => {
      if (!editor) return;
      editor.setEditable(viewMode !== 'read');
    }, [editor, viewMode]);

    // Update editor attributes when font / formatting marks / draft view change
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `focus:outline-none text-justify selection:bg-amber-200 ${
              showFormattingMarks ? 'hm-show-marks' : ''
            } ${viewMode === 'draft' ? 'hm-draft-surface' : ''}`,
            style: `font-size: ${fontSize}; font-family: ${getFontCssStack(fontFamily)};`,
          },
        },
      });
    }, [editor, fontSize, fontFamily, showFormattingMarks, viewMode]);

    const scrollToPageInternal = useCallback(
      (pageNumber: number) => {
        const container = scrollContainerRef.current;
        if (!container || !pagination) return;
        const targetPage = pagination.pages.find(p => p.pageNumber === pageNumber);
        if (!targetPage) return;
        const targetTop = targetPage.topPx * scale;
        container.scrollTo({
          top: Math.max(0, targetTop - 12),
          behavior: 'smooth',
        });
        setCurrentPageNum(pageNumber);
      },
      [pagination, scale]
    );

    const runRepaginationNow = useCallback(() => {
      if (!editor || editor.isDestroyed || !editor.view) return;
      const result = computeDocumentPagination({
        view: editor.view,
        baseSetup: pageSetup,
        journalProfile,
        useJournalOverride: useJournalPageSetup,
        sectionPageSetups,
        footnotes,
        fontSize,
        fontFamily,
        cache: cacheRef.current,
      });

      setPagination(result);

      // Dispatch decoration spacers without adding to undo history
      const tr = editor.view.state.tr;
      tr.setMeta('addToHistory', false);
      tr.setMeta(PAGINATION_PLUGIN_KEY, {
        spacers: result.spacers,
        showFormattingMarks,
        isDraftMode: viewMode === 'draft',
      });
      editor.view.dispatch(tr);

      const safeCurrPage = Math.min(currentPageNum, Math.max(1, result.totalPages));
      const activePg = result.pages[safeCurrPage - 1];
      onPaginationChange(result, safeCurrPage, activePg?.sectionKey || 'default');
    }, [
      editor,
      pageSetup,
      journalProfile,
      useJournalPageSetup,
      sectionPageSetups,
      footnotes,
      fontSize,
      fontFamily,
      showFormattingMarks,
      viewMode,
      currentPageNum,
      onPaginationChange,
    ]);

    const runRepaginationRef = useRef(runRepaginationNow);
    runRepaginationRef.current = runRepaginationNow;

    const scheduleRepagination = useCallback(() => {
      if (idleTimerRef.current !== null) {
        if ('cancelIdleCallback' in window && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleTimerRef.current);
        } else {
          window.clearTimeout(idleTimerRef.current);
        }
      }

      if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
        idleTimerRef.current = window.requestIdleCallback(
          () => {
            idleTimerRef.current = null;
            runRepaginationRef.current();
          },
          { timeout: 140 }
        );
      } else {
        idleTimerRef.current = window.setTimeout(() => {
          idleTimerRef.current = null;
          runRepaginationRef.current();
        }, 50);
      }
    }, []);

    // Wait for document.fonts.ready before initial pagination so Times New Roman / Tinos / Bengali glyphs measure accurately
    useEffect(() => {
      let cancelled = false;
      const start = () => {
        if (cancelled) return;
        fontsReadyRef.current = true;
        runRepaginationRef.current();
      };
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(start).catch(start);
      } else {
        start();
      }
      return () => {
        cancelled = true;
      };
    }, []);

    // Re-paginate whenever layout props, footnotes, font, marks, or viewMode change
    useEffect(() => {
      if (!editor) return;
      if (fontsReadyRef.current) {
        const id = window.requestAnimationFrame(() => runRepaginationRef.current());
        return () => window.cancelAnimationFrame(id);
      }
    }, [
      editor,
      pageSetup,
      sectionPageSetups,
      journalProfile,
      useJournalPageSetup,
      footnotes,
      fontSize,
      fontFamily,
      showFormattingMarks,
      viewMode,
    ]);

    // Auto-update TOC & Cross-reference fields in ProseMirror doc
    const updateFieldsInternal = useCallback(() => {
      if (!editor || editor.isDestroyed) return;
      const latest = computeDocumentPagination({
        view: editor.view,
        baseSetup: pageSetup,
        journalProfile,
        useJournalOverride: useJournalPageSetup,
        sectionPageSetups,
        footnotes,
        fontSize,
        fontFamily,
        cache: cacheRef.current,
      });

      const { tr } = editor.view.state;
      let changed = false;

      editor.view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'tocField') {
          const nextEntriesStr = JSON.stringify(latest.tocEntries);
          if (node.attrs.entries !== nextEntriesStr) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              entries: nextEntriesStr,
            });
            changed = true;
          }
        } else if (node.type.name === 'crossRef') {
          const targetId = node.attrs.targetId;
          const refKind = node.attrs.refKind;
          if (refKind === 'section' && latest.headingPageMap[targetId]) {
            const info = latest.headingPageMap[targetId];
            if (
              node.attrs.pageNumber !== info.pageNumber ||
              node.attrs.formattedPage !== info.formattedPage
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                pageNumber: info.pageNumber,
                formattedPage: info.formattedPage,
              });
              changed = true;
            }
          } else if (refKind === 'footnote') {
            const origNum = parseInt(targetId, 10);
            const info = latest.footnotePageMap[origNum];
            if (
              info &&
              (node.attrs.pageNumber !== info.pageNumber ||
                node.attrs.formattedPage !== info.formattedPage)
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                label: `n ${info.displayNumber}`,
                pageNumber: info.pageNumber,
                formattedPage: info.formattedPage,
              });
              changed = true;
            }
          }
        }
      });

      if (changed) {
        editor.view.dispatch(tr);
      }
      scheduleRepagination();
    }, [
      editor,
      pageSetup,
      journalProfile,
      useJournalPageSetup,
      sectionPageSetups,
      footnotes,
      fontSize,
      fontFamily,
      scheduleRepagination,
    ]);

    // Track scroll container viewport dimensions for zoom fit modes & page virtualization
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          setViewportSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      ro.observe(container);
      return () => ro.disconnect();
    }, []);

    // Recompute fit-width / whole-page / two-pages zoom automatically when zoomMode != 'custom'
    useEffect(() => {
      if (zoomMode === 'custom') return;
      const availW = Math.max(320, viewportSize.width - 56);
      const availH = Math.max(320, viewportSize.height - 64);
      let nextPct = zoomLevel;

      if (zoomMode === 'fit-width') {
        nextPct = Math.round((availW / defaultMetrics.widthPx) * 100);
      } else if (zoomMode === 'whole-page') {
        const byW = availW / defaultMetrics.widthPx;
        const byH = availH / defaultMetrics.heightPx;
        nextPct = Math.round(Math.min(byW, byH) * 100);
      } else if (zoomMode === 'two-pages') {
        nextPct = Math.round(((availW - 24) / (defaultMetrics.widthPx * 2)) * 100);
      }

      nextPct = Math.max(25, Math.min(500, nextPct));
      if (Math.abs(nextPct - zoomLevel) >= 1) {
        onZoomChange(nextPct, zoomMode);
      }
    }, [
      zoomMode,
      viewportSize,
      defaultMetrics.widthPx,
      defaultMetrics.heightPx,
      zoomLevel,
      onZoomChange,
    ]);

    // Print listener so all virtualized pages are temporarily mounted during PDF export
    useEffect(() => {
      const onBeforePrint = () => setIsPrinting(true);
      const onAfterPrint = () => setIsPrinting(false);
      window.addEventListener('beforeprint', onBeforePrint);
      window.addEventListener('afterprint', onAfterPrint);
      return () => {
        window.removeEventListener('beforeprint', onBeforePrint);
        window.removeEventListener('afterprint', onAfterPrint);
      };
    }, []);

    // Ctrl + Mouse Wheel / Trackpad pinch zoom inside canvas
    useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 10 : -10;
          const next = Math.max(25, Math.min(500, zoomLevel + delta));
          onZoomChange(next, 'custom');
        }
      };
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, [zoomLevel, onZoomChange]);

    // Update currentPageNum as user scrolls
    const handleScroll = useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const top = container.scrollTop;
      setScrollTopPx(top);

      if (pagination && pagination.pages.length > 0) {
        const logicalMid = (top + viewportSize.height * 0.35) / scale;
        let detected = pagination.pages[0];
        for (const pg of pagination.pages) {
          if (logicalMid >= pg.topPx - PAGE_GAP_PX / 2) {
            detected = pg;
          } else {
            break;
          }
        }
        if (detected && detected.pageNumber !== currentPageNum) {
          setCurrentPageNum(detected.pageNumber);
          onPaginationChange(pagination, detected.pageNumber, detected.sectionKey);
        }
      }
    }, [pagination, viewportSize.height, scale, currentPageNum, onPaginationChange]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      insertCitation: (citationText: string) => {
        if (!editor) return;
        if (citationText.startsWith('[fn') || citationText.startsWith('[')) {
          editor.chain().focus().insertContent(`<sup>${citationText}</sup> `).run();
        } else {
          editor.chain().focus().insertContent(` ${citationText} `).run();
        }
        scheduleRepagination();
      },
      insertHtml: (html: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(html).run();
        scheduleRepagination();
      },
      setContent: (htmlOrText: string) => {
        if (!editor) return;
        editor.commands.setContent(htmlOrText);
        scheduleRepagination();
      },
      getHtml: () => editor?.getHTML() || '',
      getText: () => editor?.getText() || '',
      scrollToSection: (sectionId: string) => {
        const el =
          document.getElementById(sectionId) ||
          document.querySelector(`[data-section-id="${sectionId}"]`) ||
          document.getElementById(`sec-${sectionId}`);

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('transition-all', 'duration-300', 'bg-blue-50/80', 'rounded', 'p-1');
          setTimeout(() => {
            el.classList.remove('bg-blue-50/80', 'p-1');
          }, 1800);
        }
      },
      scrollToPage: (pageNumber: number) => {
        scrollToPageInternal(pageNumber);
      },
      insertPageBreak: () => {
        editor?.chain().focus().insertPageBreak().run();
        scheduleRepagination();
      },
      insertSectionBreak: (breakType = 'next-page') => {
        editor?.chain().focus().insertSectionBreak(breakType).run();
        scheduleRepagination();
      },
      insertToc: () => {
        if (!editor) return;
        const entries = pagination?.tocEntries || [];
        editor.chain().focus().insertTocField(entries).run();
        scheduleRepagination();
      },
      insertCrossRef: attrs => {
        editor?.chain().focus().insertCrossRef(attrs).run();
        scheduleRepagination();
      },
      updateFields: () => {
        updateFieldsInternal();
      },
      setParagraphFlow: attrs => {
        editor?.chain().focus().setParagraphFlow(attrs).run();
        scheduleRepagination();
      },
      repaginate: () => {
        runRepaginationNow();
      },
      openHeaderFooterEditor: (zone: 'header' | 'footer') => {
        const pg = pagination?.pages[currentPageNum - 1] || pagination?.pages[0];
        if (!pg) return;
        const active = getActiveHeaderFooterSlots(
          pg.setup.headerFooter,
          pg.pageIndexInSection,
          pg.pageNumber
        );
        setEditingZone({
          zone,
          pageNumber: pg.pageNumber,
          sectionKey: pg.sectionKey,
          slotKey: active.slotKey,
          draft: { ...(zone === 'header' ? active.header : active.footer) },
        });
      },
      insertTable: (rows = 3, cols = 3) => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        scheduleRepagination();
      },
      insertImage: (src: string, alt = 'Inserted Chart') => {
        if (!editor) return;
        editor.chain().focus().setImage({ src, alt }).run();
        setTimeout(() => scheduleRepagination(), 80);
      },
    }));

    useEffect(() => {
      if (editor && onEditorReady) {
        onEditorReady(editor);
      }
    }, [editor, onEditorReady]);

    // Computed pages fallback before first measurement completes
    const pages: ComputedPageInfo[] = useMemo(() => {
      if (pagination && pagination.pages.length > 0) return pagination.pages;
      return [
        {
          pageIndex: 0,
          pageNumber: 1,
          sectionIndex: 0,
          sectionKey: 'default',
          pageIndexInSection: 0,
          displayPageNumber: effectiveDefaultSetup.headerFooter.startAt || 1,
          formattedPageNumber: '1',
          numberFormat: effectiveDefaultSetup.headerFooter.numberFormat,
          setup: effectiveDefaultSetup,
          metrics: defaultMetrics,
          topPx: 0,
          heightPx: defaultMetrics.heightPx,
          bodyTopPx: defaultMetrics.marginTopPx,
          bodyMaxBottomPx: defaultMetrics.heightPx - defaultMetrics.marginBottomPx,
          footnotes: [],
          footnotesHeightPx: 0,
          previewTitle: manuscriptTitle,
          previewExcerpt: '',
          startPos: 0,
          endPos: 0,
          lineOffsetsY: [],
        },
      ];
    }, [pagination, effectiveDefaultSetup, defaultMetrics, manuscriptTitle]);

    const totalPages = pages.length;
    const totalStageHeightPx = useMemo(() => {
      const last = pages[pages.length - 1];
      return last ? last.topPx + last.heightPx : defaultMetrics.heightPx;
    }, [pages, defaultMetrics.heightPx]);

    // Virtualize rendered page cards (visible window + 2 page buffer), disabled during print
    const visiblePages = useMemo(() => {
      if (isPrinting || pages.length <= 6) return pages;
      const logicalTop = scrollTopPx / scale;
      const logicalBottom = (scrollTopPx + viewportSize.height) / scale;
      const bufferPx = defaultMetrics.heightPx * 2.2;
      return pages.filter(
        pg =>
          pg.topPx + pg.heightPx >= logicalTop - bufferPx &&
          pg.topPx <= logicalBottom + bufferPx
      );
    }, [isPrinting, pages, scrollTopPx, scale, viewportSize.height, defaultMetrics.heightPx]);

    const activeRulerMetrics =
      pages[currentPageNum - 1]?.metrics || defaultMetrics;

    const saveInlineHeaderFooter = () => {
      if (!editingZone) return;
      const { zone, slotKey, draft, sectionKey } = editingZone;
      const patch: Partial<HeaderFooterConfig> = {};
      if (zone === 'header') {
        if (slotKey === 'first') patch.firstPageHeader = draft;
        else if (slotKey === 'even') patch.evenPageHeader = draft;
        else patch.defaultHeader = draft;
      } else {
        if (slotKey === 'first') patch.firstPageFooter = draft;
        else if (slotKey === 'even') patch.evenPageFooter = draft;
        else patch.defaultFooter = draft;
      }
      onUpdateHeaderFooter(patch, sectionKey === 'default' ? undefined : sectionKey);
      setEditingZone(null);
    };

    const pageZero = pages[0];
    const editorWidthPx = defaultMetrics.contentWidthPx;
    const dateStr = useMemo(
      () =>
        new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      []
    );

    return (
      <div className="flex-1 flex flex-col h-full bg-slate-300/80 overflow-hidden select-text relative">
        {/* Read Mode Top Banner */}
        {viewMode === 'read' && (
          <div className="bg-slate-800 text-slate-100 px-4 py-1.5 text-xs flex items-center justify-between no-print shrink-0">
            <span>
              <strong>Read Mode</strong> — Editing locked for distraction-free review · Page{' '}
              {currentPageNum} of {totalPages}
            </span>
            <span className="text-[11px] text-slate-300">
              Use PageUp / PageDown or scroll to turn pages
            </span>
          </div>
        )}

        {/* Fixed Top Ruler aligned to zoomed page width */}
        {isPagedView && showRuler && viewMode !== 'read' && (
          <div className="bg-slate-200/95 border-b border-slate-300 flex justify-center pt-1.5 pb-0.5 overflow-hidden no-print shrink-0">
            <div style={{ zoom: scale }}>
              <WordRuler
                widthPx={activeRulerMetrics.widthPx}
                marginLeftPx={activeRulerMetrics.marginLeftPx}
                marginRightPx={activeRulerMetrics.marginRightPx}
                unit={unit}
                zoomLevel={zoomLevel}
                onMarginsChange={onMarginsChange}
              />
            </div>
          </div>
        )}

        {/* Floating Smart Table Bubble Menu (appears when cursor is inside a table cell) */}
        <TableBubbleMenu editor={editor} scrollTarget={scrollContainerRef.current} />

        {/* Scrollable Desk Viewport */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-auto flex flex-col items-center py-6 px-4 hm-print-scroll-reset"
        >
          {viewMode === 'draft' ? (
            /* DRAFT VIEW: Continuous flow without page gaps/headers/footers */
            <div
              className="bg-white text-slate-900 border border-slate-300 shadow-sm w-full max-w-4xl px-12 py-10 rounded-xs hm-print-stage-reset"
              style={{
                zoom: scale,
                fontSize,
                fontFamily: getFontCssStack(fontFamily),
              }}
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 border-b border-slate-200 pb-2 mb-4 select-none">
                Draft View — Continuous Flow
              </div>
              <div className="leading-[1.85] text-slate-900 min-h-[700px]">
                <EditorContent editor={editor} />
              </div>
            </div>
          ) : (
            /* PRINT LAYOUT / READ / FOCUS: Real Multi-Page Desk */
            <div
              className="relative hm-print-stage-reset"
              style={{
                width: `${defaultMetrics.widthPx}px`,
                height: `${totalStageHeightPx}px`,
                zoom: scale,
              }}
            >
              {/* LAYER 1: Virtualized White Page Cards */}
              {visiblePages.map(pg => (
                <div
                  key={`sheet-${pg.pageNumber}`}
                  data-print-page={pg.pageNumber}
                  style={{
                    position: 'absolute',
                    top: `${pg.topPx}px`,
                    left: `${(defaultMetrics.widthPx - pg.metrics.widthPx) / 2}px`,
                    width: `${pg.metrics.widthPx}px`,
                    height: `${pg.heightPx}px`,
                  }}
                  className="bg-white border border-slate-300/90 word-page-shadow rounded-[2px] pointer-events-none"
                >
                  {/* Subtle Corner Crop Marks (MS Word Print Layout style) */}
                  <div
                    className="absolute border-r border-b border-slate-300/60 w-3 h-3"
                    style={{
                      top: `${pg.metrics.marginTopPx - 12}px`,
                      left: `${pg.metrics.marginLeftPx - 12}px`,
                    }}
                  />
                  <div
                    className="absolute border-l border-b border-slate-300/60 w-3 h-3"
                    style={{
                      top: `${pg.metrics.marginTopPx - 12}px`,
                      right: `${pg.metrics.marginRightPx - 12}px`,
                    }}
                  />
                  <div
                    className="absolute border-r border-t border-slate-300/60 w-3 h-3"
                    style={{
                      bottom: `${pg.metrics.marginBottomPx - 12}px`,
                      left: `${pg.metrics.marginLeftPx - 12}px`,
                    }}
                  />
                  <div
                    className="absolute border-l border-t border-slate-300/60 w-3 h-3"
                    style={{
                      bottom: `${pg.metrics.marginBottomPx - 12}px`,
                      right: `${pg.metrics.marginRightPx - 12}px`,
                    }}
                  />

                  {/* Page Edge Indicator Pill on Hover / Subtle Corner Number */}
                  <div className="absolute -right-14 top-2 text-[10px] font-mono text-slate-500/80 select-none no-print hidden xl:block">
                    p.{pg.formattedPageNumber}
                  </div>
                </div>
              ))}

              {/* LAYER 2: Single Continuous TipTap Editor Surface */}
              <div
                className={`relative z-10 ${
                  pageZero.metrics.columns === 2 ? 'hm-cols-2' : ''
                }`}
                style={{
                  paddingTop: `${pageZero.metrics.marginTopPx}px`,
                  paddingLeft: `${pageZero.metrics.marginLeftPx}px`,
                  width: `${pageZero.metrics.marginLeftPx + editorWidthPx}px`,
                  fontSize,
                  fontFamily: getFontCssStack(fontFamily),
                  lineHeight: 1.85,
                  color: '#0f172a',
                }}
              >
                <EditorContent editor={editor} />
              </div>

              {/* LAYER 3: Overlays (Headers, Footers, Per-Page Footnotes, Line Numbers) */}
              {visiblePages.map(pg => {
                const hfSlots = getActiveHeaderFooterSlots(
                  pg.setup.headerFooter,
                  pg.pageIndexInSection,
                  pg.pageNumber
                );
                const resolveCtx = {
                  displayPageNumber: pg.displayPageNumber,
                  totalPages,
                  numberFormat: pg.numberFormat,
                  shortTitle:
                    manuscriptTitle.length > 56
                      ? manuscriptTitle.slice(0, 53) + '...'
                      : manuscriptTitle,
                  author: authorLabel,
                  dateStr,
                };

                const isEditingThisHeader =
                  editingZone?.zone === 'header' && editingZone.pageNumber === pg.pageNumber;
                const isEditingThisFooter =
                  editingZone?.zone === 'footer' && editingZone.pageNumber === pg.pageNumber;

                const offsetLeft = (defaultMetrics.widthPx - pg.metrics.widthPx) / 2;

                return (
                  <React.Fragment key={`overlay-${pg.pageNumber}`}>
                    {/* Header Zone (Double-click to edit) */}
                    <div
                      data-print-page={pg.pageNumber}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        if (viewMode === 'read') return;
                        setEditingZone({
                          zone: 'header',
                          pageNumber: pg.pageNumber,
                          sectionKey: pg.sectionKey,
                          slotKey: hfSlots.slotKey,
                          draft: { ...hfSlots.header },
                        });
                      }}
                      title={viewMode !== 'read' ? 'Double-click to edit header' : undefined}
                      style={{
                        position: 'absolute',
                        top: `${pg.topPx + pg.metrics.headerDistancePx}px`,
                        left: `${offsetLeft + pg.metrics.marginLeftPx}px`,
                        width: `${pg.metrics.contentWidthPx}px`,
                        minHeight: '22px',
                      }}
                      className={`z-20 text-[10.5px] font-serif text-slate-500 transition rounded px-1 ${
                        viewMode !== 'read'
                          ? 'cursor-text hover:bg-blue-50/50 hover:ring-1 hover:ring-blue-300/70'
                          : ''
                      } ${
                        isEditingThisHeader
                          ? 'bg-white shadow-lg ring-2 ring-blue-500 p-2 z-30'
                          : 'select-none'
                      }`}
                    >
                      {isEditingThisHeader && editingZone ? (
                        <div className="space-y-1.5 font-sans text-[11px] text-slate-800">
                          <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 uppercase">
                            <span>
                              Editing Header ({editingZone.slotKey} · Section {pg.sectionIndex + 1})
                            </span>
                            <div className="flex items-center gap-1">
                              {['{title}', '{author}', '{date}', '{page}', '{pages}'].map(tok => (
                                <button
                                  key={tok}
                                  type="button"
                                  onClick={() =>
                                    setEditingZone(prev =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: {
                                              ...prev.draft,
                                              right: prev.draft.right
                                                ? `${prev.draft.right} ${tok}`
                                                : tok,
                                            },
                                          }
                                        : null
                                    )
                                  }
                                  className="px-1 py-0.5 bg-slate-100 hover:bg-blue-100 rounded text-[9px] font-mono"
                                >
                                  {tok}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={saveInlineHeaderFooter}
                                className="p-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Save header"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingZone(null)}
                                className="p-0.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input
                              value={editingZone.draft.left}
                              onChange={e =>
                                setEditingZone(prev =>
                                  prev
                                    ? { ...prev, draft: { ...prev.draft, left: e.target.value } }
                                    : null
                                )
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineHeaderFooter();
                                if (e.key === 'Escape') setEditingZone(null);
                              }}
                              placeholder="Left"
                              className="border border-slate-300 rounded px-1.5 py-0.5"
                            />
                            <input
                              value={editingZone.draft.center}
                              onChange={e =>
                                setEditingZone(prev =>
                                  prev
                                    ? { ...prev, draft: { ...prev.draft, center: e.target.value } }
                                    : null
                                )
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineHeaderFooter();
                                if (e.key === 'Escape') setEditingZone(null);
                              }}
                              placeholder="Centre"
                              className="border border-slate-300 rounded px-1.5 py-0.5 text-center"
                            />
                            <input
                              value={editingZone.draft.right}
                              onChange={e =>
                                setEditingZone(prev =>
                                  prev
                                    ? { ...prev, draft: { ...prev.draft, right: e.target.value } }
                                    : null
                                )
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineHeaderFooter();
                                if (e.key === 'Escape') setEditingZone(null);
                              }}
                              placeholder="Right"
                              className="border border-slate-300 rounded px-1.5 py-0.5 text-right"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 items-center border-b border-slate-200/70 pb-1">
                          <span className="truncate italic text-left">
                            {resolveFieldTokens(hfSlots.header.left, resolveCtx)}
                          </span>
                          <span className="truncate text-center">
                            {resolveFieldTokens(hfSlots.header.center, resolveCtx)}
                          </span>
                          <span className="truncate text-right font-sans text-[9.5px] uppercase tracking-wider text-slate-400">
                            {resolveFieldTokens(hfSlots.header.right, resolveCtx)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Line Numbers Gutter Overlay (restarting at 1 on each page) */}
                    {pg.setup.lineNumbers && pg.lineOffsetsY.length > 0 && (
                      <div
                        data-print-page={pg.pageNumber}
                        className="z-20 pointer-events-none select-none font-mono text-[9.5px] text-slate-400"
                        style={{
                          position: 'absolute',
                          top: `${pg.topPx}px`,
                          left: `${offsetLeft + Math.max(6, pg.metrics.marginLeftPx - 36)}px`,
                          width: '26px',
                          height: `${pg.heightPx}px`,
                        }}
                      >
                        {pg.lineOffsetsY.map((yRel, idx) => (
                          <div
                            key={idx}
                            style={{ position: 'absolute', top: `${yRel + 3}px`, right: 0 }}
                          >
                            {idx + 1}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Per-Page Footnotes Area (above separator line, reducing body space) */}
                    {pg.footnotes.length > 0 && (
                      <div
                        data-print-page={pg.pageNumber}
                        style={{
                          position: 'absolute',
                          top: `${
                            pg.topPx +
                            pg.heightPx -
                            pg.metrics.marginBottomPx -
                            pg.footnotesHeightPx
                          }px`,
                          left: `${offsetLeft + pg.metrics.marginLeftPx}px`,
                          width: `${pg.metrics.contentWidthPx}px`,
                          height: `${pg.footnotesHeightPx}px`,
                        }}
                        className="z-20 bg-white/95 pt-1 overflow-hidden select-text"
                      >
                        <div className="w-28 h-px bg-slate-800 mb-1.5" />
                        <div className="space-y-1 text-[10px] font-serif text-slate-800 leading-[15px]">
                          {pg.footnotes.map((fn, idx) => (
                            <div
                              key={`${fn.id}-${idx}`}
                              onClick={() => fn.footnoteObj && onSelectFootnote(fn.footnoteObj)}
                              className="flex items-start gap-1.5 hover:bg-blue-50/70 rounded px-0.5 cursor-pointer transition"
                            >
                              <span className="font-sans font-bold text-[9.5px] text-slate-900 shrink-0 min-w-[16px]">
                                {fn.displayNumber}.
                              </span>
                              <span className="flex-1">
                                {fn.content}
                                {fn.continuesToNextPage && (
                                  <em className="text-[9px] text-slate-400 ml-1 font-sans">
                                    [continues…]
                                  </em>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Zone (Double-click to edit) */}
                    <div
                      data-print-page={pg.pageNumber}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        if (viewMode === 'read') return;
                        setEditingZone({
                          zone: 'footer',
                          pageNumber: pg.pageNumber,
                          sectionKey: pg.sectionKey,
                          slotKey: hfSlots.slotKey,
                          draft: { ...hfSlots.footer },
                        });
                      }}
                      title={viewMode !== 'read' ? 'Double-click to edit footer' : undefined}
                      style={{
                        position: 'absolute',
                        top: `${
                          pg.topPx + pg.heightPx - pg.metrics.footerDistancePx - 22
                        }px`,
                        left: `${offsetLeft + pg.metrics.marginLeftPx}px`,
                        width: `${pg.metrics.contentWidthPx}px`,
                        minHeight: '22px',
                      }}
                      className={`z-20 text-[10.5px] font-serif text-slate-500 transition rounded px-1 ${
                        viewMode !== 'read'
                          ? 'cursor-text hover:bg-blue-50/50 hover:ring-1 hover:ring-blue-300/70'
                          : ''
                      } ${
                        isEditingThisFooter
                          ? 'bg-white shadow-lg ring-2 ring-blue-500 p-2 z-30'
                          : 'select-none'
                      }`}
                    >
                      {isEditingThisFooter && editingZone ? (
                        <div className="space-y-1.5 font-sans text-[11px] text-slate-800">
                          <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 uppercase">
                            <span>
                              Editing Footer ({editingZone.slotKey} · Section {pg.sectionIndex + 1})
                            </span>
                            <div className="flex items-center gap-1">
                              {['Page {page} of {pages}', '{page}', '{title}', '{date}'].map(tok => (
                                <button
                                  key={tok}
                                  type="button"
                                  onClick={() =>
                                    setEditingZone(prev =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: {
                                              ...prev.draft,
                                              right: tok,
                                            },
                                          }
                                        : null
                                    )
                                  }
                                  className="px-1 py-0.5 bg-slate-100 hover:bg-blue-100 rounded text-[9px] font-mono"
                                >
                                  {tok}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={saveInlineHeaderFooter}
                                className="p-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Save footer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingZone(null)}
                                className="p-0.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input
                              value={editingZone.draft.left}
                              onChange={e =>
                                setEditingZone(prev =>
                                  prev
                                    ? { ...prev, draft: { ...prev.draft, left: e.target.value } }
                                    : null
                                )
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineHeaderFooter();
                                if (e.key === 'Escape') setEditingZone(null);
                              }}
                              placeholder="Left"
                              className="border border-slate-300 rounded px-1.5 py-0.5"
                            />
                            <input
                              value={editingZone.draft.center}
                              onChange={e =>
                                setEditingZone(prev =>
                                  prev
                                    ? { ...prev, draft: { ...prev.draft, center: e.target.value } }
                                    : null
                                )
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineHeaderFooter();
                                if (e.key === 'Escape') setEditingZone(null);
                              }}
                              placeholder="Centre"
                              className="border border-slate-300 rounded px-1.5 py-0.5 text-center"
                            />
                            <input
                              value={editingZone.draft.right}
                              onChange={e =>
                                setEditingZone(prev =>
                                  prev
                                    ? { ...prev, draft: { ...prev.draft, right: e.target.value } }
                                    : null
                                )
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineHeaderFooter();
                                if (e.key === 'Escape') setEditingZone(null);
                              }}
                              placeholder="Right"
                              className="border border-slate-300 rounded px-1.5 py-0.5 text-right"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 items-center border-t border-slate-200/70 pt-1">
                          <span className="truncate text-left">
                            {resolveFieldTokens(hfSlots.footer.left, resolveCtx)}
                          </span>
                          <span className="truncate text-center">
                            {resolveFieldTokens(hfSlots.footer.center, resolveCtx)}
                          </span>
                          <span className="truncate text-right font-mono text-[10px]">
                            {resolveFieldTokens(hfSlots.footer.right, resolveCtx)}
                          </span>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);
