/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CSV Parser utility for Modern Chart generation inside HumanManuscript
 */

export type ChartKind = 'bar' | 'line' | 'pie';

export interface ParsedChartDataset {
  label: string;
  values: number[];
}

export interface ParsedChartCsvResult {
  labels: string[];
  datasets: ParsedChartDataset[];
  error?: string;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumericCell(raw: string): number {
  const cleaned = raw.replace(/[$£€¥,\s%]/g, '');
  if (!cleaned) return NaN;
  return Number(cleaned);
}

export function parseChartCsv(csvText: string): ParsedChartCsvResult {
  const rawLines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return {
      labels: [],
      datasets: [],
      error: 'Please enter CSV data (e.g., Category, Value).',
    };
  }

  // Detect delimiter (comma, tab, or semicolon)
  const firstLine = rawLines[0];
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : !firstLine.includes(',') && firstLine.includes(';')
      ? ';'
      : ',';

  const rows = rawLines.map(line => splitCsvLine(line, delimiter));
  if (rows.some(r => r.length < 2)) {
    return {
      labels: [],
      datasets: [],
      error: 'Each CSV row must have at least 2 columns (Label, Value).',
    };
  }

  // Determine whether first row is a header row (non-numeric value column)
  const firstRowHasNumeric = rows[0]
    .slice(1)
    .every(cell => !Number.isNaN(parseNumericCell(cell)));

  const headers = firstRowHasNumeric
    ? rows[0].slice(1).map((_, idx) => `Series ${idx + 1}`)
    : rows[0].slice(1).map((h, idx) => h || `Series ${idx + 1}`);

  const dataRows = firstRowHasNumeric ? rows : rows.slice(1);
  if (dataRows.length === 0) {
    return {
      labels: [],
      datasets: [],
      error: 'Add at least one data row below the header row.',
    };
  }

  const labels: string[] = [];
  const seriesValues: number[][] = headers.map(() => []);

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const row = dataRows[rIdx];
    const label = row[0] || `Item ${rIdx + 1}`;
    labels.push(label);

    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      const rawCell = row[cIdx + 1] ?? '0';
      const val = parseNumericCell(rawCell);
      if (Number.isNaN(val)) {
        return {
          labels: [],
          datasets: [],
          error: `Row ${rIdx + (firstRowHasNumeric ? 1 : 2)} column "${headers[cIdx]}" has non-numeric value "${rawCell}".`,
        };
      }
      seriesValues[cIdx].push(val);
    }
  }

  return {
    labels,
    datasets: headers.map((label, idx) => ({
      label,
      values: seriesValues[idx],
    })),
  };
}
