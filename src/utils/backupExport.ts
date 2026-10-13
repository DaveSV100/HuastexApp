// src/utils/backupExport.ts
// Backup ("Descargar") logic shared by the Perfil download menu: fetch the
// requested datasets with progress reporting, then build a single Excel
// workbook (one sheet per dataset) or a text PDF. Pure of any UI so it can be
// unit-tested; saving/sharing the file lives in DownloadContext.
import * as XLSX from 'xlsx';
import api from '../api';
import { textToPdfBase64 } from './simplePdf';

export type BackupScope = 'todo' | 'inventario' | 'ventas' | 'reporte';
export type BackupFormat = 'excel' | 'pdf';

export const SCOPE_LABELS: Record<BackupScope, string> = {
  todo: 'Todo',
  inventario: 'Inventario',
  ventas: 'Ventas',
  reporte: 'Reporte Diario',
};

interface Dataset {
  key: string;
  sheetName: string;
  endpoint: string;
  rows: any[];
}

const DATASETS: Record<Exclude<BackupScope, 'todo'>, { sheetName: string; endpoint: string }> = {
  inventario: { sheetName: 'Inventario', endpoint: '/inventory' },
  ventas: { sheetName: 'Ventas', endpoint: '/sales' },
  reporte: { sheetName: 'ReporteDiario', endpoint: '/transactions' },
};

export const scopeKeys = (scope: BackupScope): Array<Exclude<BackupScope, 'todo'>> =>
  scope === 'todo' ? ['inventario', 'ventas', 'reporte'] : [scope];

/**
 * Rows ready for export: drop the giant base64 signature and flatten the
 * nested products array so cells stay readable.
 */
export const sanitizeRow = (row: any): any => {
  const out: any = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (key === 'firmadigital') continue;
    if (Array.isArray(value)) {
      out[key] = value
        .map((p: any) =>
          p && typeof p === 'object'
            ? `${p.title ?? p.producto ?? ''} x${p.quantity ?? 1} ($${p.unit_price ?? ''})`
            : String(p),
        )
        .join(' | ');
    } else if (value !== null && typeof value === 'object') {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

/**
 * Download every dataset of the scope. `onProgress(fraction, label)` moves
 * 0 → 0.8 across the network phase (per-dataset chunks, plus byte progress
 * when the server reports a Content-Length).
 */
export async function fetchBackupData(
  scope: BackupScope,
  onProgress: (fraction: number, label: string) => void,
): Promise<Dataset[]> {
  const keys = scopeKeys(scope);
  const result: Dataset[] = [];
  for (let i = 0; i < keys.length; i++) {
    const { sheetName, endpoint } = DATASETS[keys[i]];
    onProgress((i / keys.length) * 0.8, `Descargando ${SCOPE_LABELS[keys[i]]}…`);
    const res = await api.get(endpoint, {
      onDownloadProgress: e => {
        const frac = e.total ? Math.min(e.loaded / e.total, 1) : 0.5;
        onProgress(((i + frac) / keys.length) * 0.8, `Descargando ${SCOPE_LABELS[keys[i]]}…`);
      },
    });
    result.push({
      key: keys[i],
      sheetName,
      endpoint,
      rows: Array.isArray(res.data) ? res.data : [],
    });
  }
  onProgress(0.8, 'Generando archivo…');
  return result;
}

/** One workbook, one sheet per dataset, all columns. */
export function buildExcelBase64(datasets: Dataset[]): string {
  const wb = XLSX.utils.book_new();
  for (const ds of datasets) {
    const rows = ds.rows.map(sanitizeRow);
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ vacio: 'sin datos' }]);
    XLSX.utils.book_append_sheet(wb, sheet, ds.sheetName);
  }
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

// PDF keeps a curated column set per dataset so lines stay readable; Excel is
// the full dump.
const PDF_COLUMNS: Record<string, string[]> = {
  inventario: [
    'id', 'product', 'model', 'price_cost', 'cerro_azul_price', 'aquismon_price',
    'tepetzintla_price', 'tlacolula_price', 'total_units', 'cerro_azul_units',
    'aquismon_units', 'tepetzintla_units', 'tlacolula_units',
  ],
  ventas: [
    'id', 'fecha', 'nombre', 'sucursal', 'products', 'formadepago', 'total_price',
    'preciopromocion', 'saldo_precio_promocion', 'status', 'agentedeventas',
  ],
  reporte: [
    'id', 'transaction_date', 'transaction_type', 'payment_type', 'name',
    'product', 'value', 'saldo', 'por_pagar', 'location',
  ],
};

export function buildPdfBase64(datasets: Dataset[], generatedAt: string): string {
  const lines: string[] = [];
  for (const ds of datasets) {
    const columns = PDF_COLUMNS[ds.key] || [];
    lines.push('');
    lines.push(`===== ${ds.sheetName} (${ds.rows.length} registros) =====`);
    for (const raw of ds.rows) {
      const row = sanitizeRow(raw);
      const parts = columns
        .filter(col => row[col] !== undefined && row[col] !== null && row[col] !== '')
        .map(col => `${col}: ${String(row[col]).slice(0, 120)}`);
      lines.push('- ' + parts.join(' | '));
    }
    if (ds.rows.length === 0) lines.push('(sin datos)');
  }
  return textToPdfBase64(`Respaldo Huastex — ${generatedAt}`, lines);
}
