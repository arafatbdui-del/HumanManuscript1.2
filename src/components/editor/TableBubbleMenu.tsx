/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Floating Bubble Menu for TipTap Smart Tables
 * Appears when clicking inside any table cell/header and provides row, column, merge/split, and header controls.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react';
import {
  ArrowUpFromLine,
  ArrowDownFromLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  TableCellsMerge,
  TableCellsSplit,
  PanelTop,
  Trash2,
  Rows3,
  Columns3,
} from 'lucide-react';

interface TableBubbleMenuProps {
  editor: Editor | null;
  scrollTarget?: HTMLElement | null;
}

export const TableBubbleMenu: React.FC<TableBubbleMenuProps> = ({
  editor,
  scrollTarget,
}) => {
  // Force re-render on selection/transaction changes so can().mergeCells() / can().splitCell() stay accurate
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const onChange = () => setTick(t => t + 1);
    editor.on('selectionUpdate', onChange);
    editor.on('transaction', onChange);
    return () => {
      editor.off('selectionUpdate', onChange);
      editor.off('transaction', onChange);
    };
  }, [editor]);

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor || editor.isDestroyed) return null;
    try {
      const { from } = editor.state.selection;
      const domAt = editor.view.domAtPos(from);
      const baseEl =
        domAt.node instanceof HTMLElement
          ? domAt.node
          : domAt.node.parentElement;
      const cellOrTable =
        baseEl?.closest('td, th') || baseEl?.closest('table');
      if (!cellOrTable) return null;
      return {
        getBoundingClientRect: () => cellOrTable.getBoundingClientRect(),
      };
    } catch {
      return null;
    }
  }, [editor]);

  if (!editor) return null;

  const canMerge = editor.can().mergeCells();
  const canSplit = editor.can().splitCell();
  const isHeaderActive = editor.isActive('tableHeader');

  const btnBase =
    'p-1.5 rounded text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-700 disabled:cursor-not-allowed transition flex items-center justify-center relative';

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="smartTableBubbleMenu"
      appendTo={() => document.body}
      getReferencedVirtualElement={getReferencedVirtualElement}
      shouldShow={({ editor: ed }) => {
        if (!ed.isEditable) return false;
        return (
          ed.isActive('table') ||
          ed.isActive('tableCell') ||
          ed.isActive('tableHeader')
        );
      }}
      options={{
        strategy: 'fixed',
        placement: 'top-start',
        offset: 8,
        flip: true,
        shift: { padding: 12 },
        scrollTarget: scrollTarget || undefined,
      }}
    >
      <div
        role="toolbar"
        aria-label="Table editing tools"
        onMouseDown={e => e.preventDefault()}
        className="flex items-center gap-0.5 bg-white border border-slate-300 shadow-xl rounded-lg px-1.5 py-1 text-xs z-50 select-none"
      >
        {/* Row Controls */}
        <button
          type="button"
          onClick={() => editor.chain().focus().addRowBefore().run()}
          className={btnBase}
          title="Add Row Above"
          aria-label="Add Row Above"
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className={btnBase}
          title="Add Row Below"
          aria-label="Add Row Below"
        >
          <ArrowDownFromLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteRow().run()}
          disabled={!editor.can().deleteRow()}
          className={`${btnBase} hover:bg-rose-50 hover:text-rose-700`}
          title="Delete Row"
          aria-label="Delete Row"
        >
          <Rows3 className="w-3.5 h-3.5" />
          <span className="text-[9px] font-bold text-rose-600 -ml-0.5 -mt-2">×</span>
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Column Controls */}
        <button
          type="button"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          className={btnBase}
          title="Add Column Left"
          aria-label="Add Column Left"
        >
          <ArrowLeftFromLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className={btnBase}
          title="Add Column Right"
          aria-label="Add Column Right"
        >
          <ArrowRightFromLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          disabled={!editor.can().deleteColumn()}
          className={`${btnBase} hover:bg-rose-50 hover:text-rose-700`}
          title="Delete Column"
          aria-label="Delete Column"
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span className="text-[9px] font-bold text-rose-600 -ml-0.5 -mt-2">×</span>
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Merge / Split & Header Controls */}
        <button
          type="button"
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!canMerge}
          className={btnBase}
          title="Merge Selected Cells"
          aria-label="Merge Cells"
        >
          <TableCellsMerge className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!canSplit}
          className={btnBase}
          title="Split Cell"
          aria-label="Split Cell"
        >
          <TableCellsSplit className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          className={`${btnBase} ${
            isHeaderActive ? 'bg-blue-100 text-blue-800 font-semibold' : ''
          }`}
          title="Toggle Header Row"
          aria-label="Toggle Header Row"
        >
          <PanelTop className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        <button
          type="button"
          onClick={() => editor.chain().focus().deleteTable().run()}
          className={`${btnBase} hover:bg-rose-50 hover:text-rose-700`}
          title="Delete Entire Table"
          aria-label="Delete Table"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </BubbleMenu>
  );
};
