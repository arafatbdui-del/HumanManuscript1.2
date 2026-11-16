/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Microsoft Word-Style Font Family Selector Dropdown for TipTap Editor
 */

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { ChevronDown, Check } from 'lucide-react';

export interface StandardFont {
  name: string;
  cssStack: string;
  category: 'Serif' | 'Sans-serif' | 'Monospace';
}

export const STANDARD_FONTS: StandardFont[] = [
  {
    name: 'Times New Roman',
    cssStack: '"Times New Roman", "Tinos", "Liberation Serif", "Noto Serif Bengali", Times, serif',
    category: 'Serif',
  },
  {
    name: 'Arial',
    cssStack: 'Arial, Helvetica, "Liberation Sans", "Noto Serif Bengali", sans-serif',
    category: 'Sans-serif',
  },
  {
    name: 'Calibri',
    cssStack: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, "Noto Serif Bengali", sans-serif',
    category: 'Sans-serif',
  },
  {
    name: 'Georgia',
    cssStack: 'Georgia, "Times New Roman", "Tinos", "Noto Serif Bengali", Times, serif',
    category: 'Serif',
  },
  {
    name: 'Garamond',
    cssStack: 'Garamond, "EB Garamond", "Baskerville", "Hoefler Text", "Times New Roman", "Tinos", "Noto Serif Bengali", serif',
    category: 'Serif',
  },
  {
    name: 'Verdana',
    cssStack: 'Verdana, Geneva, "DejaVu Sans", "Noto Serif Bengali", sans-serif',
    category: 'Sans-serif',
  },
  {
    name: 'Courier New',
    cssStack: '"Courier New", Courier, "Liberation Mono", "Noto Serif Bengali", monospace',
    category: 'Monospace',
  },
  {
    name: 'Trebuchet MS',
    cssStack: '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", Arial, "Noto Serif Bengali", sans-serif',
    category: 'Sans-serif',
  },
  {
    name: 'Tahoma',
    cssStack: 'Tahoma, Verdana, Segoe, "Segoe UI", "Noto Serif Bengali", sans-serif',
    category: 'Sans-serif',
  },
];

/**
 * Returns native CSS font-family stack for a font name
 */
export function getFontCssStack(fontName: string): string {
  const match = STANDARD_FONTS.find(
    f => f.name.toLowerCase() === fontName.toLowerCase()
  );
  if (match) return match.cssStack;

  // Legacy mappings
  if (fontName === 'font-serif-legal' || fontName.toLowerCase().includes('times')) {
    return '"Times New Roman", "Tinos", "Liberation Serif", "Noto Serif Bengali", Times, serif';
  }
  if (fontName === 'font-sans' || fontName.toLowerCase().includes('arial')) {
    return 'Arial, Helvetica, sans-serif';
  }
  if (fontName === 'font-heading-crest' || fontName.toLowerCase().includes('cinzel')) {
    return 'Cinzel, Georgia, serif';
  }
  if (fontName === 'font-mono-code' || fontName.toLowerCase().includes('jetbrains')) {
    return '"Courier New", Courier, monospace';
  }

  return `"${fontName}", serif`;
}

interface FontFamilyDropdownProps {
  editor: Editor | null;
  currentFontFamily: string;
  onChangeFontFamily: (font: string) => void;
  className?: string;
}

export const FontFamilyDropdown: React.FC<FontFamilyDropdownProps> = ({
  editor,
  currentFontFamily,
  onChangeFontFamily,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize initial currentFontFamily
  const resolveDisplayName = (fontInput: string): string => {
    if (!fontInput) return 'Times New Roman';
    const match = STANDARD_FONTS.find(
      f => f.name.toLowerCase() === fontInput.toLowerCase()
    );
    if (match) return match.name;

    // Handle legacy classes
    if (fontInput === 'font-serif-legal') return 'Times New Roman';
    if (fontInput === 'font-sans') return 'Arial';
    if (fontInput === 'font-heading-crest') return 'Georgia';
    if (fontInput === 'font-mono-code') return 'Courier New';

    return fontInput;
  };

  const [activeFontName, setActiveFontName] = useState<string>(() =>
    resolveDisplayName(currentFontFamily)
  );

  // Synchronize active font with TipTap selection and transactions
  useEffect(() => {
    if (!editor) {
      setActiveFontName(resolveDisplayName(currentFontFamily));
      return;
    }

    const updateFontFromEditor = () => {
      // Check if mark has a font-family set on current selection
      const markFont = editor.getAttributes('textStyle')?.fontFamily;
      if (markFont) {
        setActiveFontName(resolveDisplayName(markFont));
      } else {
        setActiveFontName(resolveDisplayName(currentFontFamily));
      }
    };

    updateFontFromEditor();

    editor.on('selectionUpdate', updateFontFromEditor);
    editor.on('transaction', updateFontFromEditor);

    return () => {
      editor.off('selectionUpdate', updateFontFromEditor);
      editor.off('transaction', updateFontFromEditor);
    };
  }, [editor, currentFontFamily]);

  // Click outside and Escape key to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectFont = (font: StandardFont) => {
    if (editor) {
      // TipTap applies to highlighted text, or sets stored marks for next typed text
      editor.chain().focus().setFontFamily(font.name).run();
    }
    setActiveFontName(font.name);
    onChangeFontFamily(font.name);
    setIsOpen(false);
  };

  const handleResetDefault = () => {
    if (editor) {
      editor.chain().focus().unsetFontFamily().run();
    }
    setActiveFontName(resolveDisplayName(currentFontFamily));
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button styled like Word Font Combobox */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="h-7 w-38 sm:w-44 px-2 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 hover:border-slate-400 rounded flex items-center justify-between text-xs text-slate-800 transition font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
        title="Font Family (Select text to change font or set for next typed text)"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className="truncate text-left flex-1 mr-1"
          style={{ fontFamily: getFontCssStack(activeFontName) }}
        >
          {activeFontName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Font Family Options"
          className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-300 rounded-md shadow-xl z-50 py-1 max-h-72 overflow-y-auto text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
            <span>Standard Word Fonts</span>
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-[10px] font-normal text-blue-600 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* List of Fonts */}
          <div className="py-1">
            {STANDARD_FONTS.map(font => {
              const isSelected =
                activeFontName.toLowerCase() === font.name.toLowerCase();

              return (
                <button
                  key={font.name}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectFont(font)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition group cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-[13px] leading-tight"
                      style={{ fontFamily: font.cssStack }}
                    >
                      {font.name}
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500">
                      {font.category}
                    </span>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
