// src/contexts/DownloadContext.tsx
// Global backup-download state: the progress bar lives above the navigator
// (DownloadBanner) so switching screens never hides it; Perfil only starts
// the job. On completion the banner turns into "Descarga exitosa" and an
// alert notifies the user, then the file is offered via the share sheet.
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import Share from 'react-native-share';
import {
  BackupFormat,
  BackupScope,
  SCOPE_LABELS,
  buildExcelBase64,
  buildPdfBase64,
  fetchBackupData,
} from '../utils/backupExport';

export interface DownloadState {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: number; // 0..1
  label: string;
}

interface DownloadContextShape {
  download: DownloadState;
  startBackup: (scope: BackupScope, format: BackupFormat) => Promise<void>;
  dismiss: () => void;
}

const IDLE: DownloadState = { status: 'idle', progress: 0, label: '' };

export const DownloadContext = createContext<DownloadContextShape>({
  download: IDLE,
  startBackup: async () => {},
  dismiss: () => {},
});

export const useDownload = () => useContext(DownloadContext);

const MIMES: Record<BackupFormat, string> = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [download, setDownload] = useState<DownloadState>(IDLE);

  const startBackup = useCallback(async (scope: BackupScope, format: BackupFormat) => {
    setDownload({ status: 'running', progress: 0, label: 'Preparando…' });
    try {
      const datasets = await fetchBackupData(scope, (fraction, label) =>
        setDownload({ status: 'running', progress: fraction, label }),
      );

      setDownload({ status: 'running', progress: 0.85, label: 'Generando archivo…' });
      const today = new Date().toISOString().slice(0, 10);
      const base64 =
        format === 'excel' ? buildExcelBase64(datasets) : buildPdfBase64(datasets, today);

      setDownload({ status: 'running', progress: 0.95, label: 'Guardando…' });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const filename = `respaldo-${scope}-${today}.${ext}`;
      await Share.open({
        url: `data:${MIMES[format]};base64,${base64}`,
        filename,
        type: MIMES[format],
        failOnCancel: false,
      });

      setDownload({ status: 'done', progress: 1, label: 'Descarga exitosa' });
      Alert.alert('Descarga exitosa', `Respaldo de ${SCOPE_LABELS[scope]} listo (${filename}).`);
    } catch (err) {
      console.error('Backup download failed:', err);
      setDownload({ status: 'error', progress: 0, label: 'Error en la descarga' });
      Alert.alert('Error', 'No se pudo completar la descarga. Intenta de nuevo.');
    }
  }, []);

  const dismiss = useCallback(() => setDownload(IDLE), []);

  return (
    <DownloadContext.Provider value={{ download, startBackup, dismiss }}>
      {children}
    </DownloadContext.Provider>
  );
}
