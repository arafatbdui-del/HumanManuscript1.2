/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Page Layout Geometry, Paper Sizes, Margins, Header/Footer Fields & Units Engine (96 DPI)
 */

import {
  HeaderFooterConfig,
  HeaderFooterSlot,
  JournalProfile,
  MarginPresetId,
  MeasurementUnit,
  PageNumberFormat,
  PageOrientation,
  PageSetupConfig,
  PaperSizeId,
} from '../types/manuscript';

export const PX_PER_INCH = 96;
export const CM_PER_INCH = 2.54;
export const PAGE_GAP_PX = 24;

export interface PaperSizeSpec {
  id: PaperSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  widthIn: number;
  heightIn: number;
}

export const PAPER_SIZES: Record<PaperSizeId, PaperSizeSpec> = {
  A4: {
    id: 'A4',
    label: 'A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    widthPx: 794,
    heightPx: 1123,
    widthIn: 8.27,
    heightIn: 11.69,
  },
  Letter: {
    id: 'Letter',
    label: 'Letter (8.5 × 11 in)',
    widthMm: 215.9,
    heightMm: 279.4,
    widthPx: 816,
    heightPx: 1056,
    widthIn: 8.5,
    heightIn: 11,
  },
  Legal: {
    id: 'Legal',
    label: 'Legal (8.5 × 14 in)',
    widthMm: 215.9,
    heightMm: 355.6,
    widthPx: 816,
    heightPx: 1344,
    widthIn: 8.5,
    heightIn: 14,
  },
  A5: {
    id: 'A5',
    label: 'A5 (148 × 210 mm)',
    widthMm: 148,
    heightMm: 210,
    widthPx: 559,
    heightPx: 794,
    widthIn: 5.83,
    heightIn: 8.27,
  },
};

export interface MarginPresetSpec {
  id: Exclude<MarginPresetId, 'custom'>;
  label: string;
  description: string;
  marginsCm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    gutter: number;
  };
}

export const MARGIN_PRESETS: Record<Exclude<MarginPresetId, 'custom'>, MarginPresetSpec> = {
  normal: {
    id: 'normal',
    label: 'Normal',
    description: '2.54 cm (1 in) all sides',
    marginsCm: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54, gutter: 0 },
  },
  narrow: {
    id: 'narrow',
    label: 'Narrow',
    description: '1.27 cm (0.5 in) all sides',
    marginsCm: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27, gutter: 0 },
  },
  moderate: {
    id: 'moderate',
    label: 'Moderate',
    description: '2.54 cm top/bottom, 1.91 cm sides',
    marginsCm: { top: 2.54, bottom: 2.54, left: 1.91, right: 1.91, gutter: 0 },
  },
  wide: {
    id: 'wide',
    label: 'Wide',
    description: '2.54 cm top/bottom, 5.08 cm sides',
    marginsCm: { top: 2.54, bottom: 2.54, left: 5.08, right: 5.08, gutter: 0 },
  },
  mirrored: {
    id: 'mirrored',
    label: 'Mirrored',
    description: 'Inside 3.18 cm, Outside 2.54 cm (book binding)',
    marginsCm: { top: 2.54, bottom: 2.54, left: 3.18, right: 2.54, gutter: 0 },
  },
};

export const DEFAULT_HEADER_FOOTER: HeaderFooterConfig = {
  headerDistanceCm: 1.27,
  footerDistanceCm: 1.27,
  differentFirstPage: false,
  differentOddEven: false,
  numberFormat: '1',
  startAt: 1,
  restartNumbering: false,
  defaultHeader: {
    left: '{title}',
    center: '',
    right: 'Human Rights Law Review',
  },
  defaultFooter: {
    left: 'HumanManuscript — en-GB',
    center: '',
    right: 'Page {page} of {pages}',
  },
  firstPageHeader: {
    left: '',
    center: '',
    right: '',
  },
  firstPageFooter: {
    left: '{title}',
    center: '',
    right: 'Page {page} of {pages}',
  },
  evenPageHeader: {
    left: '{author}',
    center: '',
    right: '{title}',
  },
  evenPageFooter: {
    left: 'Page {page} of {pages}',
    center: '',
    right: 'HumanManuscript — en-GB',
  },
};

export const DEFAULT_PAGE_SETUP: PageSetupConfig = {
  paperSize: 'A4',
  orientation: 'portrait',
  marginPreset: 'normal',
  marginsCm: {
    top: 2.54,
    bottom: 2.54,
    left: 2.54,
    right: 2.54,
    gutter: 0,
  },
  columns: 1,
  columnGapCm: 0.75,
  lineNumbers: false,
  headerFooter: DEFAULT_HEADER_FOOTER,
};

export function cmToPx(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * PX_PER_INCH);
}

export function pxToCm(px: number): number {
  return Number(((px / PX_PER_INCH) * CM_PER_INCH).toFixed(2));
}

export function inToPx(inches: number): number {
  return Math.round(inches * PX_PER_INCH);
}

export function pxToIn(px: number): number {
  return Number((px / PX_PER_INCH).toFixed(2));
}

export function cmToIn(cm: number): number {
  return Number((cm / CM_PER_INCH).toFixed(2));
}

export function inToCm(inches: number): number {
  return Number((inches * CM_PER_INCH).toFixed(2));
}

export function formatLength(cm: number, unit: MeasurementUnit): string {
  if (unit === 'in') {
    return `${cmToIn(cm).toFixed(2)} in`;
  }
  return `${cm.toFixed(2)} cm`;
}

export function cmToTwips(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * 1440);
}

export function pxToTwips(px: number): number {
  return Math.round((px / PX_PER_INCH) * 1440);
}

export interface ResolvedPageMetrics {
  widthPx: number;
  heightPx: number;
  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  marginRightPx: number;
  gutterPx: number;
  contentWidthPx: number;
  maxBodyHeightPx: number;
  headerDistancePx: number;
  footerDistancePx: number;
  columns: 1 | 2;
  columnGapPx: number;
  orientation: PageOrientation;
  paperSize: PaperSizeId;
}

export function mergePageSetup(
  base: PageSetupConfig,
  override?: Partial<PageSetupConfig>
): PageSetupConfig {
  if (!override) return base;
  return {
    ...base,
    ...override,
    marginsCm: {
      ...base.marginsCm,
      ...(override.marginsCm || {}),
    },
    headerFooter: {
      ...base.headerFooter,
      ...(override.headerFooter || {}),
      defaultHeader: {
        ...base.headerFooter.defaultHeader,
        ...(override.headerFooter?.defaultHeader || {}),
      },
      defaultFooter: {
        ...base.headerFooter.defaultFooter,
        ...(override.headerFooter?.defaultFooter || {}),
      },
      firstPageHeader: {
        ...base.headerFooter.firstPageHeader,
        ...(override.headerFooter?.firstPageHeader || {}),
      },
      firstPageFooter: {
        ...base.headerFooter.firstPageFooter,
        ...(override.headerFooter?.firstPageFooter || {}),
      },
      evenPageHeader: {
        ...base.headerFooter.evenPageHeader,
        ...(override.headerFooter?.evenPageHeader || {}),
      },
      evenPageFooter: {
        ...base.headerFooter.evenPageFooter,
        ...(override.headerFooter?.evenPageFooter || {}),
      },
    },
  };
}

export function resolveEffectivePageSetup(
  manuscriptSetup: PageSetupConfig | undefined,
  journalProfile: JournalProfile | undefined,
  useJournalOverride: boolean | undefined,
  sectionOverride?: Partial<PageSetupConfig>
): PageSetupConfig {
  let effective = mergePageSetup(DEFAULT_PAGE_SETUP, manuscriptSetup);
  if (useJournalOverride && journalProfile?.pageSetupOverride) {
    effective = mergePageSetup(effective, journalProfile.pageSetupOverride);
  }
  if (sectionOverride) {
    effective = mergePageSetup(effective, sectionOverride);
  }
  return effective;
}

export function resolvePageMetrics(
  setup: PageSetupConfig,
  pageNumber1Based: number = 1
): ResolvedPageMetrics {
  const spec = PAPER_SIZES[setup.paperSize] || PAPER_SIZES.A4;
  const isLandscape = setup.orientation === 'landscape';
  const widthPx = isLandscape ? spec.heightPx : spec.widthPx;
  const heightPx = isLandscape ? spec.widthPx : spec.heightPx;

  const marginTopPx = Math.max(24, cmToPx(setup.marginsCm.top));
  const marginBottomPx = Math.max(24, cmToPx(setup.marginsCm.bottom));
  const gutterPx = Math.max(0, cmToPx(setup.marginsCm.gutter || 0));

  let marginLeftPx = Math.max(24, cmToPx(setup.marginsCm.left));
  let marginRightPx = Math.max(24, cmToPx(setup.marginsCm.right));

  // Handle mirrored margins on even pages (left/right swap: inside vs outside)
  const isEvenPage = pageNumber1Based % 2 === 0;
  if (setup.marginPreset === 'mirrored' && isEvenPage) {
    const tmp = marginLeftPx;
    marginLeftPx = marginRightPx;
    marginRightPx = tmp + gutterPx;
  } else {
    marginLeftPx += gutterPx;
  }

  // Clamp margins so content always has at least 160px width & 200px height
  const maxHorizontal = Math.max(48, widthPx - 160);
  if (marginLeftPx + marginRightPx > maxHorizontal) {
    const ratio = maxHorizontal / (marginLeftPx + marginRightPx);
    marginLeftPx = Math.floor(marginLeftPx * ratio);
    marginRightPx = Math.floor(marginRightPx * ratio);
  }

  const maxVertical = Math.max(48, heightPx - 200);
  const clampedTop = marginTopPx + marginBottomPx > maxVertical
    ? Math.floor((marginTopPx / (marginTopPx + marginBottomPx)) * maxVertical)
    : marginTopPx;
  const clampedBottom = marginTopPx + marginBottomPx > maxVertical
    ? Math.floor((marginBottomPx / (marginTopPx + marginBottomPx)) * maxVertical)
    : marginBottomPx;

  const contentWidthPx = widthPx - marginLeftPx - marginRightPx;
  const maxBodyHeightPx = heightPx - clampedTop - clampedBottom;

  return {
    widthPx,
    heightPx,
    marginTopPx: clampedTop,
    marginBottomPx: clampedBottom,
    marginLeftPx,
    marginRightPx,
    gutterPx,
    contentWidthPx,
    maxBodyHeightPx,
    headerDistancePx: Math.min(clampedTop - 22, Math.max(10, cmToPx(setup.headerFooter.headerDistanceCm))),
    footerDistancePx: Math.min(clampedBottom - 22, Math.max(10, cmToPx(setup.headerFooter.footerDistanceCm))),
    columns: setup.columns || 1,
    columnGapPx: cmToPx(setup.columnGapCm || 0.75),
    orientation: setup.orientation,
    paperSize: setup.paperSize,
  };
}

/**
 * Formats a 1-based page number using Word numbering formats: 1, i, I, a
 */
export function formatPageNumber(num: number, format: PageNumberFormat): string {
  const n = Math.max(1, Math.floor(num));
  if (format === '1') return String(n);

  if (format === 'a') {
    let result = '';
    let x = n;
    while (x > 0) {
      x--;
      result = String.fromCharCode(97 + (x % 26)) + result;
      x = Math.floor(x / 26);
    }
    return result;
  }

  const numerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rem = n;
  let roman = '';
  for (const [val, sym] of numerals) {
    while (rem >= val) {
      roman += sym;
      rem -= val;
    }
  }
  return format === 'i' ? roman.toLowerCase() : roman;
}

export interface HeaderFooterResolveContext {
  displayPageNumber: number;
  totalPages: number;
  numberFormat: PageNumberFormat;
  shortTitle: string;
  author: string;
  dateStr?: string;
}

export function resolveFieldTokens(template: string, ctx: HeaderFooterResolveContext): string {
  if (!template) return '';
  const formattedPage = formatPageNumber(ctx.displayPageNumber, ctx.numberFormat);
  const formattedTotal = formatPageNumber(ctx.totalPages, ctx.numberFormat);
  const dateVal =
    ctx.dateStr ||
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return template
    .replace(/\{page\}/gi, formattedPage)
    .replace(/\{pages\}/gi, formattedTotal)
    .replace(/\{title\}/gi, ctx.shortTitle)
    .replace(/\{author\}/gi, ctx.author)
    .replace(/\{date\}/gi, dateVal);
}

export function getActiveHeaderFooterSlots(
  hf: HeaderFooterConfig,
  pageIndexInSection0Based: number,
  globalPageNumber1Based: number
): {
  header: HeaderFooterSlot;
  footer: HeaderFooterSlot;
  slotKey: 'first' | 'even' | 'default';
} {
  if (hf.differentFirstPage && pageIndexInSection0Based === 0) {
    return {
      header: hf.firstPageHeader,
      footer: hf.firstPageFooter,
      slotKey: 'first',
    };
  }
  if (hf.differentOddEven && globalPageNumber1Based % 2 === 0) {
    return {
      header: hf.evenPageHeader,
      footer: hf.evenPageFooter,
      slotKey: 'even',
    };
  }
  return {
    header: hf.defaultHeader,
    footer: hf.defaultFooter,
    slotKey: 'default',
  };
}

/**
 * Detects Bengali Unicode block (\u0980-\u09FF)
 */
export function containsBengali(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}
