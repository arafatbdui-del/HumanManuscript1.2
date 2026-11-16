/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Clean Markdown renderer for AI Agent responses inside scrollable panels.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownResponseProps {
  content: string;
}

export const MarkdownResponse: React.FC<MarkdownResponseProps> = ({ content }) => {
  return (
    <div className="text-[11px] leading-relaxed text-slate-700 space-y-2 break-words">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h4 className="font-bold text-slate-900 text-xs mt-2 mb-1 border-b border-slate-100 pb-0.5">
              {children}
            </h4>
          ),
          h2: ({ children }) => (
            <h5 className="font-bold text-slate-900 text-[11.5px] mt-2 mb-1">{children}</h5>
          ),
          h3: ({ children }) => (
            <h6 className="font-semibold text-slate-800 text-[11px] mt-1.5 mb-0.5">{children}</h6>
          ),
          p: ({ children }) => <p className="text-[11px] leading-relaxed text-slate-700">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-4 space-y-1 text-slate-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-1 text-slate-700">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-purple-300 bg-purple-50/50 pl-2.5 py-1 italic text-slate-700 rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
