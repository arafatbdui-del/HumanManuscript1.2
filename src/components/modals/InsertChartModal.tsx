/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modern Chart Builder Modal using Chart.js & react-chartjs-2
 * Parses CSV input, renders a crisp live preview, and exports a Base64 PNG <img> into TipTap.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  Plugin,
  ChartOptions,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { BarChart3, LineChart, PieChart, X, AlertCircle, Sparkles } from 'lucide-react';
import { ChartKind, parseChartCsv } from '../../services/chartParser';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DEFAULT_CSV = `Category, Value
2021, 50
2022, 80
2023, 115
2024, 152`;

const MODERN_PALETTE = [
  '#2563eb', // Blue 600
  '#0d9488', // Teal 600
  '#7c3aed', // Violet 600
  '#d97706', // Amber 600
  '#e11d48', // Rose 600
  '#0284c7', // Sky 600
  '#059669', // Emerald 600
  '#4f46e5', // Indigo 600
];

const MODERN_FILL_PALETTE = [
  'rgba(37, 99, 235, 0.85)',
  'rgba(13, 148, 136, 0.85)',
  'rgba(124, 58, 237, 0.85)',
  'rgba(217, 119, 6, 0.85)',
  'rgba(225, 29, 72, 0.85)',
  'rgba(2, 132, 199, 0.85)',
  'rgba(5, 150, 105, 0.85)',
  'rgba(79, 70, 229, 0.85)',
];

// Ensures the exported Base64 PNG always has a crisp opaque white canvas background
const whiteCanvasBackgroundPlugin: Plugin = {
  id: 'hmWhiteCanvasBackground',
  beforeDraw: chart => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

interface InsertChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertChartImage: (base64Src: string, altText: string) => void;
}

export const InsertChartModal: React.FC<InsertChartModalProps> = ({
  isOpen,
  onClose,
  onInsertChartImage,
}) => {
  const [chartType, setChartType] = useState<ChartKind>('bar');
  const [chartTitle, setChartTitle] = useState('Annual Findings Overview');
  const [csvText, setCsvText] = useState(DEFAULT_CSV);
  const chartRef = useRef<any>(null);

  const parsed = useMemo(() => parseChartCsv(csvText), [csvText]);

  const chartData = useMemo(() => {
    if (parsed.error || parsed.labels.length === 0) {
      return { labels: [], datasets: [] };
    }

    if (chartType === 'pie') {
      const firstSeries = parsed.datasets[0];
      return {
        labels: parsed.labels,
        datasets: [
          {
            label: firstSeries.label,
            data: firstSeries.values,
            backgroundColor: parsed.labels.map(
              (_, i) => MODERN_FILL_PALETTE[i % MODERN_FILL_PALETTE.length]
            ),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      };
    }

    return {
      labels: parsed.labels,
      datasets: parsed.datasets.map((ds, idx) => {
        const solid = MODERN_PALETTE[idx % MODERN_PALETTE.length];
        const fill =
          chartType === 'line'
            ? solid === '#2563eb'
              ? 'rgba(37, 99, 235, 0.12)'
              : 'rgba(13, 148, 136, 0.12)'
            : MODERN_FILL_PALETTE[idx % MODERN_FILL_PALETTE.length];

        return {
          label: ds.label,
          data: ds.values,
          backgroundColor: fill,
          borderColor: solid,
          borderWidth: chartType === 'line' ? 2.5 : 0,
          borderRadius: chartType === 'bar' ? 6 : 0,
          tension: chartType === 'line' ? 0.35 : 0,
          fill: chartType === 'line',
          pointRadius: chartType === 'line' ? 4 : 0,
          pointBackgroundColor: solid,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
        };
      }),
    };
  }, [parsed, chartType]);

  const commonOptions = useMemo((): ChartOptions<any> => {
    const hasTitle = chartTitle.trim().length > 0;
    const base: ChartOptions<any> = {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      animation: {
        duration: 250,
      },
      layout: {
        padding: { top: 14, right: 18, bottom: 10, left: 12 },
      },
      plugins: {
        legend: {
          display: chartType === 'pie' || parsed.datasets.length > 1,
          position: 'bottom' as const,
          labels: {
            color: '#334155',
            font: {
              family: 'system-ui, -apple-system, Segoe UI, sans-serif',
              size: 12,
              weight: '500',
            },
            padding: 14,
            usePointStyle: true,
          },
        },
        title: {
          display: hasTitle,
          text: chartTitle.trim(),
          color: '#0f172a',
          font: {
            family: 'system-ui, -apple-system, Segoe UI, sans-serif',
            size: 15,
            weight: '700',
          },
          padding: { bottom: 14 },
        },
      },
    };

    if (chartType !== 'pie') {
      base.scales = {
        x: {
          grid: { display: false },
          border: { color: '#cbd5e1' },
          ticks: {
            color: '#475569',
            font: {
              family: 'system-ui, -apple-system, Segoe UI, sans-serif',
              size: 11,
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
          border: { display: false },
          ticks: {
            color: '#475569',
            font: {
              family: 'system-ui, -apple-system, Segoe UI, sans-serif',
              size: 11,
            },
          },
        },
      };
    }

    return base;
  }, [chartTitle, chartType, parsed.datasets.length]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    if (parsed.error || parsed.labels.length === 0) return;
    const instance = chartRef.current;
    if (!instance || typeof instance.toBase64Image !== 'function') return;

    const base64 = instance.toBase64Image('image/png', 1.0);
    if (base64) {
      onInsertChartImage(base64, chartTitle.trim() || `${chartType} chart`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {chartType === 'bar' ? (
              <BarChart3 className="w-5 h-5 text-blue-600" />
            ) : chartType === 'line' ? (
              <LineChart className="w-5 h-5 text-teal-600" />
            ) : (
              <PieChart className="w-5 h-5 text-violet-600" />
            )}
            <div>
              <h3 className="font-bold text-sm text-slate-900">Insert Modern Chart</h3>
              <p className="text-[11px] text-slate-500">
                Paste CSV data to render a clean high-resolution chart directly into your manuscript.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            aria-label="Close chart modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          {/* Controls Column */}
          <div className="md:col-span-5 space-y-3">
            <div>
              <label
                htmlFor="hm-chart-type"
                className="font-semibold text-slate-700 block mb-1"
              >
                Chart Type
              </label>
              <select
                id="hm-chart-type"
                value={chartType}
                onChange={e => setChartType(e.target.value as ChartKind)}
                className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="hm-chart-title"
                className="font-semibold text-slate-700 block mb-1"
              >
                Chart Title (Optional)
              </label>
              <input
                id="hm-chart-title"
                type="text"
                value={chartTitle}
                onChange={e => setChartTitle(e.target.value)}
                placeholder="e.g., Content Removals by Year"
                className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hm-chart-csv" className="font-semibold text-slate-700">
                  CSV Data
                </label>
                <span className="text-[10px] text-slate-400">Header + rows</span>
              </div>
              <textarea
                id="hm-chart-csv"
                rows={7}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={'Category, Value\n2021, 50\n2022, 80'}
                className="w-full border border-slate-300 rounded-md p-2.5 font-mono text-[11px] bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Supports single or multi-series columns (e.g. Category, Series A, Series B).
              </p>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="md:col-span-7 flex flex-col">
            <span className="font-semibold text-slate-700 block mb-1">Live Preview</span>
            <div className="flex-1 min-h-[260px] bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-center">
              {parsed.error ? (
                <div className="text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3 max-w-xs space-y-1">
                  <AlertCircle className="w-5 h-5 text-rose-600 mx-auto" />
                  <p className="font-semibold text-xs">Invalid CSV Format</p>
                  <p className="text-[11px] text-rose-600">{parsed.error}</p>
                </div>
              ) : (
                <div className="w-full h-[250px]">
                  {chartType === 'bar' && (
                    <Bar
                      ref={chartRef}
                      data={chartData}
                      options={commonOptions}
                      plugins={[whiteCanvasBackgroundPlugin]}
                    />
                  )}
                  {chartType === 'line' && (
                    <Line
                      ref={chartRef}
                      data={chartData}
                      options={commonOptions}
                      plugins={[whiteCanvasBackgroundPlugin]}
                    />
                  )}
                  {chartType === 'pie' && (
                    <Pie
                      ref={chartRef}
                      data={chartData}
                      options={commonOptions}
                      plugins={[whiteCanvasBackgroundPlugin]}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!!parsed.error || parsed.labels.length === 0}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
