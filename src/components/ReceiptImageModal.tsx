// src/components/ReceiptImageModal.tsx
// Abono receipt as an image: preview + "Guardar en galería" + "Enviar por
// WhatsApp". Same flow as the per-abono buttons on PaymentsScreen, usable
// right after registering the abono (no need to open "Ver Pagos").
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { saveImageToGallery } from '../utils/gallery';
import ReceiptTicket from './ReceiptTicket';
import { normalizePhoneMx, shareImageToWhatsApp } from '../utils/whatsapp';

interface ReceiptImageModalProps {
  sale: any;
  payment: any;
  onClose: () => void;
}

export default function ReceiptImageModal({
  sale,
  payment,
  onClose,
}: ReceiptImageModalProps): React.JSX.Element {
  const receiptRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const phone = normalizePhoneMx(sale?.phone);

  const handleSave = async () => {
    if (!receiptRef.current) return;
    setIsSaving(true);
    try {
      // Android 9 and below still need the legacy storage permission;
      // Android 10+ saves through MediaStore without asking.
      if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permiso denegado', 'No se puede guardar la imagen sin permiso de almacenamiento.');
          return;
        }
      }
      const uri = await receiptRef.current.capture();
      await saveImageToGallery(uri);
      Alert.alert('Éxito', 'El abono se guardó como imagen en tu galería.');
    } catch (err) {
      console.error('Error saving payment image:', err);
      Alert.alert('Error', 'No se pudo guardar la imagen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!receiptRef.current) return;
    setIsSending(true);
    try {
      const uri = await receiptRef.current.capture();
      await shareImageToWhatsApp(phone, uri);
    } catch (err) {
      console.error('Error sharing payment image:', err);
      Alert.alert('Error', 'No se pudo compartir la imagen.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Abono #{payment?.id}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.preview}>
          {/* Everything inside ViewShot is what gets saved / sent. */}
          <ViewShot ref={receiptRef} options={{ format: 'png', quality: 1 }}>
            <ReceiptTicket sale={sale} payment={payment} />
          </ViewShot>
        </ScrollView>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Guardar en galería</Text>
          )}
        </TouchableOpacity>

        {Boolean(phone) && (
          <TouchableOpacity
            style={[styles.button, styles.whatsappButton, isSending && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Enviar por WhatsApp</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    // iOS: clear the notch. Android: modals start below the status bar.
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
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
  preview: {
    padding: 16,
    alignItems: 'center',
  },
  button: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007bff',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
