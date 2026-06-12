// src/components/PrintTicketModal.tsx
// Preview + Bluetooth print flow for thermal tickets. Shows the ticket
// exactly as it will print, lets the user pick (and remember) a BLE printer,
// then captures the ticket and streams it as ESC/POS raster data.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import ReceiptTicket from './ReceiptTicket';
import DocumentTicket from './DocumentTicket';
import { pngBase64ToEscPos } from '../utils/escposImage';
import { buildTicketPdfBase64 } from '../utils/ticketPdf';
import {
  ensureBlePermissions,
  waitForBluetoothOn,
  scanForPrinters,
  getSavedPrinter,
  savePrinter,
  forgetPrinter,
  printEscPos,
  FoundPrinter,
} from '../utils/thermalPrinter';

interface PrintTicketModalProps {
  sale: any;
  payment?: any | null;
  onClose: () => void;
  /** Open the share sheet with the ticket PDF as soon as the preview mounts. */
  autoPdf?: boolean;
}

export default function PrintTicketModal({
  sale,
  payment,
  onClose,
  autoPdf,
}: PrintTicketModalProps) {
  const ticketRef = useRef<any>(null);
  // Points at the signature box inside ReceiptTicket so the PDF can embed
  // just the firma as an image (the rest of the document is real text).
  const signatureRef = useRef<View>(null);
  const [printer, setPrinter] = useState<FoundPrinter | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [devices, setDevices] = useState<FoundPrinter[]>([]);
  const stopScanRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getSavedPrinter().then(setPrinter);
    return () => {
      stopScanRef.current?.();
    };
  }, []);

  // The PDF is a text document built from the sale data; the only capture
  // is the signature box (when the customer signed), and that must happen
  // while the preview is visible — iOS snapshots of offscreen views come
  // back blank.
  const handleSharePdf = async () => {
    if (isSharingPdf) return;
    setIsSharingPdf(true);
    try {
      let signatureJpegBase64: string | null = null;
      if (sale?.firmadigital && signatureRef.current) {
        try {
          signatureJpegBase64 = await captureRef(signatureRef, {
            format: 'jpg',
            quality: 0.9,
            result: 'base64',
          });
        } catch (err) {
          // Share the document without the firma rather than failing.
          console.warn('No se pudo capturar la firma para el PDF:', err);
        }
      }
      const pdfB64 = buildTicketPdfBase64({ sale, payment, signatureJpegBase64 });
      await Share.open({
        url: `data:application/pdf;base64,${pdfB64}`,
        filename: payment
          ? `abono-${payment.id ?? sale?.id}`
          : `venta-${sale?.id}`,
        type: 'application/pdf',
        failOnCancel: false,
        // Android writes the decoded file to getExternalCacheDir() by
        // default, which is null on some devices/emulators and crashes the
        // share. Internal cache always exists.
        useInternalStorage: true,
      });
    } catch (err: any) {
      console.error('Error generating ticket PDF:', err);
      Alert.alert(
        'Error',
        `No se pudo generar el PDF. ${err?.message || ''}`.trim(),
      );
    } finally {
      setIsSharingPdf(false);
    }
  };

  // "Descargar PDF" entry point: give the preview (and the signature image)
  // a moment to render, then pop the share sheet automatically.
  useEffect(() => {
    if (!autoPdf) return;
    const timer = setTimeout(handleSharePdf, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf]);

  const startScan = async () => {
    try {
      await ensureBlePermissions();
      await waitForBluetoothOn();
    } catch (err: any) {
      Alert.alert('Bluetooth', err.message || 'No se pudo usar Bluetooth.');
      return;
    }
    setDevices([]);
    setPicking(true);
    setScanning(true);
    stopScanRef.current?.();
    stopScanRef.current = scanForPrinters(setDevices, 8);
    setTimeout(() => setScanning(false), 8000);
  };

  const choosePrinter = async (p: FoundPrinter) => {
    stopScanRef.current?.();
    setScanning(false);
    setPicking(false);
    setPrinter(p);
    await savePrinter(p);
    printTo(p);
  };

  const handlePrintPress = async () => {
    try {
      await ensureBlePermissions();
      await waitForBluetoothOn();
    } catch (err: any) {
      Alert.alert('Bluetooth', err.message || 'No se pudo usar Bluetooth.');
      return;
    }
    if (printer) {
      printTo(printer);
    } else {
      startScan();
    }
  };

  const printTo = async (target: FoundPrinter) => {
    if (!ticketRef.current) return;
    setIsPrinting(true);
    try {
      const base64 = await ticketRef.current.capture();
      const escpos = pngBase64ToEscPos(base64);
      await printEscPos(target.id, escpos);
      setIsPrinting(false);
      Alert.alert('Éxito', 'Recibo enviado a la impresora.');
    } catch (err: any) {
      console.error('Print error:', err);
      setIsPrinting(false);
      Alert.alert(
        'Error de impresión',
        `No se pudo imprimir en "${target.name}". Revisa que la impresora esté encendida y cerca.`,
        [
          { text: 'Reintentar', onPress: () => printTo(target) },
          {
            text: 'Elegir otra impresora',
            onPress: async () => {
              await forgetPrinter();
              setPrinter(null);
              startScan();
            },
          },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {autoPdf
              ? payment
                ? 'Documento de abono'
                : `Documento de venta #${sale?.id}`
              : payment
              ? 'Recibo de abono'
              : `Recibo de venta #${sale?.id}`}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        {/* The PDF flow previews the bill-style document (what the PDF looks
            like); the print flow previews the 58mm thermal ticket. */}
        {autoPdf ? (
          <ScrollView contentContainerStyle={styles.documentArea}>
            <View style={styles.documentShadow}>
              <DocumentTicket
                sale={sale}
                payment={payment}
                signatureRef={signatureRef}
              />
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.previewArea}>
            <View style={styles.ticketShadow}>
              <ViewShot
                ref={ticketRef}
                options={{ format: 'png', quality: 1, result: 'base64' }}
              >
                <ReceiptTicket
                  sale={sale}
                  payment={payment}
                  signatureRef={signatureRef}
                />
              </ViewShot>
            </View>
          </ScrollView>
        )}

        {picking ? (
          <View style={styles.pickerPanel}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {scanning ? 'Buscando impresoras…' : 'Impresoras encontradas'}
              </Text>
              {scanning && <ActivityIndicator color="#007bff" />}
            </View>
            <FlatList
              data={devices}
              keyExtractor={d => d.id}
              style={styles.deviceList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceRow}
                  onPress={() => choosePrinter(item)}
                >
                  <Text style={styles.deviceName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                !scanning ? (
                  <Text style={styles.emptyDevices}>
                    No se encontraron dispositivos. Enciende la impresora y
                    vuelve a buscar.
                  </Text>
                ) : null
              }
            />
            <View style={styles.pickerButtonsRow}>
              <TouchableOpacity style={styles.rescanButton} onPress={startScan}>
                <Text style={styles.footerButtonText}>Buscar de nuevo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelPickButton}
                onPress={() => {
                  stopScanRef.current?.();
                  setPicking(false);
                  setScanning(false);
                }}
              >
                <Text style={styles.footerButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.footer}>
            {/* Printer controls only make sense in the print flow. */}
            {!autoPdf && printer && (
              <TouchableOpacity onPress={startScan} disabled={isPrinting}>
                <Text style={styles.printerName}>
                  Impresora: {printer.name} (cambiar)
                </Text>
              </TouchableOpacity>
            )}
            {!autoPdf && (
              <TouchableOpacity
                style={[styles.printButton, isPrinting && styles.printButtonDisabled]}
                onPress={handlePrintPress}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.printButtonText}>
                    {printer ? 'Imprimir' : 'Buscar impresora e imprimir'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.pdfShareButton, isSharingPdf && styles.printButtonDisabled]}
              onPress={handleSharePdf}
              disabled={isSharingPdf}
            >
              {isSharingPdf ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.printButtonText}>
                  {autoPdf ? 'Compartir / Guardar PDF' : 'Compartir PDF'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  previewArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  ticketShadow: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  documentArea: {
    padding: 12,
  },
  documentShadow: {
    backgroundColor: '#fff',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  printerName: {
    textAlign: 'center',
    color: '#007bff',
    marginBottom: 10,
    fontSize: 14,
  },
  printButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  printButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  pdfShareButton: {
    backgroundColor: '#17a2b8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    padding: 16,
    maxHeight: 320,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceList: {
    maxHeight: 180,
  },
  deviceRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceName: {
    fontSize: 16,
    color: '#333',
  },
  emptyDevices: {
    textAlign: 'center',
    color: '#666',
    padding: 16,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rescanButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelPickButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  footerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
