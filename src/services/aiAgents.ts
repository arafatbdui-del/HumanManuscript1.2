/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * On-Demand Specialized AI Agents Service for Section AI Copilot
 */

import { GoogleGenAI } from '@google/genai';
import { Manuscript, Section } from '../types/manuscript';

export type AIAgentId = 'title' | 'abstract' | 'introduction' | 'analysis';

export interface AIAgentDefinition {
  id: AIAgentId;
  name: string;
  sectionLabel: string;
  buttonLabel: string;
  description: string;
  systemPrompt: string;
}

export const GEMINI_MODEL_ID = 'gemini-4-hydrogen';
export const GEMINI_API_KEY_STORAGE_KEY = 'hm_gemini_api_key';

export const AI_AGENTS: AIAgentDefinition[] = [
  {
    id: 'title',
    name: 'Title Agent',
    sectionLabel: 'Title',
    buttonLabel: 'Analyze Title SEO & Impact',
    description: 'Evaluates academic tone, keyword density, and discoverability.',
    systemPrompt:
      'You are an expert academic editor. Analyze this title for SEO, keyword density, and academic tone. Provide 3 alternative titles and a brief explanation of why they are better.',
  },
  {
    id: 'abstract',
    name: 'Abstract Agent',
    sectionLabel: 'Abstract',
    buttonLabel: 'Critique Abstract Structure',
    description: 'Checks background, methodology, results, conclusion, and drafts a revision.',
    systemPrompt:
      'You are a legal journal peer reviewer. Critique this abstract. Check for background, methodology, results, and conclusion. Suggest specific improvements and provide a rewritten version.',
  },
  {
    id: 'introduction',
    name: 'Introduction Agent',
    sectionLabel: 'Introduction',
    buttonLabel: 'Check Introduction Flow',
    description: 'Audits hook, thesis statement, and structural roadmap clarity.',
    systemPrompt:
      'You are a thesis supervisor. Analyze this introduction. Does it have a clear hook, thesis statement, and roadmap? Suggest improvements.',
  },
  {
    id: 'analysis',
    name: 'Analysis Agent',
    sectionLabel: 'Analysis',
    buttonLabel: 'Review Argumentation',
    description: 'Detects logical fallacies, weak claims, and ways to strengthen reasoning.',
    systemPrompt:
      'You are a logic and rhetoric expert. Analyze this text for logical fallacies, weak arguments, and clarity. Suggest how to strengthen the argument.',
  },
];

export type AIAgentErrorCode = 'MISSING_API_KEY' | 'EMPTY_SECTION' | 'API_ERROR';

export class AIAgentError extends Error {
  code: AIAgentErrorCode;

  constructor(code: AIAgentErrorCode, message: string) {
    super(message);
    this.name = 'AIAgentError';
    this.code = code;
  }
}

/**
 * Loads the persisted Gemini API key from localStorage (falling back to manuscript settings if present).
 * Never returns or uses any hardcoded key.
 */
export function loadStoredGeminiApiKey(settingsKey?: string): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }
  } catch {
    // Ignore storage access issues
  }
  return settingsKey?.trim() || '';
}

/**
 * Saves or clears the user's Gemini API key in localStorage.
 */
export function saveStoredGeminiApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (trimmed) {
        window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage access issues
  }
  return trimmed;
}

export interface ExtractedSectionResult {
  text: string;
  sourceLabel: string;
  wordCount: number;
}

function countWords(text: string): number {
  const matches = text.trim().match(/\b[\w'-]+\b/g);
  return matches ? matches.length : 0;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface ParsedBlockNode {
  tag: string;
  id: string;
  text: string;
}

function parseHtmlBlocks(html: string): ParsedBlockNode[] {
  if (!html || !html.trim()) return [];

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const nodes: ParsedBlockNode[] = [];
    for (const el of Array.from(doc.body.children)) {
      const tag = el.tagName.toLowerCase();
      const id = (el.getAttribute('id') || el.getAttribute('data-section-id') || '').toLowerCase();
      const text = normalizeText(el.textContent || '');
      if (text) {
        nodes.push({ tag, id, text });
      }
    }
    return nodes;
  }

  // Fallback lightweight block parser for non-DOM environments (e.g. Node unit tests)
  const nodes: ParsedBlockNode[] = [];
  const blockRegex = /<(h1|h2|h3|h4|p|div|blockquote|ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    const id = (idMatch?.[1] || '').toLowerCase();
    const stripped = normalizeText(
      match[3]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    );
    if (stripped) {
      nodes.push({ tag, id, text: stripped });
    }
  }
  return nodes;
}

function isTopLevelHeading(node: ParsedBlockNode): boolean {
  return node.tag === 'h1' || node.tag === 'h2';
}

function collectSectionAfterHeading(
  nodes: ParsedBlockNode[],
  startIndex: number
): string {
  const parts: string[] = [];
  for (let i = startIndex + 1; i < nodes.length; i++) {
    const node = nodes[i];
    if (isTopLevelHeading(node)) break;
    if (node.id === 'sec-metadata') continue;
    parts.push(node.text);
  }
  return normalizeText(parts.join('\n\n'));
}

function getFallbackSectionText(
  manuscript: Manuscript | undefined,
  predicate: (sec: Section) => boolean
): string {
  if (!manuscript) return '';
  const matching = manuscript.sections.filter(predicate);
  const combined = matching
    .flatMap(s => s.blocks.map(b => b.content))
    .join('\n\n');
  return normalizeText(combined);
}

/**
 * Extracts text for the target section directly from the TipTap editor HTML.
 * Falls back gracefully to manuscript metadata/sections if the HTML lacks an explicit heading.
 */
export function extractSectionTextFromEditorHtml(
  editorHtml: string,
  agentId: AIAgentId,
  manuscript?: Manuscript,
  activeSection?: Section
): ExtractedSectionResult {
  const nodes = parseHtmlBlocks(editorHtml);

  if (agentId === 'title') {
    const titleNode =
      nodes.find(n => n.id === 'sec-title') ||
      nodes.find(n => n.tag === 'h1');
    const text = titleNode?.text || normalizeText(manuscript?.title || '');
    return {
      text,
      sourceLabel: titleNode ? 'Editor Title heading' : 'Manuscript Title',
      wordCount: countWords(text),
    };
  }

  if (agentId === 'abstract') {
    const absIdx = nodes.findIndex(
      n =>
        n.id === 'sec-abstract' ||
        (isTopLevelHeading(n) && /^\s*(\d+\.?\s*)?abstract\b/i.test(n.text))
    );
    if (absIdx >= 0) {
      const bodyText = collectSectionAfterHeading(nodes, absIdx);
      if (bodyText) {
        return {
          text: bodyText,
          sourceLabel: 'Editor Abstract section',
          wordCount: countWords(bodyText),
        };
      }
    }
    const fallback =
      getFallbackSectionText(
        manuscript,
        s => s.id === 'sec-abstract' || /abstract/i.test(s.role) || /abstract/i.test(s.title)
      ) || normalizeText(manuscript?.abstractEn || '');
    return {
      text: fallback,
      sourceLabel: 'Manuscript Abstract',
      wordCount: countWords(fallback),
    };
  }

  if (agentId === 'introduction') {
    const introIdx = nodes.findIndex(
      n =>
        n.id === 'sec-intro' ||
        (isTopLevelHeading(n) && /^\s*(\d+\.?\s*)?introduction\b/i.test(n.text))
    );
    if (introIdx >= 0) {
      const bodyText = collectSectionAfterHeading(nodes, introIdx);
      if (bodyText) {
        return {
          text: bodyText,
          sourceLabel: 'Editor Introduction section',
          wordCount: countWords(bodyText),
        };
      }
    }
    const fallback = getFallbackSectionText(
      manuscript,
      s => s.id === 'sec-intro' || /introduction/i.test(s.role) || /introduction/i.test(s.title)
    );
    return {
      text: fallback,
      sourceLabel: 'Manuscript Introduction',
      wordCount: countWords(fallback),
    };
  }

  // Analysis Agent
  // 1. Explicit analysis / argument / doctrinal / discussion / methodology headings in TipTap HTML
  const analysisIndices = nodes
    .map((n, idx) => ({ n, idx }))
    .filter(
      ({ n }) =>
        isTopLevelHeading(n) &&
        n.id !== 'sec-conclusion' &&
        n.id !== 'sec-bibliography' &&
        (/analysis|theory|argument|doctrinal|discussion|proportionality/i.test(n.id) ||
          /\b(analysis|doctrinal|argument(?:ation)?|discussion|findings|methodology|theoretical framework|proportionality)\b/i.test(
            n.text
          ))
    );

  if (analysisIndices.length > 0) {
    const chunks = analysisIndices
      .map(({ n, idx }) => {
        const body = collectSectionAfterHeading(nodes, idx);
        return body ? `${n.text}\n${body}` : '';
      })
      .filter(Boolean);
    const combined = normalizeText(chunks.join('\n\n'));
    if (combined) {
      return {
        text: combined,
        sourceLabel: 'Editor Analysis section(s)',
        wordCount: countWords(combined),
      };
    }
  }

  // 2. Any custom body headings added between Introduction and Conclusion/Bibliography in TipTap HTML
  const knownNonAnalysisIds = new Set([
    'sec-title',
    'sec-metadata',
    'sec-abstract',
    'sec-intro',
    'sec-conclusion',
    'sec-bibliography',
  ]);
  const customBodyHeadings = nodes
    .map((n, idx) => ({ n, idx }))
    .filter(
      ({ n }) =>
        n.tag === 'h2' &&
        !knownNonAnalysisIds.has(n.id) &&
        !/^\s*(\d+\.?\s*)?(abstract|introduction|conclusion|bibliography|references)\b/i.test(
          n.text
        )
    );

  if (customBodyHeadings.length > 0) {
    const chunks = customBodyHeadings
      .map(({ n, idx }) => {
        const body = collectSectionAfterHeading(nodes, idx);
        return body ? `${n.text}\n${body}` : '';
      })
      .filter(Boolean);
    const combined = normalizeText(chunks.join('\n\n'));
    if (combined) {
      return {
        text: combined,
        sourceLabel: 'Editor Substantive Body section(s)',
        wordCount: countWords(combined),
      };
    }
  }

  // 3. Fallback to active section if it is an analysis/body section, or manuscript analysis sections
  if (
    activeSection &&
    !['sec-title', 'sec-abstract', 'sec-intro', 'sec-conclusion', 'sec-bibliography'].includes(
      activeSection.id
    )
  ) {
    const activeText = normalizeText(activeSection.blocks.map(b => b.content).join('\n\n'));
    if (activeText) {
      return {
        text: activeText,
        sourceLabel: `Section: ${activeSection.title}`,
        wordCount: countWords(activeText),
      };
    }
  }

  const msAnalysis = getFallbackSectionText(
    manuscript,
    s =>
      s.id === 'sec-analysis' ||
      s.id === 'sec-theory' ||
      s.id === 'sec-proportionality' ||
      /analysis|theory|argument/i.test(s.role)
  );
  if (msAnalysis) {
    return {
      text: msAnalysis,
      sourceLabel: 'Manuscript Analysis sections',
      wordCount: countWords(msAnalysis),
    };
  }

  // 4. Final fallback: body paragraphs from Editor Introduction (excluding title/abstract/bibliography)
  const introIdx = nodes.findIndex(
    n =>
      n.id === 'sec-intro' ||
      (isTopLevelHeading(n) && /^\s*(\d+\.?\s*)?introduction\b/i.test(n.text))
  );
  if (introIdx >= 0) {
    const introBody = collectSectionAfterHeading(nodes, introIdx);
    if (introBody) {
      return {
        text: introBody,
        sourceLabel: 'Editor Body / Argument text',
        wordCount: countWords(introBody),
      };
    }
  }

  return {
    text: '',
    sourceLabel: 'Analysis section',
    wordCount: 0,
  };
}

function formatGeminiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown error');
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('401') || lower.includes('403')) {
    return 'Invalid or unauthorized Gemini API key. Please check your key and try again.';
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return 'Gemini API rate limit or quota exceeded. Please wait a moment and try again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline')) {
    return 'Network error reaching the Gemini API. Please check your internet connection.';
  }
  return `Gemini API error: ${raw}`;
}

/**
 * Executes a single independent on-demand AI agent against Gemini using @google/genai.
 */
export async function runAIAgent(params: {
  agentId: AIAgentId;
  sectionText: string;
  apiKey: string;
}): Promise<string> {
  const { agentId, sectionText, apiKey } = params;
  const agent = AI_AGENTS.find(a => a.id === agentId);
  if (!agent) {
    throw new AIAgentError('API_ERROR', `Unknown AI agent: ${agentId}`);
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey || trimmedKey === 'MY_GEMINI_API_KEY') {
    throw new AIAgentError('MISSING_API_KEY', 'Please enter your API key first');
  }

  const trimmedContent = sectionText.trim();
  if (!trimmedContent) {
    throw new AIAgentError(
      'EMPTY_SECTION',
      `No text found for the ${agent.sectionLabel} section in the editor. Add content there first.`
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: trimmedKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_ID,
      contents: trimmedContent,
      config: {
        systemInstruction: agent.systemPrompt,
      },
    });

    const output = response.text?.trim();
    if (!output) {
      throw new AIAgentError('API_ERROR', 'Gemini returned an empty response. Please try again.');
    }
    return output;
  } catch (err) {
    if (err instanceof AIAgentError) {
      throw err;
    }
    throw new AIAgentError('API_ERROR', formatGeminiErrorMessage(err));
  }
}
