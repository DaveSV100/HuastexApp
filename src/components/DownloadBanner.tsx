// src/components/DownloadBanner.tsx
// Floating progress card pinned to the bottom of the app while a backup
// download runs. Mounted in App.tsx (outside the navigator) on purpose:
// navigating between screens never unmounts it, so the bar stays visible
// until the download finishes ("Descarga exitosa") or fails.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useDownload } from '../contexts/DownloadContext';

export default function DownloadBanner(): React.JSX.Element | null {
  const { download, dismiss } = useDownload();

  // Auto-hide the success/error card after a few seconds.
  useEffect(() => {
    if (download.status === 'done' || download.status === 'error') {
      const t = setTimeout(dismiss, 6000);
      return () => clearTimeout(t);
    }
  }, [download.status, dismiss]);

  if (download.status === 'idle') return null;

  const pct = Math.round(download.progress * 100);
  const barWidth = { width: `${Math.max(pct, 2)}%` as const };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View
        style={[
          styles.card,
          download.status === 'done' && styles.cardDone,
          download.status === 'error' && styles.cardError,
        ]}
      >
        <View style={styles.row}>
          <Text style={styles.label}>
            {download.status === 'running' ? `${download.label} ${pct}%` : download.label}
          </Text>
          {download.status !== 'running' && (
            <TouchableOpacity onPress={dismiss}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              barWidth,
              download.status === 'done' && styles.fillDone,
              download.status === 'error' && styles.fillError,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  card: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfd8e3',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardDone: { borderColor: '#28a745' },
  cardError: { borderColor: '#dc3545' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1 },
  close: { fontSize: 16, color: '#888', paddingHorizontal: 6 },
  track: {
    height: 8,
    backgroundColor: '#eef1f4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: '#007bff',
    borderRadius: 4,
  },
  fillDone: { backgroundColor: '#28a745' },
  fillError: { backgroundColor: '#dc3545' },
});
