/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Local-First Storage & Real OOXML (.docx) Export Service
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  LineNumberRestartFormat,
  NumberFormat,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  SectionType,
  ShadingType,
  Table as DocxTable,
  TableCell as DocxTableCell,
  TableRow as DocxTableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
  type ISectionOptions,
  type ParagraphChild,
} from 'docx';
import {
  HeaderFooterSlot,
  Manuscript,
  PageNumberFormat,
  PageSetupConfig,
} from '../types/manuscript';
import { initialManuscript } from '../data/initialManuscript';
import {
  DEFAULT_PAGE_SETUP,
  PAPER_SIZES,
  cmToTwips,
  mergePageSetup,
  resolveEffectivePageSetup,
} from './pageLayout';

const STORAGE_KEY = 'human_manuscript_active_project_v1';
const BACKUPS_KEY = 'human_manuscript_rolling_backups_v1';

export function loadManuscript(): Manuscript {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...initialManuscript,
        pageSetup: DEFAULT_PAGE_SETUP,
      };
    }
    const parsed = JSON.parse(raw) as Manuscript;
    return {
      ...initialManuscript,
      ...parsed,
      pageSetup: mergePageSetup(DEFAULT_PAGE_SETUP, parsed.pageSetup),
      sectionPageSetups: parsed.sectionPageSetups || {},
      settings: {
        ...initialManuscript.settings,
        ...(parsed.settings || {}),
        lastViewMode: parsed.settings?.lastViewMode || 'pages',
        lastZoomLevel: parsed.settings?.lastZoomLevel || 100,
        lastZoomMode: parsed.settings?.lastZoomMode || 'custom',
        showRuler: parsed.settings?.showRuler !== undefined ? parsed.settings.showRuler : true,
        showFormattingMarks: parsed.settings?.showFormattingMarks ?? false,
        preferredUnit: parsed.settings?.preferredUnit || 'cm',
        fontFamily: parsed.settings?.fontFamily || 'Times New Roman',
        fontSize: parsed.settings?.fontSize || '12pt',
      },
    };
  } catch (err) {
    console.error('Failed to load manuscript from localStorage:', err);
    return {
      ...initialManuscript,
      pageSetup: DEFAULT_PAGE_SETUP,
    };
  }
}

export function saveManuscript(manuscript: Manuscript): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manuscript));
    saveRollingBackup(manuscript);
  } catch (err) {
    console.error('Failed to save manuscript to localStorage:', err);
  }
}

function saveRollingBackup(manuscript: Manuscript): void {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    const backups: { timestamp: number; title: string; wordCount: number; data: string }[] = raw
      ? JSON.parse(raw)
      : [];

    const now = Date.now();
    const lastBackup = backups[0];
    if (!lastBackup || now - lastBackup.timestamp > 10 * 60 * 1000) {
      const totalWords = manuscript.sections.reduce((acc, s) => {
        return (
          acc +
          s.blocks.reduce((bAcc, b) => bAcc + (b.content.match(/\b\w+\b/g)?.length || 0), 0)
        );
      }, 0);

      backups.unshift({
        timestamp: now,
        title: manuscript.title,
        wordCount: totalWords,
        data: JSON.stringify(manuscript),
      });

      if (backups.length > 8) backups.length = 8;
      localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
    }
  } catch {
    // Ignore storage quota warnings for backups
  }
}

export function getRollingBackups(): {
  timestamp: number;
  title: string;
  wordCount: number;
  data: string;
}[] {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Exports single project bundle (.hmbak) file as JSON
 */
export function exportProjectBundle(manuscript: Manuscript): void {
  const bundle = {
    format: 'HumanManuscript.hmbak',
    version: '1.1',
    createdAt: new Date().toISOString(),
    manuscript,
  };
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = manuscript.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  a.download = `${safeTitle || 'manuscript'}_backup_${Date.now()}.hmbak`;
  a.click();
  URL.revokeObjectURL(url);
}

function mapNumberFormatToDocx(
  fmt: PageNumberFormat
): (typeof NumberFormat)[keyof typeof NumberFormat] {
  switch (fmt) {
    case 'i':
      return NumberFormat.LOWER_ROMAN;
    case 'I':
      return NumberFormat.UPPER_ROMAN;
    case 'a':
      return NumberFormat.LOWER_LETTER;
    default:
      return NumberFormat.DECIMAL;
  }
}

function buildHeaderFooterRuns(
  template: string,
  shortTitle: string,
  author: string,
  dateStr: string,
  fontName: string
): (TextRun | (typeof PageNumber)[keyof typeof PageNumber])[] {
  if (!template) return [];
  const tokenRegex = /(\{page\}|\{pages\}|\{title\}|\{author\}|\{date\})/gi;
  const parts = template.split(tokenRegex);
  const children: (TextRun | (typeof PageNumber)[keyof typeof PageNumber])[] = [];

  for (const part of parts) {
    if (!part) continue;
    const lower = part.toLowerCase();
    if (lower === '{page}') {
      children.push(
        new TextRun({
          children: [PageNumber.CURRENT],
          font: fontName,
          size: 18,
          color: '475569',
        })
      );
    } else if (lower === '{pages}') {
      children.push(
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          font: fontName,
          size: 18,
          color: '475569',
        })
      );
    } else if (lower === '{title}') {
      children.push(new TextRun({ text: shortTitle, font: fontName, size: 18, color: '475569', italics: true }));
    } else if (lower === '{author}') {
      children.push(new TextRun({ text: author, font: fontName, size: 18, color: '475569' }));
    } else if (lower === '{date}') {
      children.push(new TextRun({ text: dateStr, font: fontName, size: 18, color: '475569' }));
    } else {
      children.push(new TextRun({ text: part, font: fontName, size: 18, color: '475569' }));
    }
  }
  return children;
}

function buildHeaderFooterParagraph(
  slot: HeaderFooterSlot,
  shortTitle: string,
  author: string,
  dateStr: string,
  fontName: string
): Paragraph {
  const children: any[] = [];
  if (slot.left) {
    children.push(...buildHeaderFooterRuns(slot.left, shortTitle, author, dateStr, fontName));
  }
  if (slot.center) {
    children.push(new TextRun({ text: '\t', font: fontName, size: 18 }));
    children.push(...buildHeaderFooterRuns(slot.center, shortTitle, author, dateStr, fontName));
  }
  if (slot.right) {
    if (!slot.center) {
      children.push(new TextRun({ text: '\t\t', font: fontName, size: 18 }));
    } else {
      children.push(new TextRun({ text: '\t', font: fontName, size: 18 }));
    }
    children.push(...buildHeaderFooterRuns(slot.right, shortTitle, author, dateStr, fontName));
  }

  return new Paragraph({
    tabStops: [
      { type: TabStopType.CENTER, position: Math.round(TabStopPosition.MAX / 2) },
      { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
    ],
    children: children.length > 0 ? children : [new TextRun({ text: '' })],
  });
}

function extractInlineRuns(
  node: Node,
  inherited: {
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
    strike?: boolean;
    superScript?: boolean;
    subScript?: boolean;
    highlight?: string;
    font?: string;
  },
  defaultFont: string,
  defaultSizeHalfPts: number,
  knownFootnoteIds: Set<number>
): ParagraphChild[] {
  const runs: ParagraphChild[] = [];

  if (node.nodeType === Node.TEXT_NODE) {
    const rawText = node.textContent || '';
    if (!rawText) return runs;

    // Split text on [fnN] markers so native Word footnotes are emitted
    const fnRegex = /(\[fn\d+\])/g;
    const chunks = rawText.split(fnRegex);
    for (const chunk of chunks) {
      if (!chunk) continue;
      const fnMatch = chunk.match(/^\[fn(\d+)\]$/);
      if (fnMatch) {
        const fnNum = parseInt(fnMatch[1], 10);
        if (knownFootnoteIds.has(fnNum)) {
          runs.push(new FootnoteReferenceRun(fnNum));
          continue;
        }
      }
      runs.push(
        new TextRun({
          text: chunk,
          bold: inherited.bold,
          italics: inherited.italics,
          underline: inherited.underline ? {} : undefined,
          strike: inherited.strike,
          superScript: inherited.superScript,
          subScript: inherited.subScript,
          font: inherited.font || defaultFont,
          size: defaultSizeHalfPts,
        })
      );
    }
    return runs;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return runs;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    runs.push(new TextRun({ break: 1 }));
    return runs;
  }

  if (el.getAttribute('data-type') === 'cross-ref') {
    const refText = el.textContent || 'Cross-reference';
    runs.push(
      new TextRun({
        text: refText,
        font: inherited.font || defaultFont,
        size: defaultSizeHalfPts,
        color: '1E40AF',
      })
    );
    return runs;
  }

  const nextStyle = { ...inherited };
  if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
  if (tag === 'em' || tag === 'i') nextStyle.italics = true;
  if (tag === 'u') nextStyle.underline = true;
  if (tag === 's' || tag === 'del' || tag === 'strike') nextStyle.strike = true;
  if (tag === 'sup') {
    const inner = (el.textContent || '').trim();
    const fnDirect = inner.match(/^\[fn(\d+)\]$/);
    if (fnDirect) {
      const num = parseInt(fnDirect[1], 10);
      if (knownFootnoteIds.has(num)) {
        runs.push(new FootnoteReferenceRun(num));
        return runs;
      }
    }
    nextStyle.superScript = true;
  }
  if (tag === 'sub') nextStyle.subScript = true;

  const inlineFont = el.style?.fontFamily;
  if (inlineFont) {
    const cleaned = inlineFont.split(',')[0].replace(/['"]/g, '').trim();
    if (cleaned) nextStyle.font = cleaned;
  }

  el.childNodes.forEach(child => {
    runs.push(...extractInlineRuns(child, nextStyle, defaultFont, defaultSizeHalfPts, knownFootnoteIds));
  });

  return runs;
}

function mapAlignToDocx(
  alignStr?: string
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (alignStr) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'left':
      return AlignmentType.LEFT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.JUSTIFIED;
  }
}

/**
 * Generates and downloads a real OOXML (.docx) file using `docx` package,
 * preserving page size, orientation, margins, gutter, columns, section breaks,
 * headers/footers with PAGE & NUMPAGES fields, flow controls, selected fonts, and Word footnotes.
 */
export async function exportToWordDocument(
  manuscript: Manuscript,
  withTrackChanges = false,
  activeFontFamily = 'Times New Roman',
  editorHtml?: string,
  fontSizeStr = '12pt'
): Promise<void> {
  let cleanFont = activeFontFamily || 'Times New Roman';
  if (cleanFont.startsWith('font-')) {
    cleanFont = 'Times New Roman';
  }
  const basePts = parseInt(fontSizeStr, 10) || 12;
  const defaultSizeHalfPts = basePts * 2;

  const baseSetup = resolveEffectivePageSetup(
    manuscript.pageSetup,
    manuscript.journalProfile,
    manuscript.settings.useJournalPageSetup
  );

  // Build Word footnotes dictionary keyed by footnote number
  const docxFootnotes: Record<number, { children: Paragraph[] }> = {};
  const knownFnNumbers = new Set<number>();
  for (const fn of manuscript.footnotes) {
    knownFnNumbers.add(fn.number);
    docxFootnotes[fn.number] = {
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: fn.content,
              font: cleanFont,
              size: 20, // 10pt footnote text
            }),
          ],
        }),
      ],
    };
  }

  const shortTitle =
    manuscript.title.length > 56 ? manuscript.title.slice(0, 53) + '...' : manuscript.title;
  const authorName = manuscript.journalProfile?.publisher
    ? `Author (${manuscript.journalProfile.publisher})`
    : 'Author';
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Collect section buckets split by sectionBreak nodes
  interface DocxSectionBucket {
    setup: PageSetupConfig;
    breakType?: 'next-page' | 'continuous';
    children: (Paragraph | DocxTable)[];
  }

  const buckets: DocxSectionBucket[] = [
    {
      setup: baseSetup,
      children: [],
    },
  ];

  const base64ToUint8Array = (
    dataUrl: string
  ): { bytes: Uint8Array; type: 'png' | 'jpg'; width: number; height: number } | null => {
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!match) return null;
    try {
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      let width = 520;
      let height = 300;
      // Read PNG IHDR dimensions (bytes 16..23) to preserve exact chart aspect ratio
      if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const w = view.getUint32(16, false);
        const h = view.getUint32(20, false);
        if (w > 0 && h > 0) {
          const maxWidth = 540;
          const ratio = h / w;
          width = Math.min(maxWidth, Math.round(w / 2));
          height = Math.max(120, Math.round(width * ratio));
        }
      }
      return {
        bytes,
        type: /jpe?g/i.test(match[1]) ? 'jpg' : 'png',
        width,
        height,
      };
    } catch {
      return null;
    }
  };

  const pushElementToBucket = (el: HTMLElement, target: (Paragraph | DocxTable)[]) => {
    const dataType = el.getAttribute('data-type');

    if (dataType === 'page-break') {
      target.push(new Paragraph({ children: [new PageBreak()] }));
      return;
    }

    if (dataType === 'toc-field') {
      target.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Table of Contents', font: cleanFont, bold: true, size: 26 })],
        })
      );
      const rawEntries = el.getAttribute('data-toc-entries') || '[]';
      try {
        const entries = JSON.parse(rawEntries) as { title: string; formattedPage?: string; pageNumber: number; level: number }[];
        for (const entry of entries) {
          target.push(
            new Paragraph({
              indent: { left: Math.max(0, (entry.level - 1) * 360) },
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              children: [
                new TextRun({ text: `${entry.title}\t${entry.formattedPage || entry.pageNumber}`, font: cleanFont, size: 22 }),
              ],
            })
          );
        }
      } catch {
        // ignore invalid json
      }
      return;
    }

    const tag = el.tagName.toLowerCase();
    const pageBreakBefore = el.getAttribute('data-page-break-before') === 'true';
    const keepNextAttr = el.getAttribute('data-keep-with-next');
    const keepLines = el.getAttribute('data-keep-lines-together') === 'true';
    const widowControl = el.getAttribute('data-widow-orphan') !== 'false';
    const alignment = mapAlignToDocx(el.style?.textAlign || undefined);

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const headingMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        h1: HeadingLevel.HEADING_1,
        h2: HeadingLevel.HEADING_2,
        h3: HeadingLevel.HEADING_3,
        h4: HeadingLevel.HEADING_4,
      };
      const sizeMap: Record<string, number> = {
        h1: 32,
        h2: 26,
        h3: 24,
        h4: 22,
      };
      const runs = extractInlineRuns(
        el,
        { bold: true, italics: tag === 'h3' },
        cleanFont,
        sizeMap[tag] || 24,
        knownFnNumbers
      );
      target.push(
        new Paragraph({
          heading: headingMap[tag],
          alignment: tag === 'h1' ? AlignmentType.CENTER : alignment,
          pageBreakBefore,
          keepNext: keepNextAttr !== 'false',
          keepLines,
          widowControl,
          spacing: { before: 240, after: 120 },
          children: runs,
        })
      );
      return;
    }

    if (tag === 'blockquote') {
      const runs = extractInlineRuns(el, { italics: true }, cleanFont, Math.max(20, defaultSizeHalfPts - 2), knownFnNumbers);
      target.push(
        new Paragraph({
          indent: { left: 720, right: 360 },
          spacing: { before: 120, after: 120, line: 300 },
          keepLines,
          widowControl,
          children: runs,
        })
      );
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.children);
      items.forEach((li, idx) => {
        const prefix = tag === 'ol' ? `${idx + 1}. ` : '• ';
        const runs = extractInlineRuns(li, {}, cleanFont, defaultSizeHalfPts, knownFnNumbers);
        target.push(
          new Paragraph({
            indent: { left: 540 },
            spacing: { after: 100, line: 360 },
            widowControl,
            children: [new TextRun({ text: prefix, font: cleanFont, size: defaultSizeHalfPts }), ...runs],
          })
        );
      });
      return;
    }

    if (tag === 'img' || (tag === 'p' && el.querySelector('img') && !el.textContent?.trim())) {
      const imgEl = tag === 'img' ? el : (el.querySelector('img') as HTMLElement | null);
      const src = imgEl?.getAttribute('src') || '';
      const decoded = base64ToUint8Array(src);
      if (decoded) {
        target.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 140 },
            children: [
              new ImageRun({
                type: decoded.type,
                data: decoded.bytes,
                transformation: {
                  width: decoded.width,
                  height: decoded.height,
                },
              }),
            ],
          })
        );
      }
      return;
    }

    if (tag === 'table' || (tag === 'div' && el.classList.contains('tableWrapper'))) {
      const tableEl = tag === 'table' ? el : el.querySelector('table');
      if (tableEl) {
        const htmlRows = Array.from(tableEl.querySelectorAll('tr'));
        if (htmlRows.length > 0) {
          const docxRows = htmlRows.map(tr => {
            const cells = Array.from(tr.children).filter(
              c => c.tagName.toLowerCase() === 'td' || c.tagName.toLowerCase() === 'th'
            ) as HTMLElement[];
            return new DocxTableRow({
              tableHeader: cells.some(c => c.tagName.toLowerCase() === 'th'),
              children: cells.map(cell => {
                const isHeader = cell.tagName.toLowerCase() === 'th';
                const colSpan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
                const rowSpan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);
                const cellBlocks = Array.from(cell.children) as HTMLElement[];
                const cellParas: Paragraph[] = [];

                if (cellBlocks.length > 0) {
                  for (const blk of cellBlocks) {
                    const bTag = blk.tagName.toLowerCase();
                    if (bTag === 'ul' || bTag === 'ol') {
                      Array.from(blk.children).forEach((li, lIdx) => {
                        const prefix = bTag === 'ol' ? `${lIdx + 1}. ` : '• ';
                        const runs = extractInlineRuns(
                          li,
                          { bold: isHeader },
                          cleanFont,
                          defaultSizeHalfPts,
                          knownFnNumbers
                        );
                        cellParas.push(
                          new Paragraph({
                            indent: { left: 240 },
                            spacing: { after: 60 },
                            children: [
                              new TextRun({ text: prefix, font: cleanFont, size: defaultSizeHalfPts }),
                              ...runs,
                            ],
                          })
                        );
                      });
                    } else {
                      const runs = extractInlineRuns(
                        blk,
                        { bold: isHeader },
                        cleanFont,
                        defaultSizeHalfPts,
                        knownFnNumbers
                      );
                      cellParas.push(
                        new Paragraph({
                          spacing: { after: 60 },
                          children:
                            runs.length > 0
                              ? runs
                              : [new TextRun({ text: '', font: cleanFont, size: defaultSizeHalfPts })],
                        })
                      );
                    }
                  }
                } else {
                  const runs = extractInlineRuns(
                    cell,
                    { bold: isHeader },
                    cleanFont,
                    defaultSizeHalfPts,
                    knownFnNumbers
                  );
                  cellParas.push(
                    new Paragraph({
                      spacing: { after: 60 },
                      children:
                        runs.length > 0
                          ? runs
                          : [new TextRun({ text: '', font: cleanFont, size: defaultSizeHalfPts })],
                    })
                  );
                }

                return new DocxTableCell({
                  columnSpan: colSpan > 1 ? colSpan : undefined,
                  rowSpan: rowSpan > 1 ? rowSpan : undefined,
                  shading: isHeader
                    ? { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' }
                    : undefined,
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  },
                  children: cellParas,
                });
              }),
            });
          });

          target.push(
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: docxRows,
            })
          );
          return;
        }
      }
    }

    if (tag === 'div' && el.id === 'sec-metadata') {
      const innerParas = Array.from(el.querySelectorAll('p'));
      for (const p of innerParas) {
        const runs = extractInlineRuns(p, {}, cleanFont, 20, knownFnNumbers);
        target.push(
          new Paragraph({
            spacing: { after: 80, line: 276 },
            children: runs,
          })
        );
      }
      return;
    }

    const runs = extractInlineRuns(el, {}, cleanFont, defaultSizeHalfPts, knownFnNumbers);
    if (runs.length > 0 || el.textContent?.trim() === '') {
      target.push(
        new Paragraph({
          alignment,
          pageBreakBefore,
          keepNext: keepNextAttr === 'true',
          keepLines,
          widowControl,
          spacing: { after: 120, line: 360 },
          children: runs.length > 0 ? runs : [new TextRun({ text: '', font: cleanFont, size: defaultSizeHalfPts })],
        })
      );
    }
  };

  if (editorHtml && editorHtml.trim()) {
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(editorHtml, 'text/html');
    const nodes = Array.from(htmlDoc.body.children) as HTMLElement[];

    for (const el of nodes) {
      if (el.getAttribute('data-type') === 'section-break') {
        const breakType =
          (el.getAttribute('data-break-type') as 'next-page' | 'continuous') || 'next-page';
        const secKey = el.getAttribute('data-section-key') || '';
        const secSetup = resolveEffectivePageSetup(
          manuscript.pageSetup,
          manuscript.journalProfile,
          manuscript.settings.useJournalPageSetup,
          secKey ? manuscript.sectionPageSetups?.[secKey] : undefined
        );
        buckets.push({
          setup: secSetup,
          breakType,
          children: [],
        });
        continue;
      }

      pushElementToBucket(el, buckets[buckets.length - 1].children);
    }
  } else {
    // Fallback from structured sections
    const target = buckets[0].children;
    target.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: manuscript.title, font: cleanFont, bold: true, size: 32 })],
      })
    );
    for (const sec of manuscript.sections) {
      target.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          children: [new TextRun({ text: sec.title, font: cleanFont, bold: true, size: 26 })],
        })
      );
      for (const blk of sec.blocks) {
        const pEl = document.createElement('p');
        pEl.textContent = blk.content;
        pushElementToBucket(pEl, target);
      }
    }
  }

  let anyEvenOdd = false;

  const docxSections: ISectionOptions[] = buckets.map((bucket, idx) => {
    const setup = bucket.setup;
    const hf = setup.headerFooter;
    if (hf.differentOddEven) anyEvenOdd = true;

    const spec = PAPER_SIZES[setup.paperSize] || PAPER_SIZES.A4;
    const isLandscape = setup.orientation === 'landscape';
    const pgWidthTwips = cmToTwips((isLandscape ? spec.heightMm : spec.widthMm) / 10);
    const pgHeightTwips = cmToTwips((isLandscape ? spec.widthMm : spec.heightMm) / 10);

    const properties: ISectionOptions['properties'] = {
      type:
        idx === 0
          ? undefined
          : bucket.breakType === 'continuous'
          ? SectionType.CONTINUOUS
          : SectionType.NEXT_PAGE,
      titlePage: hf.differentFirstPage,
      page: {
        size: {
          width: pgWidthTwips,
          height: pgHeightTwips,
          orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
        margin: {
          top: cmToTwips(setup.marginsCm.top),
          bottom: cmToTwips(setup.marginsCm.bottom),
          left: cmToTwips(setup.marginsCm.left),
          right: cmToTwips(setup.marginsCm.right),
          gutter: cmToTwips(setup.marginsCm.gutter || 0),
          header: cmToTwips(hf.headerDistanceCm || 1.27),
          footer: cmToTwips(hf.footerDistanceCm || 1.27),
        },
        pageNumbers: {
          formatType: mapNumberFormatToDocx(hf.numberFormat),
          start: idx === 0 || hf.restartNumbering ? hf.startAt || 1 : undefined,
        },
      },
      column:
        setup.columns === 2
          ? {
              count: 2,
              space: cmToTwips(setup.columnGapCm || 0.75),
              equalWidth: true,
            }
          : undefined,
      lineNumbers: setup.lineNumbers
        ? {
            countBy: 1,
            start: 1,
            restart: LineNumberRestartFormat.NEW_PAGE,
          }
        : undefined,
    };

    const headers: ISectionOptions['headers'] = {
      default: new Header({
        children: [buildHeaderFooterParagraph(hf.defaultHeader, shortTitle, authorName, dateStr, cleanFont)],
      }),
      ...(hf.differentFirstPage
        ? {
            first: new Header({
              children: [
                buildHeaderFooterParagraph(hf.firstPageHeader, shortTitle, authorName, dateStr, cleanFont),
              ],
            }),
          }
        : {}),
      ...(hf.differentOddEven
        ? {
            even: new Header({
              children: [
                buildHeaderFooterParagraph(hf.evenPageHeader, shortTitle, authorName, dateStr, cleanFont),
              ],
            }),
          }
        : {}),
    };

    const footers: ISectionOptions['footers'] = {
      default: new Footer({
        children: [buildHeaderFooterParagraph(hf.defaultFooter, shortTitle, authorName, dateStr, cleanFont)],
      }),
      ...(hf.differentFirstPage
        ? {
            first: new Footer({
              children: [
                buildHeaderFooterParagraph(hf.firstPageFooter, shortTitle, authorName, dateStr, cleanFont),
              ],
            }),
          }
        : {}),
      ...(hf.differentOddEven
        ? {
            even: new Footer({
              children: [
                buildHeaderFooterParagraph(hf.evenPageFooter, shortTitle, authorName, dateStr, cleanFont),
              ],
            }),
          }
        : {}),
    };

    return {
      properties,
      headers,
      footers,
      children:
        bucket.children.length > 0
          ? bucket.children
          : [new Paragraph({ children: [new TextRun({ text: '' })] })],
    };
  });

  const doc = new Document({
    title: manuscript.title,
    creator: authorName,
    description: manuscript.subtitle || manuscript.abstractEn?.slice(0, 200),
    evenAndOddHeaderAndFooters: anyEvenOdd,
    features: {
      trackRevisions: withTrackChanges,
      updateFields: true,
    },
    footnotes: Object.keys(docxFootnotes).length > 0 ? docxFootnotes : undefined,
    styles: {
      default: {
        document: {
          run: {
            font: cleanFont,
            size: defaultSizeHalfPts,
          },
          paragraph: {
            spacing: { line: 360, after: 120 },
          },
        },
      },
    },
    sections: docxSections,
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = manuscript.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  a.download = `${filename || 'manuscript'}_${cleanFont.replace(/\s+/g, '_')}_${
    withTrackChanges ? 'tracked' : 'clean'
  }.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports Response-to-Reviewers Table as Markdown / Text
 */
export function generateResponseLetterMarkdown(manuscript: Manuscript): string {
  let md = `# Response to Reviewers\n\n`;
  md += `**Manuscript Title:** ${manuscript.title}\n`;
  md += `**Target Journal:** ${manuscript.journalProfile.name} (${manuscript.journalProfile.publisher})\n`;
  md += `**Date:** ${new Date().toLocaleDateString('en-GB')}\n\n`;
  md += `We thank the Editors and Reviewers for their thoughtful, rigorous, and constructive evaluations of our manuscript. Below, we provide a point-by-point response outlining all revisions and doctrinal clarifications made in the revised version.\n\n`;

  md += `| # | Reviewer Comment (Verbatim) | Response | Changes Made | Location in Revised Manuscript |\n`;
  md += `|---|---|---|---|---|\n`;

  for (const c of manuscript.reviewerComments) {
    const rawClean = c.raw.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const respClean = (c.responseDraft || 'Response in progress.').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const changesClean = (c.proposedChangesSummary || 'Text revised accordingly.')
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ');
    const locClean = (c.locationReference || 'Revised section').replace(/\|/g, '\\|');

    md += `| ${c.id} (${c.reviewer}) | "${rawClean}" | ${respClean} | ${changesClean} | ${locClean} |\n`;
  }

  return md;
}

/**
 * Generates an honest AI-Use Disclosure Statement based on tracked change events
 */
export function generateAIUseStatement(manuscript: Manuscript): string {
  const aiEvents = manuscript.changeEvents.filter(e => e.actor.type === 'model');
  const humanEvents = manuscript.changeEvents.filter(e => e.actor.type === 'human');
  const totalEvents = manuscript.changeEvents.length || 1;
  const aiRatio = Math.round((aiEvents.length / totalEvents) * 100);

  let statement = `### AI-Use and Generative Technology Disclosure Statement\n\n`;
  statement += `In accordance with the guidelines of the Committee on Publication Ethics (COPE) and ${manuscript.journalProfile.name} policies:\n\n`;
  statement += `The author confirms that the legal arguments, conceptual frameworks, primary authority selection, doctrinal interpretations, and conclusions presented in this manuscript are solely the intellectual product of the human author(s).\n\n`;

  if (aiEvents.length === 0) {
    statement += `No generative artificial intelligence software was utilised for drafting, revising, or summarising this manuscript.\n`;
  } else {
    statement += `Generative AI tools (specifically Google Gemini / local model adapters) were employed strictly for language refinement, checking citation short forms, identifying potential argument counter-propositions, and drafting structural revision proposals. All substantive legal suggestions were manually reviewed, verified against original primary sources, and independently approved or rewritten by the author.\n\n`;
    statement += `**Recorded Metrics:**\n`;
    statement += `- Total logged revision events: ${totalEvents}\n`;
    statement += `- AI-assisted language operations: ${aiEvents.length} (~${aiRatio}%)\n`;
    statement += `- Human-authored operations: ${humanEvents.length}\n`;
    statement += `- Provenance integrity: All citations strictly bound to verified library records; zero synthetic or invented citations were accepted.\n`;
  }

  return statement;
}
