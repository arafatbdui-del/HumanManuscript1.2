/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TipTap Extensions for Multi-Page Print Layout:
 * - PageBreakNode (Ctrl+Enter)
 * - SectionBreakNode (Next Page / Continuous)
 * - TocFieldNode (Live Table of Contents with page numbers)
 * - CrossRefNode (Inline Cross-Reference with live page numbers)
 * - ParagraphFlowExtension (pageBreakBefore, keepWithNext, keepLinesTogether, widowOrphanControl)
 * - PaginationPluginExtension (Non-destructive Decoration.widget page spacers + formatting marks)
 */

import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const PAGINATION_PLUGIN_KEY = new PluginKey('hmPagination');

export interface TocEntry {
  id: string;
  title: string;
  level: number;
  pageNumber: number;
  formattedPage: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
    sectionBreak: {
      insertSectionBreak: (breakType?: 'next-page' | 'continuous') => ReturnType;
    };
    tocField: {
      insertTocField: (entries?: TocEntry[]) => ReturnType;
    };
    crossRef: {
      insertCrossRef: (attrs: {
        targetId: string;
        refKind: 'section' | 'footnote';
        label: string;
        pageNumber: number;
        formattedPage: string;
      }) => ReturnType;
    };
    paragraphFlow: {
      setParagraphFlow: (attrs: {
        pageBreakBefore?: boolean;
        keepWithNext?: boolean | null;
        keepLinesTogether?: boolean;
        widowOrphanControl?: boolean;
      }) => ReturnType;
    };
  }
}

export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
      { tag: 'hr[data-page-break]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        class: 'hm-page-break',
        contenteditable: 'false',
      }),
      ['span', { class: 'hm-break-label' }, 'Page Break'],
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    };
  },
});

export const SectionBreakNode = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      breakType: {
        default: 'next-page',
        parseHTML: el => el.getAttribute('data-break-type') || 'next-page',
        renderHTML: attrs => ({ 'data-break-type': attrs.breakType }),
      },
      sectionKey: {
        default: () => `secbrk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        parseHTML: el => el.getAttribute('data-section-key') || undefined,
        renderHTML: attrs => ({ 'data-section-key': attrs.sectionKey }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="section-break"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label =
      node.attrs.breakType === 'continuous'
        ? 'Section Break (Continuous)'
        : 'Section Break (Next Page)';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'section-break',
        class: 'hm-section-break',
        contenteditable: 'false',
      }),
      ['span', { class: 'hm-break-label' }, label],
    ];
  },

  addCommands() {
    return {
      insertSectionBreak:
        (breakType = 'next-page') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              breakType,
              sectionKey: `secbrk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            },
          });
        },
    };
  },
});

export const TocFieldNode = Node.create({
  name: 'tocField',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      entries: {
        default: '[]',
        parseHTML: el => el.getAttribute('data-toc-entries') || '[]',
        renderHTML: attrs => ({ 'data-toc-entries': attrs.entries }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc-field"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    let parsed: TocEntry[] = [];
    try {
      parsed = JSON.parse(node.attrs.entries || '[]');
    } catch {
      parsed = [];
    }

    const rowSpecs: any[] =
      parsed.length > 0
        ? parsed.map(entry => [
            'div',
            {
              class: 'hm-toc-row',
              style: `padding-left: ${Math.max(0, (entry.level - 1) * 16)}px`,
            },
            ['span', { class: 'hm-toc-title' }, entry.title],
            ['span', { class: 'hm-toc-dots' }, ''],
            ['span', { class: 'hm-toc-page' }, entry.formattedPage || String(entry.pageNumber)],
          ])
        : [['div', { class: 'hm-toc-empty' }, 'No headings found. Click "Update Fields" to refresh.']];

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toc-field',
        class: 'hm-toc-block',
        contenteditable: 'false',
      }),
      ['div', { class: 'hm-toc-header' }, 'TABLE OF CONTENTS'],
      ['div', { class: 'hm-toc-rows' }, ...rowSpecs],
    ];
  },

  addCommands() {
    return {
      insertTocField:
        (entries = []) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { entries: JSON.stringify(entries) },
          });
        },
    };
  },
});

export const CrossRefNode = Node.create({
  name: 'crossRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      targetId: {
        default: '',
        parseHTML: el => el.getAttribute('data-target-id') || '',
        renderHTML: attrs => ({ 'data-target-id': attrs.targetId }),
      },
      refKind: {
        default: 'section',
        parseHTML: el => el.getAttribute('data-ref-kind') || 'section',
        renderHTML: attrs => ({ 'data-ref-kind': attrs.refKind }),
      },
      label: {
        default: 'Section',
        parseHTML: el => el.getAttribute('data-label') || 'Section',
        renderHTML: attrs => ({ 'data-label': attrs.label }),
      },
      pageNumber: {
        default: 1,
        parseHTML: el => Number(el.getAttribute('data-page-number') || '1'),
        renderHTML: attrs => ({ 'data-page-number': String(attrs.pageNumber) }),
      },
      formattedPage: {
        default: '1',
        parseHTML: el => el.getAttribute('data-formatted-page') || '1',
        renderHTML: attrs => ({ 'data-formatted-page': attrs.formattedPage }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="cross-ref"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const text = `${node.attrs.label}, p. ${node.attrs.formattedPage || node.attrs.pageNumber}`;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'cross-ref',
        class: 'hm-cross-ref',
        contenteditable: 'false',
        title: `Cross-reference to ${node.attrs.label} (Page ${node.attrs.formattedPage})`,
      }),
      text,
    ];
  },

  addCommands() {
    return {
      insertCrossRef:
        attrs =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export const ParagraphFlowExtension = Extension.create({
  name: 'paragraphFlow',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          pageBreakBefore: {
            default: false,
            parseHTML: el => el.getAttribute('data-page-break-before') === 'true',
            renderHTML: attrs =>
              attrs.pageBreakBefore ? { 'data-page-break-before': 'true' } : {},
          },
          keepWithNext: {
            default: null,
            parseHTML: el => {
              const v = el.getAttribute('data-keep-with-next');
              if (v === 'true') return true;
              if (v === 'false') return false;
              return null;
            },
            renderHTML: attrs => {
              if (attrs.keepWithNext === true) return { 'data-keep-with-next': 'true' };
              if (attrs.keepWithNext === false) return { 'data-keep-with-next': 'false' };
              return {};
            },
          },
          keepLinesTogether: {
            default: false,
            parseHTML: el => el.getAttribute('data-keep-lines-together') === 'true',
            renderHTML: attrs =>
              attrs.keepLinesTogether ? { 'data-keep-lines-together': 'true' } : {},
          },
          widowOrphanControl: {
            default: true,
            parseHTML: el => el.getAttribute('data-widow-orphan') !== 'false',
            renderHTML: attrs =>
              attrs.widowOrphanControl === false ? { 'data-widow-orphan': 'false' } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setParagraphFlow:
        attrs =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let updated = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...attrs,
              });
              updated = true;
            }
          });
          if (updated && dispatch) {
            dispatch(tr);
          }
          return updated;
        },
    };
  },
});

export interface SpacerDecorationSpec {
  pos: number;
  heightPx: number;
  pageNumberAfter: number;
  isLineSplit: boolean;
}

export interface PaginationPluginMeta {
  spacers: SpacerDecorationSpec[];
  showFormattingMarks?: boolean;
  isDraftMode?: boolean;
}

function buildPaginationDecorations(
  doc: any,
  spacers: SpacerDecorationSpec[],
  showFormattingMarks: boolean,
  isDraftMode: boolean
): DecorationSet {
  const decos: Decoration[] = [];

  if (!isDraftMode) {
    for (const sp of spacers) {
      if (sp.pos < 0 || sp.pos > doc.content.size) continue;
      decos.push(
        Decoration.widget(
          sp.pos,
          () => {
            const el = document.createElement('span');
            el.className = 'hm-page-spacer';
            el.setAttribute('contenteditable', 'false');
            el.setAttribute('data-page-after', String(sp.pageNumberAfter));
            el.style.display = 'block';
            el.style.width = '100%';
            el.style.height = `${Math.max(0, Math.round(sp.heightPx))}px`;
            el.style.pointerEvents = 'none';
            el.style.userSelect = 'none';
            el.style.columnSpan = 'all';
            el.style.margin = '0';
            el.style.padding = '0';
            return el;
          },
          {
            side: -1,
            ignoreSelection: true,
            key: `pg-sp-${sp.pageNumberAfter}-${sp.pos}`,
          }
        )
      );
    }
  } else {
    // Draft view: lightweight dotted page break indicator lines
    for (const sp of spacers) {
      if (sp.pos < 0 || sp.pos > doc.content.size) continue;
      decos.push(
        Decoration.widget(
          sp.pos,
          () => {
            const el = document.createElement('div');
            el.className = 'hm-draft-page-divider';
            el.setAttribute('contenteditable', 'false');
            el.innerHTML = `<span>Page ${sp.pageNumberAfter}</span>`;
            return el;
          },
          {
            side: -1,
            ignoreSelection: true,
            key: `draft-sp-${sp.pageNumberAfter}-${sp.pos}`,
          }
        )
      );
    }
  }

  // Formatting marks (¶ pilcrow at end of paragraphs/headings + Bengali line-height protection)
  doc.descendants((node: any, pos: number) => {
    if (node.isTextblock) {
      const text = node.textContent || '';
      if (/[\u0980-\u09FF]/.test(text)) {
        decos.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: 'hm-bengali-safe',
          })
        );
      }
      if (showFormattingMarks) {
        const endPos = pos + node.nodeSize - 1;
        decos.push(
          Decoration.widget(
            endPos,
            () => {
              const pilcrow = document.createElement('span');
              pilcrow.className = 'hm-formatting-pilcrow';
              pilcrow.setAttribute('contenteditable', 'false');
              pilcrow.textContent = '¶';
              return pilcrow;
            },
            { side: 1, ignoreSelection: true, key: `pilcrow-${pos}` }
          )
        );
      }
    }
    return true;
  });

  return DecorationSet.create(doc, decos);
}

export const PaginationPluginExtension = Extension.create({
  name: 'paginationPlugin',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PAGINATION_PLUGIN_KEY,
        state: {
          init: (_, { doc }) => ({
            decorations: buildPaginationDecorations(doc, [], false, false),
            spacers: [] as SpacerDecorationSpec[],
            showFormattingMarks: false,
            isDraftMode: false,
          }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(PAGINATION_PLUGIN_KEY) as PaginationPluginMeta | undefined;
            if (meta) {
              return {
                spacers: meta.spacers,
                showFormattingMarks: meta.showFormattingMarks ?? prev.showFormattingMarks,
                isDraftMode: meta.isDraftMode ?? prev.isDraftMode,
                decorations: buildPaginationDecorations(
                  tr.doc,
                  meta.spacers,
                  meta.showFormattingMarks ?? prev.showFormattingMarks,
                  meta.isDraftMode ?? prev.isDraftMode
                ),
              };
            }
            if (tr.docChanged) {
              return {
                ...prev,
                decorations: prev.decorations.map(tr.mapping, tr.doc),
              };
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations;
          },
        },
      }),
    ];
  },
});
