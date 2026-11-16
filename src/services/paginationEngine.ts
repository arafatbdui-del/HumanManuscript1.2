/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Incremental Multi-Page Pagination Engine for TipTap / ProseMirror
 *
 * Features:
 * - Unscaled layout measurement (offsetTop / offsetHeight) immune to CSS zoom
 * - Line-level paragraph splitting with Widow/Orphan control (min 2 lines each side)
 * - keepWithNext, keepLinesTogether, pageBreakBefore, PageBreak, SectionBreak (next-page / continuous)
 * - Per-page footnote placement, space deduction, automatic reading-order renumbering, and long-footnote continuation
 * - Per-page line numbering anchors (restarting at 1 on each page)
 * - Live Heading & Footnote page maps for TOC, Cross-References, Navigation Thumbnails, and Go To
 * - Incremental block measurement cache off the typing path
 */

import { EditorView } from '@tiptap/pm/view';
import {
  Footnote,
  JournalProfile,
  PageNumberFormat,
  PageSetupConfig,
} from '../types/manuscript';
import {
  PAGE_GAP_PX,
  formatPageNumber,
  resolveEffectivePageSetup,
  resolvePageMetrics,
  ResolvedPageMetrics,
} from './pageLayout';
import { SpacerDecorationSpec, TocEntry } from '../components/editor/extensions/PaginationExtensions';

export interface PageFootnoteRenderItem {
  id: string;
  originalNumber: number;
  displayNumber: number;
  content: string;
  isContinuation?: boolean;
  continuesToNextPage?: boolean;
  footnoteObj?: Footnote;
}

export interface ComputedPageInfo {
  pageIndex: number; // 0-based
  pageNumber: number; // 1-based global physical page
  sectionIndex: number;
  sectionKey: string;
  pageIndexInSection: number; // 0-based within section
  displayPageNumber: number; // respects startAt & restartNumbering
  formattedPageNumber: string;
  numberFormat: PageNumberFormat;
  setup: PageSetupConfig;
  metrics: ResolvedPageMetrics;
  topPx: number;
  heightPx: number;
  bodyTopPx: number;
  bodyMaxBottomPx: number;
  footnotes: PageFootnoteRenderItem[];
  footnotesHeightPx: number;
  previewTitle: string;
  previewExcerpt: string;
  startPos: number;
  endPos: number;
  lineOffsetsY: number[]; // Y positions (relative to page top) for line numbers restarting on each page
}

export interface PaginationResult {
  pages: ComputedPageInfo[];
  spacers: SpacerDecorationSpec[];
  totalPages: number;
  headingPageMap: Record<string, { pageNumber: number; formattedPage: string; title: string; level: number }>;
  footnotePageMap: Record<number, { pageNumber: number; formattedPage: string; displayNumber: number; footnoteId: string }>;
  tocEntries: TocEntry[];
  footnoteDisplayMap: Record<number, number>; // original footnote number -> reading-order number
}

export interface CachedBlockMetrics {
  key: string;
  height: number;
  marginTop: number;
  marginBottom: number;
  footnoteNums: number[];
  lineCountEstimate: number;
  lineOffsetsRel: number[];
}

export class PaginationCache {
  private blockCache = new Map<string, CachedBlockMetrics>();
  private lastLayoutKey = '';

  clearIfLayoutChanged(layoutKey: string) {
    if (this.lastLayoutKey !== layoutKey) {
      this.blockCache.clear();
      this.lastLayoutKey = layoutKey;
    }
  }

  get(key: string): CachedBlockMetrics | undefined {
    return this.blockCache.get(key);
  }

  set(key: string, val: CachedBlockMetrics) {
    if (this.blockCache.size > 4000) {
      // Bound memory for very large manuscripts on 8GB laptops
      const firstKey = this.blockCache.keys().next().value;
      if (firstKey !== undefined) this.blockCache.delete(firstKey);
    }
    this.blockCache.set(key, val);
  }
}

interface VisualLine {
  topRel: number;
  bottomRel: number;
}

const FOOTNOTE_SEPARATOR_PX = 18;
const FOOTNOTE_LINE_PX = 16;
const FOOTNOTE_ITEM_GAP_PX = 5;

function getBlockFootnoteRefs(text: string): number[] {
  const nums: number[] = [];
  const regex = /\[fn(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) nums.push(n);
  }
  return nums;
}

function estimateFootnoteHeight(
  text: string,
  contentWidthPx: number
): { totalHeight: number; lines: string[] } {
  // ~10pt serif averages ~6.2px per char
  const charsPerLine = Math.max(36, Math.floor(contentWidthPx / 6.3));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= charsPerLine) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push('');
  return {
    totalHeight: lines.length * FOOTNOTE_LINE_PX + FOOTNOTE_ITEM_GAP_PX,
    lines,
  };
}

/**
 * Temporarily hides any active .hm-page-spacer inside `el` to measure natural un-spaced geometry.
 * Runs synchronously within a single frame so zero visual flicker occurs.
 */
function withNaturalBlockDom<T>(el: HTMLElement, fn: () => T): T {
  const spacers = Array.from(el.querySelectorAll('.hm-page-spacer')) as HTMLElement[];
  if (spacers.length === 0) return fn();
  const prevDisplays = spacers.map(s => s.style.display);
  for (const s of spacers) s.style.display = 'none';
  try {
    return fn();
  } finally {
    spacers.forEach((s, idx) => {
      s.style.display = prevDisplays[idx];
    });
  }
}

/**
 * Measures visual lines of a textblock element using Range.getClientRects(),
 * normalized against editorEl scale so zoom never distorts line heights.
 */
function measureElementLines(el: HTMLElement, editorEl: HTMLElement): VisualLine[] {
  const rectScale =
    editorEl.offsetHeight > 0
      ? editorEl.getBoundingClientRect().height / editorEl.offsetHeight
      : 1;
  const safeScale = rectScale > 0.05 ? rectScale : 1;

  const elRect = el.getBoundingClientRect();
  const elTop = elRect.top;

  const range = document.createRange();
  range.selectNodeContents(el);
  const rawRects = Array.from(range.getClientRects()).filter(r => r.height > 1 && r.width > 0);
  if (rawRects.length === 0) {
    const h = el.offsetHeight;
    return h > 0 ? [{ topRel: 0, bottomRel: h }] : [];
  }

  // Group rects with overlapping vertical coordinates into visual lines
  const lines: VisualLine[] = [];
  for (const r of rawRects) {
    const topRel = (r.top - elTop) / safeScale;
    const bottomRel = (r.bottom - elTop) / safeScale;
    const mid = (topRel + bottomRel) / 2;

    const existing = lines.find(
      l => mid >= l.topRel - 3 && mid <= l.bottomRel + 3
    );
    if (existing) {
      existing.topRel = Math.min(existing.topRel, topRel);
      existing.bottomRel = Math.max(existing.bottomRel, bottomRel);
    } else {
      lines.push({ topRel, bottomRel });
    }
  }

  lines.sort((a, b) => a.topRel - b.topRel);
  return lines;
}

/**
 * Finds the exact ProseMirror position of the first character on `targetLineIdx` inside a textblock node.
 * Uses binary search over character offsets (<= 11 iterations even for a 2,000-char paragraph).
 */
function findPosForLineStart(
  view: EditorView,
  blockPos: number,
  blockNode: any,
  el: HTMLElement,
  editorEl: HTMLElement,
  targetLineTopRel: number
): number | null {
  const textLen = blockNode.content.size;
  if (textLen < 2) return null;

  const rectScale =
    editorEl.offsetHeight > 0
      ? editorEl.getBoundingClientRect().height / editorEl.offsetHeight
      : 1;
  const safeScale = rectScale > 0.05 ? rectScale : 1;
  const elTop = el.getBoundingClientRect().top;

  const getOffsetTopRel = (relOffset: number): number | null => {
    try {
      const clamped = Math.max(1, Math.min(textLen, relOffset));
      const absPos = blockPos + 1 + clamped;
      const domPos = view.domAtPos(absPos);
      const r = document.createRange();
      if (domPos.node.nodeType === Node.TEXT_NODE) {
        const len = (domPos.node.textContent || '').length;
        const off = Math.min(Math.max(0, domPos.offset), Math.max(0, len - 1));
        r.setStart(domPos.node, off);
        r.setEnd(domPos.node, Math.min(len, off + 1));
      } else {
        r.selectNodeContents(domPos.node);
      }
      const rects = r.getClientRects();
      const first = rects[0] || r.getBoundingClientRect();
      if (!first || first.height === 0) return null;
      return (first.top - elTop) / safeScale;
    } catch {
      return null;
    }
  };

  let lo = 0;
  let hi = textLen - 1;
  let best = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const topRel = getOffsetTopRel(mid);
    if (topRel === null) {
      lo = mid + 1;
      continue;
    }
    if (topRel >= targetLineTopRel - 3) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  if (best <= 0) return null;
  const absResult = blockPos + 1 + best;
  if (absResult <= blockPos + 1 || absResult >= blockPos + blockNode.nodeSize - 1) {
    return null;
  }
  return absResult;
}

export function computeDocumentPagination(params: {
  view: EditorView;
  baseSetup: PageSetupConfig;
  journalProfile?: JournalProfile;
  useJournalOverride?: boolean;
  sectionPageSetups?: Record<string, Partial<PageSetupConfig>>;
  footnotes: Footnote[];
  fontSize: string;
  fontFamily: string;
  cache: PaginationCache;
}): PaginationResult {
  const {
    view,
    baseSetup,
    journalProfile,
    useJournalOverride,
    sectionPageSetups,
    footnotes,
    fontSize,
    fontFamily,
    cache,
  } = params;

  const doc = view.state.doc;
  const editorEl = view.dom as HTMLElement;

  const layoutKey = JSON.stringify({
    baseSetup,
    useJournalOverride,
    journalSetup: useJournalOverride ? journalProfile?.pageSetupOverride : null,
    sectionPageSetups,
    fontSize,
    fontFamily,
  });
  cache.clearIfLayoutChanged(layoutKey);

  // Build quick lookup of footnotes by number
  const footnoteByNumber = new Map<number, Footnote>();
  for (const fn of footnotes) {
    footnoteByNumber.set(fn.number, fn);
  }

  // Collect top-level blocks in document order
  interface DocBlock {
    index: number;
    pos: number;
    node: any;
    el: HTMLElement | null;
    height: number;
    marginTop: number;
    marginBottom: number;
    footnoteRefs: number[];
    lines: VisualLine[];
    isPageBreak: boolean;
    isSectionBreak: boolean;
    sectionBreakType?: 'next-page' | 'continuous';
    sectionKey?: string;
    pageBreakBefore: boolean;
    keepWithNext: boolean;
    keepLinesTogether: boolean;
    widowOrphanControl: boolean;
    isHeading: boolean;
    headingLevel: number;
    headingId: string;
    text: string;
  }

  const blocks: DocBlock[] = [];
  let childOffset = 0;

  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const pos = childOffset;
    childOffset += node.nodeSize;

    const isPageBreak = node.type.name === 'pageBreak';
    const isSectionBreak = node.type.name === 'sectionBreak';
    const isHeading = node.type.name === 'heading';
    const text = node.textContent || '';

    const el = view.nodeDOM(pos) as HTMLElement | null;

    // Cache key incorporates content size, text signature, and node attrs
    const cacheKey = `${node.type.name}:${node.nodeSize}:${text.slice(0, 24)}:${text.slice(-24)}:${JSON.stringify(node.attrs)}`;
    let cached = cache.get(cacheKey);

    let height = 24;
    let marginTop = 0;
    let marginBottom = 8;
    let lines: VisualLine[] = [];

    if (el && el.nodeType === Node.ELEMENT_NODE) {
      const bypassCache =
        node.type.name === 'table' ||
        node.type.name === 'image' ||
        !!el.querySelector('img');
      if (cached && !bypassCache) {
        height = cached.height;
        marginTop = cached.marginTop;
        marginBottom = cached.marginBottom;
        lines = cached.lineOffsetsRel.map((t, idx) => ({
          topRel: t,
          bottomRel:
            idx + 1 < cached!.lineOffsetsRel.length
              ? cached!.lineOffsetsRel[idx + 1]
              : cached!.height,
        }));
      } else {
        withNaturalBlockDom(el, () => {
          height = el.offsetHeight || 24;
          const style = window.getComputedStyle(el);
          marginTop = parseFloat(style.marginTop) || 0;
          marginBottom = parseFloat(style.marginBottom) || 0;
          if (node.isTextblock && height > 28) {
            lines = measureElementLines(el, editorEl);
          } else {
            lines = [{ topRel: 0, bottomRel: height }];
          }
        });

        cache.set(cacheKey, {
          key: cacheKey,
          height,
          marginTop,
          marginBottom,
          footnoteNums: getBlockFootnoteRefs(text),
          lineCountEstimate: lines.length,
          lineOffsetsRel: lines.map(l => l.topRel),
        });
      }
    }

    const attrs = node.attrs || {};
    const keepWithNext =
      attrs.keepWithNext === true ||
      (attrs.keepWithNext !== false && isHeading);

    blocks.push({
      index: i,
      pos,
      node,
      el,
      height,
      marginTop,
      marginBottom,
      footnoteRefs: cached ? cached.footnoteNums : getBlockFootnoteRefs(text),
      lines,
      isPageBreak,
      isSectionBreak,
      sectionBreakType: attrs.breakType,
      sectionKey: attrs.sectionKey,
      pageBreakBefore: !!attrs.pageBreakBefore,
      keepWithNext,
      keepLinesTogether: !!attrs.keepLinesTogether,
      widowOrphanControl: attrs.widowOrphanControl !== false,
      isHeading,
      headingLevel: isHeading ? Number(attrs.level || 2) : 0,
      headingId: attrs.id || `heading_${pos}`,
      text,
    });
  }

  // State machine walking blocks into pages
  const pages: ComputedPageInfo[] = [];
  const spacers: SpacerDecorationSpec[] = [];
  const headingPageMap: PaginationResult['headingPageMap'] = {};
  const footnotePageMap: PaginationResult['footnotePageMap'] = {};
  const tocEntries: TocEntry[] = [];
  const footnoteDisplayMap: Record<number, number> = {};
  const seenFootnoteOrigNums = new Set<number>();

  let activeSectionKey = 'default';
  let activeSectionIndex = 0;
  let activeSetup = resolveEffectivePageSetup(
    baseSetup,
    journalProfile,
    useJournalOverride,
    sectionPageSetups?.[activeSectionKey]
  );

  let currentPageIndex = 0;
  let currentPageIndexInSection = 0;
  let currentDisplayNumber = activeSetup.headerFooter.startAt || 1;
  let currentMetrics = resolvePageMetrics(activeSetup, 1);

  let pageTopPx = 0;
  let cursorY = 0; // height used inside current page's body area (0 .. bodyMaxHeight)
  let prevMarginBottom = 0;
  let pageHasContent = false;
  let pageFootnotes: PageFootnoteRenderItem[] = [];
  let pageFootnotesHeightPx = 0;
  let carryoverFootnote: { item: PageFootnoteRenderItem; remainingLines: string[] } | null = null;
  let pageLineOffsetsY: number[] = [];
  let pagePreviewTitle = '';
  let pagePreviewExcerpt = '';
  let pageStartPos = 0;

  const getPageAvailableBodyHeight = (metrics: ResolvedPageMetrics, fnHeight: number) => {
    const multiplier = metrics.columns === 2 ? 2 : 1;
    return Math.max(80, metrics.maxBodyHeightPx * multiplier - fnHeight * multiplier);
  };

  const finalizeCurrentPage = (endPos: number) => {
    const numFmt = activeSetup.headerFooter.numberFormat || '1';
    const formatted = formatPageNumber(currentDisplayNumber, numFmt);
    pages.push({
      pageIndex: currentPageIndex,
      pageNumber: currentPageIndex + 1,
      sectionIndex: activeSectionIndex,
      sectionKey: activeSectionKey,
      pageIndexInSection: currentPageIndexInSection,
      displayPageNumber: currentDisplayNumber,
      formattedPageNumber: formatted,
      numberFormat: numFmt,
      setup: activeSetup,
      metrics: currentMetrics,
      topPx: pageTopPx,
      heightPx: currentMetrics.heightPx,
      bodyTopPx: pageTopPx + currentMetrics.marginTopPx,
      bodyMaxBottomPx: pageTopPx + currentMetrics.heightPx - currentMetrics.marginBottomPx - pageFootnotesHeightPx,
      footnotes: pageFootnotes,
      footnotesHeightPx: pageFootnotesHeightPx,
      previewTitle: pagePreviewTitle || `Page ${currentPageIndex + 1}`,
      previewExcerpt: pagePreviewExcerpt.trim().slice(0, 140),
      startPos: pageStartPos,
      endPos,
      lineOffsetsY: pageLineOffsetsY,
    });
  };

  const advanceToNextPage = (
    breakPos: number,
    isLineSplit: boolean,
    newSectionKey?: string,
    extraAboveMarginPx = 0,
    extraBelowMarginPx = 0
  ) => {
    // Compute rendered height on current page (for 2-column mode, column height is ~half of linear cursorY)
    const renderedLinearHeight =
      currentMetrics.columns === 2 ? Math.ceil(cursorY / 2) : cursorY;
    const remainingBodySpace = Math.max(0, currentMetrics.maxBodyHeightPx - renderedLinearHeight);

    const prevBottomMargin = currentMetrics.marginBottomPx;
    const prevHeight = currentMetrics.heightPx;

    finalizeCurrentPage(breakPos);

    // Switch section setup if entering a new section
    if (newSectionKey !== undefined) {
      activeSectionKey = newSectionKey;
      activeSectionIndex += 1;
      currentPageIndexInSection = 0;
      activeSetup = resolveEffectivePageSetup(
        baseSetup,
        journalProfile,
        useJournalOverride,
        sectionPageSetups?.[activeSectionKey]
      );
      if (activeSetup.headerFooter.restartNumbering) {
        currentDisplayNumber = activeSetup.headerFooter.startAt || 1;
      } else {
        currentDisplayNumber += 1;
      }
    } else {
      currentPageIndexInSection += 1;
      currentDisplayNumber += 1;
    }

    currentPageIndex += 1;
    currentMetrics = resolvePageMetrics(activeSetup, currentPageIndex + 1);
    pageTopPx += prevHeight + PAGE_GAP_PX;

    const nonCollapsingDeduction = isLineSplit
      ? 0
      : extraAboveMarginPx + extraBelowMarginPx;

    const spacerHeightPx = Math.max(
      0,
      remainingBodySpace +
        prevBottomMargin +
        PAGE_GAP_PX +
        currentMetrics.marginTopPx -
        nonCollapsingDeduction
    );

    spacers.push({
      pos: breakPos,
      heightPx: spacerHeightPx,
      pageNumberAfter: currentPageIndex + 1,
      isLineSplit,
    });

    // Reset page accumulators
    cursorY = 0;
    prevMarginBottom = 0;
    pageHasContent = false;
    pageFootnotes = [];
    pageFootnotesHeightPx = 0;
    pageLineOffsetsY = [];
    pagePreviewTitle = '';
    pagePreviewExcerpt = '';
    pageStartPos = breakPos;

    // Place carryover footnote continuation if any
    if (carryoverFootnote) {
      const carryText = carryoverFootnote.remainingLines.join(' ');
      const est = estimateFootnoteHeight(carryText, currentMetrics.contentWidthPx);
      pageFootnotesHeightPx = FOOTNOTE_SEPARATOR_PX + est.totalHeight;
      pageFootnotes.push({
        ...carryoverFootnote.item,
        content: `(cont.) ${carryText}`,
        isContinuation: true,
        continuesToNextPage: false,
      });
      carryoverFootnote = null;
    }
  };

  const registerBlockFootnotesForPage = (
    fnRefs: number[],
    textFragment: string,
    pageNum1Based: number,
    displayPageStr: string
  ): { addedHeight: number; items: PageFootnoteRenderItem[]; carry: typeof carryoverFootnote } => {
    if (fnRefs.length === 0) return { addedHeight: 0, items: [], carry: null };
    let added = pageFootnotes.length === 0 ? FOOTNOTE_SEPARATOR_PX : 0;
    const items: PageFootnoteRenderItem[] = [];
    let nextCarry: typeof carryoverFootnote = null;

    for (const origNum of fnRefs) {
      let displayNum = footnoteDisplayMap[origNum];
      if (!displayNum) {
        seenFootnoteOrigNums.add(origNum);
        displayNum = seenFootnoteOrigNums.size;
        footnoteDisplayMap[origNum] = displayNum;
      }

      // Avoid duplicating same footnote twice on the same page
      if (pageFootnotes.some(f => f.originalNumber === origNum) || items.some(f => f.originalNumber === origNum)) {
        continue;
      }

      const fnObj = footnoteByNumber.get(origNum);
      const fnContent = fnObj?.content || `Footnote ${displayNum}.`;
      const est = estimateFootnoteHeight(fnContent, currentMetrics.contentWidthPx);

      // Check if footnote is very long and needs to continue on next page
      const maxFnAllowance = Math.max(48, currentMetrics.maxBodyHeightPx * 0.45);
      if (est.totalHeight > maxFnAllowance && est.lines.length > 3) {
        const fitCount = Math.max(2, Math.floor((maxFnAllowance - FOOTNOTE_ITEM_GAP_PX) / FOOTNOTE_LINE_PX));
        const fitText = est.lines.slice(0, fitCount).join(' ');
        const remLines = est.lines.slice(fitCount);
        const partialHeight = fitCount * FOOTNOTE_LINE_PX + FOOTNOTE_ITEM_GAP_PX;
        added += partialHeight;

        const item: PageFootnoteRenderItem = {
          id: fnObj?.id || `fn_${origNum}`,
          originalNumber: origNum,
          displayNumber: displayNum,
          content: fitText,
          continuesToNextPage: true,
          footnoteObj: fnObj,
        };
        items.push(item);
        nextCarry = { item, remainingLines: remLines };
      } else {
        added += est.totalHeight;
        items.push({
          id: fnObj?.id || `fn_${origNum}`,
          originalNumber: origNum,
          displayNumber: displayNum,
          content: fnContent,
          footnoteObj: fnObj,
        });
      }

      if (!footnotePageMap[origNum]) {
        footnotePageMap[origNum] = {
          pageNumber: pageNum1Based,
          formattedPage: displayPageStr,
          displayNumber: displayNum,
          footnoteId: fnObj?.id || `fn_${origNum}`,
        };
      }
    }

    return { addedHeight: added, items, carry: nextCarry };
  };

  const recordLineNumbersForBlock = (blockStartY: number, lines: VisualLine[]) => {
    if (!activeSetup.lineNumbers) return;
    if (currentMetrics.columns === 2) return; // line numbers apply to 1-col or start offset
    for (const l of lines) {
      pageLineOffsetsY.push(currentMetrics.marginTopPx + blockStartY + l.topRel);
    }
  };

  for (let idx = 0; idx < blocks.length; idx++) {
    const blk = blocks[idx];

    // 1. Explicit Page Break node
    if (blk.isPageBreak) {
      if (pageHasContent) {
        advanceToNextPage(blk.pos, false);
      }
      continue;
    }

    // 2. Section Break node
    if (blk.isSectionBreak) {
      const secKey = blk.sectionKey || `sec_${idx}`;
      if (blk.sectionBreakType === 'continuous') {
        activeSectionKey = secKey;
        activeSectionIndex += 1;
        activeSetup = resolveEffectivePageSetup(
          baseSetup,
          journalProfile,
          useJournalOverride,
          sectionPageSetups?.[activeSectionKey]
        );
        currentMetrics = resolvePageMetrics(activeSetup, currentPageIndex + 1);
      } else {
        if (pageHasContent) {
          advanceToNextPage(blk.pos, false, secKey);
        } else {
          activeSectionKey = secKey;
          activeSetup = resolveEffectivePageSetup(
            baseSetup,
            journalProfile,
            useJournalOverride,
            sectionPageSetups?.[activeSectionKey]
          );
          currentMetrics = resolvePageMetrics(activeSetup, currentPageIndex + 1);
        }
      }
      continue;
    }

    // 3. Page Break Before paragraph attribute
    if (blk.pageBreakBefore && pageHasContent) {
      advanceToNextPage(blk.pos, false, undefined, prevMarginBottom, blk.marginTop);
    }

    const collapsedMargin = pageHasContent ? Math.max(prevMarginBottom, blk.marginTop) : 0;

    // 4. Keep With Next check (headings & paragraphs with keepWithNext)
    if (blk.keepWithNext && pageHasContent && idx + 1 < blocks.length) {
      const nextBlk = blocks[idx + 1];
      if (!nextBlk.isPageBreak && !nextBlk.isSectionBreak) {
        const nextMinHeight =
          nextBlk.lines.length >= 2
            ? nextBlk.lines[1].bottomRel
            : nextBlk.height;
        const needed = collapsedMargin + blk.height + Math.max(blk.marginBottom, nextBlk.marginTop) + nextMinHeight;
        const avail = getPageAvailableBodyHeight(currentMetrics, pageFootnotesHeightPx);
        if (cursorY + needed > avail) {
          advanceToNextPage(blk.pos, false, undefined, prevMarginBottom, blk.marginTop);
        }
      }
    }

    const effectiveMarginTop = pageHasContent ? Math.max(prevMarginBottom, blk.marginTop) : 0;
    const blockStartY = cursorY + effectiveMarginTop;

    // Register footnotes referenced in this block
    const formattedCurrPage = formatPageNumber(
      currentDisplayNumber,
      activeSetup.headerFooter.numberFormat || '1'
    );
    const fnInfo = registerBlockFootnotesForPage(
      blk.footnoteRefs,
      blk.text,
      currentPageIndex + 1,
      formattedCurrPage
    );

    const availableBodyHeight = getPageAvailableBodyHeight(
      currentMetrics,
      pageFootnotesHeightPx + fnInfo.addedHeight
    );

    // 5. Does entire block fit on current page?
    if (blockStartY + blk.height <= availableBodyHeight) {
      cursorY = blockStartY + blk.height;
      prevMarginBottom = blk.marginBottom;
      pageHasContent = true;

      if (fnInfo.items.length > 0) {
        pageFootnotes.push(...fnInfo.items);
        pageFootnotesHeightPx += fnInfo.addedHeight;
        if (fnInfo.carry) carryoverFootnote = fnInfo.carry;
      }

      if (blk.isHeading && blk.text.trim()) {
        if (!pagePreviewTitle) pagePreviewTitle = blk.text.trim();
        headingPageMap[blk.headingId] = {
          pageNumber: currentPageIndex + 1,
          formattedPage: formattedCurrPage,
          title: blk.text.trim(),
          level: blk.headingLevel,
        };
        tocEntries.push({
          id: blk.headingId,
          title: blk.text.trim(),
          level: blk.headingLevel,
          pageNumber: currentPageIndex + 1,
          formattedPage: formattedCurrPage,
        });
      } else if (!pagePreviewExcerpt && blk.text.trim()) {
        pagePreviewExcerpt = blk.text.trim();
      }

      recordLineNumbersForBlock(blockStartY, blk.lines);
      continue;
    }

    // 6. Block overflows current page: decide between whole-block push vs line-level split
    const remainingOnPage = availableBodyHeight - blockStartY;
    const canTryLineSplit =
      !blk.keepLinesTogether &&
      blk.node.isTextblock &&
      blk.el &&
      blk.lines.length >= 2 &&
      remainingOnPage > 20 &&
      currentMetrics.columns === 1;

    if (canTryLineSplit && blk.el) {
      // Find how many lines fit before remainingOnPage
      let fitLineCount = 0;
      for (const l of blk.lines) {
        if (l.bottomRel <= remainingOnPage) {
          fitLineCount += 1;
        } else {
          break;
        }
      }

      // Apply Widow / Orphan Control (min 2 lines on current page, min 2 lines on next page)
      if (blk.widowOrphanControl) {
        if (fitLineCount < 2) {
          fitLineCount = 0; // Orphan -> push whole block
        } else if (blk.lines.length - fitLineCount === 1) {
          // Widow -> pull 1 line down if at least 2 remain above
          if (fitLineCount >= 3) {
            fitLineCount -= 1;
          } else {
            fitLineCount = 0; // Push whole block
          }
        }
      }

      if (fitLineCount >= 1 && fitLineCount < blk.lines.length) {
        const splitLine = blk.lines[fitLineCount];
        const splitPos = withNaturalBlockDom(blk.el, () =>
          findPosForLineStart(
            view,
            blk.pos,
            blk.node,
            blk.el!,
            editorEl,
            splitLine.topRel
          )
        );

        if (splitPos !== null) {
          const firstHalfHeight = blk.lines[fitLineCount - 1].bottomRel;
          const secondHalfHeight = blk.height - splitLine.topRel;

          // Check if footnotes on this block belong to the first half or second half
          const textBeforeSplit = doc.textBetween(blk.pos + 1, splitPos, ' ');
          const refsBefore = getBlockFootnoteRefs(textBeforeSplit);
          const refsAfter = blk.footnoteRefs.filter(n => !refsBefore.includes(n));

          const firstHalfFn = registerBlockFootnotesForPage(
            refsBefore,
            textBeforeSplit,
            currentPageIndex + 1,
            formattedCurrPage
          );

          cursorY = blockStartY + firstHalfHeight;
          pageHasContent = true;
          if (firstHalfFn.items.length > 0) {
            pageFootnotes.push(...firstHalfFn.items);
            pageFootnotesHeightPx += firstHalfFn.addedHeight;
            if (firstHalfFn.carry) carryoverFootnote = firstHalfFn.carry;
          }

          if (blk.isHeading && blk.text.trim()) {
            if (!pagePreviewTitle) pagePreviewTitle = blk.text.trim();
            headingPageMap[blk.headingId] = {
              pageNumber: currentPageIndex + 1,
              formattedPage: formattedCurrPage,
              title: blk.text.trim(),
              level: blk.headingLevel,
            };
            tocEntries.push({
              id: blk.headingId,
              title: blk.text.trim(),
              level: blk.headingLevel,
              pageNumber: currentPageIndex + 1,
              formattedPage: formattedCurrPage,
            });
          } else if (!pagePreviewExcerpt && textBeforeSplit.trim()) {
            pagePreviewExcerpt = textBeforeSplit.trim();
          }

          recordLineNumbersForBlock(blockStartY, blk.lines.slice(0, fitLineCount));

          // Advance to next page right at `splitPos` inside the paragraph!
          advanceToNextPage(splitPos, true);

          // Place second half of paragraph on new page (or loop if super long > 1 full page)
          let remainingHeight = secondHalfHeight;
          let remainingLineIdx = fitLineCount;
          const formattedNextPage = formatPageNumber(
            currentDisplayNumber,
            activeSetup.headerFooter.numberFormat || '1'
          );
          const secondHalfFn = registerBlockFootnotesForPage(
            refsAfter,
            blk.text,
            currentPageIndex + 1,
            formattedNextPage
          );
          if (secondHalfFn.items.length > 0) {
            pageFootnotes.push(...secondHalfFn.items);
            pageFootnotesHeightPx += secondHalfFn.addedHeight;
            if (secondHalfFn.carry) carryoverFootnote = secondHalfFn.carry;
          }

          // Handle multi-page single gigantic paragraph (> 1 page tall)
          while (
            remainingHeight > getPageAvailableBodyHeight(currentMetrics, pageFootnotesHeightPx) &&
            remainingLineIdx < blk.lines.length - 2
          ) {
            const availNow = getPageAvailableBodyHeight(currentMetrics, pageFootnotesHeightPx);
            const baseTop = blk.lines[remainingLineIdx].topRel;
            let chunkCount = 0;
            for (let li = remainingLineIdx; li < blk.lines.length; li++) {
              if (blk.lines[li].bottomRel - baseTop <= availNow) {
                chunkCount++;
              } else {
                break;
              }
            }
            if (chunkCount < 1) chunkCount = 1;
            const nextSplitLineIdx = remainingLineIdx + chunkCount;
            if (nextSplitLineIdx >= blk.lines.length) break;

            const nextSplitPos = withNaturalBlockDom(blk.el, () =>
              findPosForLineStart(
                view,
                blk.pos,
                blk.node,
                blk.el!,
                editorEl,
                blk.lines[nextSplitLineIdx].topRel
              )
            );
            if (!nextSplitPos) break;

            cursorY = blk.lines[nextSplitLineIdx - 1].bottomRel - baseTop;
            pageHasContent = true;
            recordLineNumbersForBlock(0, blk.lines.slice(remainingLineIdx, nextSplitLineIdx).map(l => ({
              topRel: l.topRel - baseTop,
              bottomRel: l.bottomRel - baseTop,
            })));
            advanceToNextPage(nextSplitPos, true);
            remainingLineIdx = nextSplitLineIdx;
            remainingHeight = blk.height - blk.lines[remainingLineIdx].topRel;
          }

          const restLines = blk.lines.slice(remainingLineIdx);
          const restBaseTop = restLines[0]?.topRel || 0;
          recordLineNumbersForBlock(0, restLines.map(l => ({
            topRel: l.topRel - restBaseTop,
            bottomRel: l.bottomRel - restBaseTop,
          })));
          cursorY = Math.max(24, remainingHeight);
          prevMarginBottom = blk.marginBottom;
          pageHasContent = true;
          continue;
        }
      }
    }

    // 7. Whole-block push onto next page (if current page already has content)
    if (pageHasContent) {
      advanceToNextPage(blk.pos, false, undefined, prevMarginBottom, blk.marginTop);
    }

    // Re-register footnotes on the new page
    const formattedNewPage = formatPageNumber(
      currentDisplayNumber,
      activeSetup.headerFooter.numberFormat || '1'
    );
    const newPageFn = registerBlockFootnotesForPage(
      blk.footnoteRefs,
      blk.text,
      currentPageIndex + 1,
      formattedNewPage
    );
    if (newPageFn.items.length > 0) {
      pageFootnotes.push(...newPageFn.items);
      pageFootnotesHeightPx += newPageFn.addedHeight;
      if (newPageFn.carry) carryoverFootnote = newPageFn.carry;
    }

    if (blk.isHeading && blk.text.trim()) {
      if (!pagePreviewTitle) pagePreviewTitle = blk.text.trim();
      headingPageMap[blk.headingId] = {
        pageNumber: currentPageIndex + 1,
        formattedPage: formattedNewPage,
        title: blk.text.trim(),
        level: blk.headingLevel,
      };
      tocEntries.push({
        id: blk.headingId,
        title: blk.text.trim(),
        level: blk.headingLevel,
        pageNumber: currentPageIndex + 1,
        formattedPage: formattedNewPage,
      });
    } else if (!pagePreviewExcerpt && blk.text.trim()) {
      pagePreviewExcerpt = blk.text.trim();
    }

    recordLineNumbersForBlock(0, blk.lines);
    cursorY = Math.min(blk.height, currentMetrics.maxBodyHeightPx * (currentMetrics.columns === 2 ? 2 : 1));
    prevMarginBottom = blk.marginBottom;
    pageHasContent = true;
  }

  // Finalize last page (ensure at least 1 page exists)
  finalizeCurrentPage(doc.content.size);

  // If carryover footnote still remains after final block, append trailing page(s) for it
  while (carryoverFootnote) {
    advanceToNextPage(doc.content.size, false);
    finalizeCurrentPage(doc.content.size);
  }

  return {
    pages,
    spacers,
    totalPages: pages.length,
    headingPageMap,
    footnotePageMap,
    tocEntries,
    footnoteDisplayMap,
  };
}
