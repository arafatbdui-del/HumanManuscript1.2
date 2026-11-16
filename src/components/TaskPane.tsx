/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Accordion-Based Collapsible Right Task Pane with Mendeley Library & Research Panels
 * Enhanced Reference Library with Copy-Paste & DOI Importer (Crossref API), Manual Entry, and File Upload (.ris/.bib).
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Manuscript,
  Source,
  Footnote,
  ReviewerComment,
  Proposal,
  Section,
  EvidenceDocument,
  OriginalityFlag,
  LegalSourceKind,
} from '../types/manuscript';
import {
  BookOpen,
  Scale,
  MessageSquare,
  ShieldCheck,
  Feather,
  Sparkles,
  CheckCircle,
  Plus,
  Copy,
  ChevronDown,
  ChevronRight,
  Lock,
  RefreshCw,
  Search,
  X,
  BookMarked,
  PanelRightClose,
  Loader2,
  Globe,
  FileUp,
  Edit3,
  Check,
  AlertCircle,
  ExternalLink,
  Link2,
  Key,
  Eye,
  EyeOff,
  Bot,
} from 'lucide-react';
import { runCitationAudit } from '../services/citationEngine';
import { runLegalQualityChecks } from '../services/legalQualityChecks';
import { executeSectionAIAction } from '../services/aiProvider';
import {
  AI_AGENTS,
  AIAgentError,
  AIAgentId,
  extractSectionTextFromEditorHtml,
  loadStoredGeminiApiKey,
  runAIAgent,
  saveStoredGeminiApiKey,
} from '../services/aiAgents';
import { MarkdownResponse } from './common/MarkdownResponse';
import {
  parsePastedReference,
  createManualSource,
  extractDoi,
  isHttpUrl,
} from '../services/doiAndWebFetcher';
import { parseReferenceFile } from '../services/referenceParser';

export type AccordionSectionKey =
  | 'library'
  | 'workbench'
  | 'review'
  | 'guard'
  | 'language'
  | 'ai';

interface TaskPaneProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccordion: AccordionSectionKey | null;
  onToggleAccordion: (key: AccordionSectionKey) => void;
  manuscript: Manuscript;
  activeSection: Section;
  getEditorHtml?: () => string;
  onUpdateGeminiApiKey?: (apiKey: string) => void;
  selectedFootnote: Footnote | null;
  onSelectFootnote: (fn: Footnote | null) => void;
  onOpenAddSource: () => void;
  onOpenImportReferences: () => void;
  onInsertCitationToEditor: (
    source: Source,
    style: 'oscola-footnote' | 'in-text-author-year' | 'in-text-numeric' | 'apa'
  ) => void;
  onApplyProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  onUpdateFootnoteContent: (fnId: string, newContent: string) => void;
  onFixOriginalityFlag: (flag: OriginalityFlag, fixType: 'quote' | 'cite' | 'dismiss') => void;
  onAddSourceDirectly?: (source: Source) => void;
}

interface AgentExecutionState {
  loading: boolean;
  result: string | null;
  error: string | null;
  copied: boolean;
  sourceLabel?: string;
  wordCount?: number;
}

const createInitialAgentStates = (): Record<AIAgentId, AgentExecutionState> => ({
  title: { loading: false, result: null, error: null, copied: false },
  abstract: { loading: false, result: null, error: null, copied: false },
  introduction: { loading: false, result: null, error: null, copied: false },
  analysis: { loading: false, result: null, error: null, copied: false },
});

export const TaskPane: React.FC<TaskPaneProps> = ({
  isOpen,
  onClose,
  activeAccordion,
  onToggleAccordion,
  manuscript,
  activeSection,
  getEditorHtml,
  onUpdateGeminiApiKey,
  selectedFootnote,
  onSelectFootnote,
  onOpenAddSource,
  onOpenImportReferences,
  onInsertCitationToEditor,
  onApplyProposal,
  onRejectProposal,
  onUpdateFootnoteContent,
  onFixOriginalityFlag,
  onAddSourceDirectly,
}) => {
  const [workbenchMode, setWorkbenchMode] = useState<'extract' | 'compare' | 'differences' | 'ask'>('compare');
  const [citationInsertStyle, setCitationInsertStyle] = useState<'oscola-footnote' | 'in-text-author-year' | 'in-text-numeric' | 'apa'>('oscola-footnote');
  const [refSearch, setRefSearch] = useState('');
  const [refFilter, setRefFilter] = useState<'all' | 'mendeley' | 'treaty' | 'case' | 'article' | 'book' | 'web'>('all');
  const [aiActionRunning, setAiActionRunning] = useState(false);
  const [aiActionResult, setAiActionResult] = useState<string | null>(null);
  const [activeAIAction, setActiveAIAction] = useState<'gap-check' | 'counter-argument' | 'clarity-pass' | 'outline' | 'tighten-budget'>('gap-check');

  // On-Demand AI Agents State (fully independent per agent)
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>(() =>
    loadStoredGeminiApiKey(manuscript.settings.geminiApiKey)
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySavedFlash, setApiKeySavedFlash] = useState(false);
  const [agentStates, setAgentStates] = useState<Record<AIAgentId, AgentExecutionState>>(
    createInitialAgentStates
  );
  const [agentToast, setAgentToast] = useState<{
    type: 'error' | 'info' | 'success';
    message: string;
  } | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const synced = loadStoredGeminiApiKey(manuscript.settings.geminiApiKey);
    if (synced !== geminiApiKeyInput && manuscript.settings.geminiApiKey !== undefined) {
      setGeminiApiKeyInput(synced);
    }
  }, [manuscript.settings.geminiApiKey]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (type: 'error' | 'info' | 'success', message: string) => {
    setAgentToast({ type, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setAgentToast(null);
    }, 3500);
  };

  const handlePersistApiKey = (nextValue?: string) => {
    const valueToSave = nextValue !== undefined ? nextValue : geminiApiKeyInput;
    const saved = saveStoredGeminiApiKey(valueToSave);
    setGeminiApiKeyInput(saved);
    onUpdateGeminiApiKey?.(saved);
    setApiKeySavedFlash(true);
    setTimeout(() => setApiKeySavedFlash(false), 1500);
    if (saved) {
      showToast('success', 'Gemini API key saved to localStorage.');
    } else {
      showToast('info', 'Gemini API key cleared.');
    }
  };

  // Reference Library Importer Methods State: Tabs
  const [libraryAddMethod, setLibraryAddMethod] = useState<'paste-doi' | 'manual' | 'file'>('paste-doi');

  // Method 1: Paste & DOI / URL State
  const [pasteInput, setPasteInput] = useState('');
  const [isPasteLoading, setIsPasteLoading] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Method 2: Manual Entry Form State
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualPublication, setManualPublication] = useState('');
  const [manualDoi, setManualDoi] = useState('');
  const [manualKind, setManualKind] = useState<LegalSourceKind>('journal-article');
  const [manualStyle, setManualStyle] = useState<'oscola' | 'apa'>('oscola');

  // Method 3: File Upload State
  const [isFileUploading, setIsFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const auditIssues = runCitationAudit(manuscript);
  const qualityFindings = runLegalQualityChecks(manuscript);

  // Method 1 Handler: Copy-Paste, DOI, or Web URL
  const handlePasteOrDoiSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = pasteInput.trim();
    if (!query || isPasteLoading) return;

    setIsPasteLoading(true);
    setPasteFeedback(null);

    try {
      const parsedSources = await parsePastedReference(query);
      if (!parsedSources || parsedSources.length === 0) {
        setPasteFeedback({
          type: 'error',
          message: 'Could not parse reference. Ensure it is a valid DOI, Web URL, BibTeX, or citation text.',
        });
        return;
      }

      parsedSources.forEach(src => {
        if (onAddSourceDirectly) {
          onAddSourceDirectly(src);
        }
      });

      setPasteFeedback({
        type: 'success',
        message: `Added to Library: "${parsedSources[0].title.slice(0, 48)}..."`,
      });
      setPasteInput('');
    } catch (err: any) {
      setPasteFeedback({
        type: 'error',
        message: err.message || 'Error fetching metadata from Crossref/Web.',
      });
    } finally {
      setIsPasteLoading(false);
    }
  };

  // Method 2 Handler: Manual Reference Entry
  const handleManualEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const newSource = createManualSource({
      title: manualTitle,
      authors: manualAuthors || 'Unknown Author',
      year: manualYear || new Date().getFullYear(),
      publication: manualPublication,
      doi: manualDoi,
      kind: manualKind,
      stylePreference: manualStyle,
    });

    if (onAddSourceDirectly) {
      onAddSourceDirectly(newSource);
    }

    setPasteFeedback({
      type: 'success',
      message: `Manually Added: "${newSource.title.slice(0, 48)}..."`,
    });

    setManualTitle('');
    setManualAuthors('');
    setManualYear('');
    setManualPublication('');
    setManualDoi('');
  };

  // Method 3 Handler: Local File Upload (.bib / .ris)
  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileUploading(true);
    setPasteFeedback(null);
    try {
      const res = await parseReferenceFile(file);
      if (res.sources.length > 0) {
        res.sources.forEach(src => {
          if (onAddSourceDirectly) {
            onAddSourceDirectly(src);
          }
        });
        setPasteFeedback({
          type: 'success',
          message: `Imported ${res.sources.length} reference${res.sources.length > 1 ? 's' : ''} from ${file.name}.`,
        });
      } else {
        setPasteFeedback({
          type: 'error',
          message: `No references detected in ${file.name}.`,
        });
      }
    } catch (err: any) {
      setPasteFeedback({
        type: 'error',
        message: `Failed to parse file: ${err.message}`,
      });
    } finally {
      setIsFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunAIAction = async (action: 'gap-check' | 'counter-argument' | 'clarity-pass' | 'outline' | 'tighten-budget') => {
    setActiveAIAction(action);
    setAiActionRunning(true);
    setAiActionResult(null);
    try {
      const secContent = activeSection.blocks.map(b => b.content).join('\n\n');
      const res = await executeSectionAIAction({
        action,
        sectionTitle: activeSection.title,
        sectionContract: activeSection.contract,
        sectionContent: secContent,
        verifiedSources: manuscript.sources,
        userGeminiKey: geminiApiKeyInput || manuscript.settings.geminiApiKey,
      });
      setAiActionResult(res.resultText);
    } catch (err) {
      console.error('AI action error:', err);
    } finally {
      setAiActionRunning(false);
    }
  };

  const handleTriggerAgent = async (agentId: AIAgentId) => {
    const activeKey = geminiApiKeyInput.trim();
    if (!activeKey) {
      showToast('error', 'Please enter your API key first');
      apiKeyInputRef.current?.focus();
      return;
    }

    // Persist key if entered in the field but not yet saved
    saveStoredGeminiApiKey(activeKey);
    if (activeKey !== (manuscript.settings.geminiApiKey || '')) {
      onUpdateGeminiApiKey?.(activeKey);
    }

    const liveHtml = getEditorHtml ? getEditorHtml() : manuscript.editorHtml || '';
    const extracted = extractSectionTextFromEditorHtml(
      liveHtml,
      agentId,
      manuscript,
      activeSection
    );

    setAgentStates(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        loading: true,
        error: null,
        copied: false,
        sourceLabel: extracted.sourceLabel,
        wordCount: extracted.wordCount,
      },
    }));

    try {
      const responseText = await runAIAgent({
        agentId,
        sectionText: extracted.text,
        apiKey: activeKey,
      });

      setAgentStates(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          loading: false,
          result: responseText,
          error: null,
          copied: false,
          sourceLabel: extracted.sourceLabel,
          wordCount: extracted.wordCount,
        },
      }));
    } catch (err) {
      const message =
        err instanceof AIAgentError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to complete AI analysis.';
      if (err instanceof AIAgentError && err.code === 'MISSING_API_KEY') {
        showToast('error', 'Please enter your API key first');
        apiKeyInputRef.current?.focus();
      } else {
        showToast('error', message);
      }
      setAgentStates(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          loading: false,
          error: message,
        },
      }));
    }
  };

  const handleCopyAgentResult = async (agentId: AIAgentId) => {
    const text = agentStates[agentId]?.result;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setAgentStates(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], copied: true },
      }));
      setTimeout(() => {
        setAgentStates(prev => ({
          ...prev,
          [agentId]: { ...prev[agentId], copied: false },
        }));
      }, 2000);
    } catch {
      showToast('error', 'Clipboard copy failed. You can select and copy the text manually.');
    }
  };

  const handleClearAgentResult = (agentId: AIAgentId) => {
    setAgentStates(prev => ({
      ...prev,
      [agentId]: { loading: false, result: null, error: null, copied: false },
    }));
  };

  const pendingReviewCount = manuscript.reviewerComments.filter(c => c.status === 'open' || c.status === 'planned').length;
  const openFlagCount = manuscript.originalityFlags.filter(f => f.status === 'open').length;

  return (
    <aside className="bg-slate-50 flex flex-col h-full select-none text-xs text-slate-700 no-print overflow-hidden w-full">
      <div className="w-full flex flex-col h-full">
        {/* Top Header with Close Sidebar Button */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100/90 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 leading-none">
                Reference &amp; Research Panels
              </h3>
              <span className="text-[10px] text-slate-500 font-normal">Collapsible Tools</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
            title="Close Sidebar (Maximize Editor)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Footnote Inspector Floating Card (if active) */}
        {selectedFootnote && (
          <div className="p-3 bg-blue-50/90 border-b border-blue-200 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-blue-900 text-xs">
                Footnote {selectedFootnote.number} Inspector
              </span>
              <button
                onClick={() => onSelectFootnote(null)}
                className="text-blue-500 hover:text-blue-800 text-[11px]"
              >
                Close
              </button>
            </div>
            <textarea
              value={selectedFootnote.content}
              onChange={e => onUpdateFootnoteContent(selectedFootnote.id, e.target.value)}
              className="w-full text-xs font-serif-legal p-2 rounded bg-white border border-blue-200 text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
            <div className="mt-1 text-[10px] text-blue-700 flex items-center justify-between">
              <span>OSCOLA Short Form</span>
              <span className="font-medium text-emerald-700">Verified</span>
            </div>
          </div>
        )}

        {/* Accordions Container */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {/* ================= 1. REFERENCE LIBRARY ACCORDION ================= */}
          <div className="bg-white">
            <button
              onClick={() => onToggleAccordion('library')}
              className={`w-full p-3 flex items-center justify-between text-left transition ${
                activeAccordion === 'library' ? 'bg-blue-50/80 font-bold text-blue-950' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-xs">Reference Library</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                  {manuscript.sources.length}
                </span>
              </div>
              {activeAccordion === 'library' ? (
                <ChevronDown className="w-4 h-4 text-blue-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {activeAccordion === 'library' && (
              <div className="p-3 space-y-3 bg-slate-50/40 border-t border-slate-100 animate-in fade-in-50 duration-200">
                {/* 1.1 Reference Addition Methods Tabs (Paste/DOI, Manual, File Upload) */}
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/80 rounded-lg text-slate-700 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryAddMethod('paste-doi');
                        setPasteFeedback(null);
                      }}
                      className={`py-1.5 px-1 rounded-md text-center transition flex items-center justify-center gap-1 ${
                        libraryAddMethod === 'paste-doi'
                          ? 'bg-white text-blue-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                      <span className="truncate">Paste / DOI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryAddMethod('manual');
                        setPasteFeedback(null);
                      }}
                      className={`py-1.5 px-1 rounded-md text-center transition flex items-center justify-center gap-1 ${
                        libraryAddMethod === 'manual'
                          ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Edit3 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate">Manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryAddMethod('file');
                        setPasteFeedback(null);
                      }}
                      className={`py-1.5 px-1 rounded-md text-center transition flex items-center justify-center gap-1 ${
                        libraryAddMethod === 'file'
                          ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileUp className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span className="truncate">File (.ris/.bib)</span>
                    </button>
                  </div>

                  {/* Feedback Message Banner */}
                  {pasteFeedback && (
                    <div
                      className={`p-2 rounded text-[11px] flex items-start gap-1.5 animate-in fade-in-50 duration-150 ${
                        pasteFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {pasteFeedback.type === 'success' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span className="flex-1 leading-snug">{pasteFeedback.message}</span>
                      <button
                        onClick={() => setPasteFeedback(null)}
                        className="text-slate-400 hover:text-slate-600 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* TAB 1: Copy-Paste, DOI & URL Importer */}
                  {libraryAddMethod === 'paste-doi' && (
                    <form
                      onSubmit={handlePasteOrDoiSubmit}
                      className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5 text-blue-600" />
                          Paste DOI, URL, or Raw Citation
                        </span>
                        <span className="text-[9px] text-blue-700 font-medium">Crossref Connected</span>
                      </div>

                      <div className="relative">
                        <textarea
                          rows={2}
                          value={pasteInput}
                          onChange={e => setPasteInput(e.target.value)}
                          placeholder="e.g. 10.1038/nature12373, https://www.un.org/..., or Hart (1994)..."
                          className="w-full text-xs p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="submit"
                          disabled={!pasteInput.trim() || isPasteLoading}
                          className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                        >
                          {isPasteLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Fetching Metadata...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Reference</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Quick Sample Presets */}
                      <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] text-slate-400">Try sample:</span>
                        <button
                          type="button"
                          onClick={() => setPasteInput('10.1038/nature12373')}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded border border-slate-200/80 transition text-[9px]"
                        >
                          DOI (Nature)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPasteInput('https://www.ohchr.org/en/treaty-bodies/ccpr')}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded border border-slate-200/80 transition text-[9px]"
                        >
                          UN Treaty Web URL
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: Manual Reference Entry Form */}
                  {libraryAddMethod === 'manual' && (
                    <form
                      onSubmit={handleManualEntrySubmit}
                      className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-2 animate-in fade-in-50 duration-150"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
                        <span className="flex items-center gap-1">
                          <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                          Manual Reference Entry
                        </span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setManualStyle('oscola')}
                            className={`px-1.5 py-0.2 rounded border ${
                              manualStyle === 'oscola'
                                ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            OSCOLA
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualStyle('apa')}
                            className={`px-1.5 py-0.2 rounded border ${
                              manualStyle === 'apa'
                                ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            APA
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                            Title *
                          </label>
                          <input
                            type="text"
                            required
                            value={manualTitle}
                            onChange={e => setManualTitle(e.target.value)}
                            placeholder="e.g. The Concept of Law"
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="col-span-2">
                            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                              Author(s) *
                            </label>
                            <input
                              type="text"
                              required
                              value={manualAuthors}
                              onChange={e => setManualAuthors(e.target.value)}
                              placeholder="e.g. H.L.A. Hart"
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                              Year *
                            </label>
                            <input
                              type="text"
                              required
                              value={manualYear}
                              onChange={e => setManualYear(e.target.value)}
                              placeholder="1994"
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                              Journal / Publisher
                            </label>
                            <input
                              type="text"
                              value={manualPublication}
                              onChange={e => setManualPublication(e.target.value)}
                              placeholder="e.g. Oxford University Press"
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                              DOI (Optional)
                            </label>
                            <input
                              type="text"
                              value={manualDoi}
                              onChange={e => setManualDoi(e.target.value)}
                              placeholder="10.1093/..."
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                            Source Type
                          </label>
                          <select
                            value={manualKind}
                            onChange={e => setManualKind(e.target.value as LegalSourceKind)}
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none"
                          >
                            <option value="journal-article">Journal Article</option>
                            <option value="book-chapter">Book / Chapter</option>
                            <option value="treaty">Treaty / Convention</option>
                            <option value="un-document">UN Document</option>
                            <option value="statute">Statute / Legislation</option>
                            <option value="case">Court Judgment / Case</option>
                            <option value="report">Report / Policy Paper</option>
                            <option value="news-web">Website / Online</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!manualTitle.trim()}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Reference Library</span>
                      </button>
                    </form>
                  )}

                  {/* TAB 3: File Upload (.ris / .bib) */}
                  {libraryAddMethod === 'file' && (
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2.5 text-center animate-in fade-in-50 duration-150">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUploadChange}
                        accept=".bib,.ris,.txt"
                        className="hidden"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-lg p-4 cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
                      >
                        <BookMarked className="w-6 h-6 text-indigo-600" />
                        <div>
                          <span className="font-semibold text-xs text-slate-800 block">
                            Choose Mendeley / Zotero Export
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            Supports .bib (BibTeX) and .ris standard files
                          </span>
                        </div>
                        <button
                          type="button"
                          className="mt-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-xs shadow-2xs"
                        >
                          {isFileUploading ? 'Importing File...' : 'Browse File (.bib / .ris)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1.2 In-text Citation Format Selector */}
                <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <span className="font-semibold uppercase tracking-wider">Citation Format to Insert:</span>
                    <span className="text-blue-700 font-mono text-[9px]">Click card to insert</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <button
                      onClick={() => setCitationInsertStyle('oscola-footnote')}
                      className={`py-1 px-1.5 rounded text-left border transition ${
                        citationInsertStyle === 'oscola-footnote'
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Footnote [fn]
                    </button>
                    <button
                      onClick={() => setCitationInsertStyle('in-text-author-year')}
                      className={`py-1 px-1.5 rounded text-left border transition ${
                        citationInsertStyle === 'in-text-author-year'
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      (Author, Year)
                    </button>
                    <button
                      onClick={() => setCitationInsertStyle('in-text-numeric')}
                      className={`py-1 px-1.5 rounded text-left border transition ${
                        citationInsertStyle === 'in-text-numeric'
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Numeric [1]
                    </button>
                    <button
                      onClick={() => setCitationInsertStyle('apa')}
                      className={`py-1 px-1.5 rounded text-left border transition ${
                        citationInsertStyle === 'apa'
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Author (Year)
                    </button>
                  </div>
                </div>

                {/* 1.3 Search & Category Filter */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={refSearch}
                      onChange={e => setRefSearch(e.target.value)}
                      placeholder="Search title, author, year, DOI..."
                      className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5">
                    {(['all', 'mendeley', 'article', 'book', 'treaty', 'case', 'web'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setRefFilter(f)}
                        className={`px-2 py-0.5 rounded capitalize whitespace-nowrap transition ${
                          refFilter === f
                            ? 'bg-blue-600 text-white font-medium'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1.4 References List */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                  {manuscript.sources
                    .filter(s => {
                      if (refSearch) {
                        const q = refSearch.toLowerCase();
                        const matchesTitle = s.title.toLowerCase().includes(q);
                        const matchesAuthor = s.authors.some(a => a.toLowerCase().includes(q));
                        const matchesYear = s.year.toString().includes(q);
                        const matchesDoi = s.doi?.toLowerCase().includes(q);
                        if (!matchesTitle && !matchesAuthor && !matchesYear && !matchesDoi) return false;
                      }
                      if (refFilter === 'mendeley') {
                        return s.tags?.includes('mendeley') || s.id.startsWith('mendeley_') || s.id.startsWith('ris_');
                      }
                      if (refFilter === 'article') return s.kind === 'journal-article';
                      if (refFilter === 'book') return s.kind === 'book-chapter';
                      if (refFilter === 'treaty') return s.kind === 'treaty' || s.kind === 'un-document';
                      if (refFilter === 'case') return s.kind === 'case';
                      if (refFilter === 'web') return s.kind === 'news-web' || s.tags?.includes('web');
                      return true;
                    })
                    .map(src => {
                      const isMendeley = src.tags?.includes('mendeley') || src.id.startsWith('mendeley_') || src.id.startsWith('ris_');
                      const isDoi = !!src.doi || src.tags?.includes('crossref') || src.tags?.includes('doi');

                      return (
                        <div
                          key={src.id}
                          onClick={() => onInsertCitationToEditor(src, citationInsertStyle)}
                          className="group bg-white border border-slate-200 hover:border-blue-500 hover:shadow-xs rounded-md p-2.5 cursor-pointer transition relative"
                          title="Click to insert citation at cursor in editor"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {src.kind}
                              </span>
                              {isMendeley && (
                                <span className="text-[9px] px-1 py-0.2 bg-indigo-50 text-indigo-700 font-semibold rounded border border-indigo-200">
                                  Mendeley
                                </span>
                              )}
                              {isDoi && (
                                <span className="text-[9px] px-1 py-0.2 bg-blue-50 text-blue-700 font-semibold rounded border border-blue-200">
                                  DOI
                                </span>
                              )}
                              {src.kind === 'news-web' && (
                                <span className="text-[9px] px-1 py-0.2 bg-teal-50 text-teal-700 font-semibold rounded border border-teal-200">
                                  Web
                                </span>
                              )}
                            </div>
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                              + Insert
                            </span>
                          </div>

                          <h4 className="font-medium text-slate-900 leading-snug group-hover:text-blue-900 transition-colors">
                            {src.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {src.authors.join(', ')} ({src.year})
                          </p>
                          <div className="mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono truncate">
                            {src.citationString}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* 1.5 10-Point Citation Audit Mini Summary */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 text-[11px]">10-Point Citation Audit</span>
                    <span className="text-[10px] text-slate-500">{auditIssues.length} issues</span>
                  </div>
                  {auditIssues.length === 0 ? (
                    <div className="p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-[10px] flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>All citations &amp; acronyms verified.</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                      {auditIssues[0].title}: {auditIssues[0].description}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= 2. EVIDENCE WORKBENCH ACCORDION ================= */}
          <div className="bg-white">
            <button
              onClick={() => onToggleAccordion('workbench')}
              className={`w-full p-3 flex items-center justify-between text-left transition ${
                activeAccordion === 'workbench' ? 'bg-indigo-50/80 font-bold text-indigo-950' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-xs">Evidence Workbench (NotebookLM)</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                  {manuscript.workbenchDocuments.length}
                </span>
              </div>
              {activeAccordion === 'workbench' ? (
                <ChevronDown className="w-4 h-4 text-indigo-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {activeAccordion === 'workbench' && (
              <div className="p-3 space-y-3 bg-slate-50/40 border-t border-slate-100 animate-in fade-in-50 duration-200">
                <p className="text-[11px] text-slate-500">
                  Source-only evidence matrix. Quotes are mathematically verified against ingested PDFs.
                </p>

                {/* Mode Selector */}
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-200 rounded">
                  {(['extract', 'compare', 'differences', 'ask'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setWorkbenchMode(mode)}
                      className={`py-1 rounded text-center font-medium capitalize text-[10px] transition ${
                        workbenchMode === mode ? 'bg-white text-indigo-900 font-bold shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Evidence Findings */}
                <div className="space-y-2">
                  {manuscript.workbenchFindings.map(find => (
                    <div key={find.id} className="bg-white border border-slate-200 rounded p-2.5 space-y-2">
                      <h4 className="font-semibold text-slate-900 text-xs">{find.question}</h4>
                      <div className="space-y-1.5">
                        {Object.entries(find.data).map(([docId, quote]) => {
                          const doc = manuscript.workbenchDocuments.find(d => d.id === docId);
                          const trace = find.traces[docId];
                          return (
                            <div key={docId} className="bg-slate-50 p-2 rounded border border-slate-200/80 text-[11px]">
                              <div className="flex items-center justify-between text-[10px] mb-0.5 font-semibold text-slate-700">
                                <span>{doc?.shortTitle || docId}</span>
                                <span className="text-emerald-700 font-mono">{trace}</span>
                              </div>
                              <p className="font-serif-legal italic text-slate-800 leading-relaxed">
                                "{quote}"
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= 3. REVIEW DESK ACCORDION ================= */}
          <div className="bg-white">
            <button
              onClick={() => onToggleAccordion('review')}
              className={`w-full p-3 flex items-center justify-between text-left transition ${
                activeAccordion === 'review' ? 'bg-amber-50/80 font-bold text-amber-950' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-xs">Review Desk</span>
                {pendingReviewCount > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                    {pendingReviewCount} open
                  </span>
                )}
              </div>
              {activeAccordion === 'review' ? (
                <ChevronDown className="w-4 h-4 text-amber-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {activeAccordion === 'review' && (
              <div className="p-3 space-y-3 bg-slate-50/40 border-t border-slate-100 animate-in fade-in-50 duration-200">
                <p className="text-[11px] text-slate-500">
                  Reviewer comments split into atomic items with concrete revision proposals.
                </p>

                <div className="space-y-2.5">
                  {manuscript.reviewerComments.map(c => (
                    <div key={c.id} className="bg-white border border-slate-200 rounded p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">{c.reviewer}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                          {c.severity}
                        </span>
                      </div>
                      <p className="font-serif-legal italic text-slate-800 bg-amber-50/50 p-2 rounded border border-amber-100 text-[11px]">
                        "{c.raw}"
                      </p>
                      {manuscript.proposals.filter(p => p.commentId === c.id).map(prop => (
                        <div key={prop.id} className="bg-indigo-50/60 p-2 rounded border border-indigo-200 text-[11px] space-y-1">
                          <span className="font-semibold text-indigo-950 block">Proposal: {prop.plan}</span>
                          {prop.status === 'pending' && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => onApplyProposal(prop.id)}
                                className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-medium"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => onRejectProposal(prop.id)}
                                className="py-1 px-2.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= 4. ORIGINALITY GUARD ACCORDION ================= */}
          <div className="bg-white">
            <button
              onClick={() => onToggleAccordion('guard')}
              className={`w-full p-3 flex items-center justify-between text-left transition ${
                activeAccordion === 'guard' ? 'bg-rose-50/80 font-bold text-rose-950' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span className="font-semibold text-xs">Originality Guard</span>
                {openFlagCount > 0 && (
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full font-bold">
                    {openFlagCount}
                  </span>
                )}
              </div>
              {activeAccordion === 'guard' ? (
                <ChevronDown className="w-4 h-4 text-rose-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {activeAccordion === 'guard' && (
              <div className="p-3 space-y-3 bg-slate-50/40 border-t border-slate-100 animate-in fade-in-50 duration-200">
                <p className="text-[11px] text-slate-500">
                  Live local similarity scan against library texts and loaded evidence PDFs.
                </p>

                <div className="space-y-2">
                  {manuscript.originalityFlags.filter(f => f.status !== 'dismissed').map(fl => (
                    <div key={fl.id} className="bg-white border border-slate-200 rounded p-2 text-xs space-y-1">
                      <div className="flex justify-between font-semibold capitalize text-[10px]">
                        <span className={fl.kind === 'verbatim-match' ? 'text-red-600' : 'text-amber-600'}>
                          {fl.kind.replace('-', ' ')}
                        </span>
                        <span className="text-slate-400">{Math.round((fl.score || 1) * 100)}%</span>
                      </div>
                      <p className="font-serif-legal italic text-slate-800 text-[11px] bg-slate-50 p-1 rounded">
                        "{fl.textSpan}"
                      </p>
                      <div className="flex gap-1.5 pt-0.5">
                        <button
                          onClick={() => onFixOriginalityFlag(fl, 'quote')}
                          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]"
                        >
                          Quote It
                        </button>
                        <button
                          onClick={() => onFixOriginalityFlag(fl, 'cite')}
                          className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]"
                        >
                          Cite It
                        </button>
                        <button
                          onClick={() => onFixOriginalityFlag(fl, 'dismiss')}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= 5. LANGUAGE STUDIO ACCORDION ================= */}
          <div className="bg-white">
            <button
              onClick={() => onToggleAccordion('language')}
              className={`w-full p-3 flex items-center justify-between text-left transition ${
                activeAccordion === 'language' ? 'bg-emerald-50/80 font-bold text-emerald-950' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Feather className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-xs">Language Studio (en-GB)</span>
              </div>
              {activeAccordion === 'language' ? (
                <ChevronDown className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {activeAccordion === 'language' && (
              <div className="p-3 space-y-3 bg-slate-50/40 border-t border-slate-100 animate-in fade-in-50 duration-200">
                <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200 space-y-1 text-emerald-900 text-[11px]">
                  <div className="flex items-center gap-1 font-bold">
                    <Lock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Legal Meaning Guard Active</span>
                  </div>
                  <p className="text-[10px] text-emerald-800">
                    Modal verbs (shall/may, must/should) and quotations are strictly protected.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Academic Phrase Bank
                  </span>
                  {[
                    { f: 'Signposting', t: 'This section examines whether the threshold condition...' },
                    { f: 'Applying Test', t: 'Applying the legality prong of Article 19(3), the measure fails...' },
                    { f: 'Concession', t: 'It could be objected that automated tools operate at scale; however...' },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded p-2 text-xs">
                      <span className="font-semibold text-blue-800 text-[10px] block">{item.f}</span>
                      <p className="text-[11px] text-slate-700 italic mt-0.5">"{item.t}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= 6. SECTION AI COPILOT ACCORDION ================= */}
          <div className="bg-white">
            <button
              onClick={() => onToggleAccordion('ai')}
              className={`w-full p-3 flex items-center justify-between text-left transition ${
                activeAccordion === 'ai' ? 'bg-purple-50/80 font-bold text-purple-950' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-xs">Section AI Copilot</span>
              </div>
              {activeAccordion === 'ai' ? (
                <ChevronDown className="w-4 h-4 text-purple-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {activeAccordion === 'ai' && (
              <div className="p-3 space-y-3 bg-slate-50/60 border-t border-slate-100 animate-in fade-in-50 duration-200">
                {/* 1. Gemini API Key Management */}
                <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hm-copilot-api-key"
                      className="flex items-center gap-1.5 font-semibold text-[11px] text-slate-800"
                    >
                      <Key className="w-3.5 h-3.5 text-purple-600" />
                      <span>Gemini API Key</span>
                    </label>
                    {geminiApiKeyInput.trim() ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Saved locally
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Key required
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                      <input
                        id="hm-copilot-api-key"
                        ref={apiKeyInputRef}
                        type={showApiKey ? 'text' : 'password'}
                        value={geminiApiKeyInput}
                        onChange={e => setGeminiApiKeyInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePersistApiKey();
                          }
                        }}
                        placeholder="Paste your Gemini API key..."
                        className="w-full pr-7 pl-2 py-1.5 text-[11px] font-mono bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 select-text"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(prev => !prev)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                        title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePersistApiKey()}
                      className="px-2.5 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[11px] transition shrink-0 flex items-center gap-1"
                    >
                      {apiKeySavedFlash ? <Check className="w-3 h-3" /> : null}
                      <span>{apiKeySavedFlash ? 'Saved' : 'Save'}</span>
                    </button>
                    {geminiApiKeyInput.trim() && (
                      <button
                        type="button"
                        onClick={() => handlePersistApiKey('')}
                        className="p-1.5 rounded border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-400 transition shrink-0"
                        title="Clear saved API key"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Stored only in browser <code className="text-[9.5px] bg-slate-100 px-1 rounded">localStorage</code>. Agents run strictly on-demand when clicked.
                  </p>
                </div>

                {/* 2. On-Demand Specialized AI Agents */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 text-purple-600" />
                      Specialized AI Agents
                    </span>
                    <span className="text-[10px] text-slate-400">Manual trigger</span>
                  </div>

                  {AI_AGENTS.map(agent => {
                    const st = agentStates[agent.id];
                    return (
                      <div
                        key={agent.id}
                        className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[11.5px] text-slate-900">
                                {agent.name}
                              </span>
                              <span className="text-[9.5px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {agent.sectionLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                              {agent.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTriggerAgent(agent.id)}
                          disabled={st.loading}
                          className={`w-full py-1.5 px-2.5 rounded border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
                            st.loading
                              ? 'bg-purple-50 border-purple-200 text-purple-700 cursor-wait'
                              : 'bg-slate-50 hover:bg-purple-50 border-slate-300 hover:border-purple-300 text-slate-800 hover:text-purple-900'
                          }`}
                        >
                          {st.loading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                              <span>Analyzing {agent.sectionLabel}...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>{agent.buttonLabel}</span>
                            </>
                          )}
                        </button>

                        {st.error && (
                          <div className="p-2 rounded bg-red-50 border border-red-200 text-red-800 text-[10.5px] flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <span className="flex-1 leading-snug select-text">{st.error}</span>
                          </div>
                        )}

                        {st.result && (
                          <div className="border border-purple-200 rounded bg-slate-50/70 overflow-hidden">
                            <div className="px-2 py-1.5 bg-purple-50/80 border-b border-purple-100 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-medium text-purple-900 truncate">
                                {st.sourceLabel || agent.sectionLabel}
                                {typeof st.wordCount === 'number' && st.wordCount > 0
                                  ? ` · ${st.wordCount} words`
                                  : ''}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyAgentResult(agent.id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-purple-100 border border-purple-200 text-purple-800 font-semibold text-[10px] transition"
                                  title="Copy response to clipboard"
                                >
                                  {st.copied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearAgentResult(agent.id)}
                                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition"
                                  title="Dismiss output"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="p-2.5 max-h-60 overflow-y-auto bg-white select-text">
                              <MarkdownResponse content={st.result} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. Existing Quick Section Tools */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Quick Section Tools ({activeSection.role})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleRunAIAction('gap-check')}
                      disabled={aiActionRunning}
                      className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left transition"
                    >
                      <span className="font-semibold text-slate-900 block text-[11px]">Gap Check</span>
                      <span className="text-[9px] text-slate-400">Doctrinal leaps</span>
                    </button>
                    <button
                      onClick={() => handleRunAIAction('counter-argument')}
                      disabled={aiActionRunning}
                      className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left transition"
                    >
                      <span className="font-semibold text-slate-900 block text-[11px]">Counter-Arg</span>
                      <span className="text-[9px] text-slate-400">Peer reviewer</span>
                    </button>
                    <button
                      onClick={() => handleRunAIAction('clarity-pass')}
                      disabled={aiActionRunning}
                      className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left transition"
                    >
                      <span className="font-semibold text-slate-900 block text-[11px]">Clarity Pass</span>
                      <span className="text-[9px] text-slate-400">en-GB flow</span>
                    </button>
                    <button
                      onClick={() => handleRunAIAction('tighten-budget')}
                      disabled={aiActionRunning}
                      className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left transition"
                    >
                      <span className="font-semibold text-slate-900 block text-[11px]">Tighten</span>
                      <span className="text-[9px] text-slate-400">Word cuts</span>
                    </button>
                  </div>

                  {aiActionRunning && (
                    <div className="p-3 bg-purple-50 rounded text-center space-y-1 text-purple-900 text-xs">
                      <RefreshCw className="w-4 h-4 text-purple-600 animate-spin mx-auto" />
                      <span>Analyzing {activeAIAction}...</span>
                    </div>
                  )}

                  {aiActionResult && (
                    <div className="bg-white border border-slate-200 rounded p-2.5 text-xs max-h-56 overflow-y-auto select-text">
                      <MarkdownResponse content={aiActionResult} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {agentToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-8 right-5 z-50 max-w-xs px-3 py-2 rounded-md shadow-lg border text-xs font-medium flex items-center gap-2 select-text ${
            agentToast.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : agentToast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-slate-800 border-slate-700 text-white'
          }`}
        >
          {agentToast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : agentToast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
          )}
          <span className="flex-1">{agentToast.message}</span>
          <button
            type="button"
            onClick={() => setAgentToast(null)}
            className="opacity-60 hover:opacity-100 p-0.5"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};
