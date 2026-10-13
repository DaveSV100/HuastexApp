// @ts-nocheck
import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  Image,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../contexts/AuthContext';
import { useDownload } from '../contexts/DownloadContext';
import { SCOPE_LABELS } from '../utils/backupExport';
import api from '../api';

const SCOPES = ['todo', 'inventario', 'ventas', 'reporte'];

export default function PerfilScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { signOut, user } = useContext(AuthContext);
  const { download, startBackup } = useDownload();

  // Backup menu: first pick what to download, then the format.
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupScope, setBackupScope] = useState(null);

  const canBackup = ['staff', 'iT', 'admin', 'superadmin'].includes(user?.role);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Borrar cuenta',
      '¿Seguro deseas borrar tu cuenta?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/auth/delete-my-account');
              signOut();
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'No se pudo borrar la cuenta. Intenta de nuevo.');
            }
          },
        },
      ]
    );
  };

  const handlePickFormat = (format) => {
    setShowBackupModal(false);
    const scope = backupScope;
    setBackupScope(null);
    startBackup(scope, format);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Image source={require('../../Assets/back.png')} style={styles.back} />
      </TouchableOpacity>

      <Text style={styles.title}>Perfil</Text>

      {/* Who is signed in */}
      <View style={styles.userCard}>
        <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {canBackup && (
        <TouchableOpacity
          style={[styles.downloadButton, download.status === 'running' && styles.downloadButtonBusy]}
          onPress={() => {
            if (download.status === 'running') {
              Alert.alert('Descarga en curso', 'Espera a que termine la descarga actual.');
              return;
            }
            setBackupScope(null);
            setShowBackupModal(true);
          }}
        >
          <Text style={styles.downloadButtonText}>
            {download.status === 'running' ? 'Descargando…' : 'Descargar'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.accountButtons}>
        <Button title="Cerrar Sesión" onPress={signOut} />
        <Button title="Borrar Cuenta" color="red" onPress={handleDeleteAccount} />
      </View>

      {/* Step 1: what to back up. Step 2: Excel or PDF. */}
      <Modal visible={showBackupModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {backupScope
                  ? `Descargar ${SCOPE_LABELS[backupScope]}`
                  : '¿Qué deseas descargar?'}
              </Text>
              <TouchableOpacity onPress={() => setShowBackupModal(false)}>
                <Text style={styles.closeButton}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            {!backupScope ? (
              SCOPES.map(scope => (
                <TouchableOpacity
                  key={scope}
                  style={styles.optionButton}
                  onPress={() => setBackupScope(scope)}
                >
                  <Text style={styles.optionText}>Descargar {SCOPE_LABELS[scope]}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.optionButton, styles.formatExcel]}
                  onPress={() => handlePickFormat('excel')}
                >
                  <Text style={styles.formatText}>Descargar Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, styles.formatPdf]}
                  onPress={() => handlePickFormat('pdf')}
                >
                  <Text style={styles.formatText}>Descargar PDF</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  back: {
    width: 32,
    height: 32,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  userName: { fontSize: 18, fontWeight: '700', color: '#222' },
  userEmail: { fontSize: 14, color: '#667', marginTop: 4 },
  downloadButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadButtonBusy: { backgroundColor: '#6c757d' },
  downloadButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  accountButtons: {
    width: '100%',
    gap: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '88%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', flex: 1 },
  closeButton: { color: '#dc3545', fontSize: 15, fontWeight: '600' },
  optionButton: {
    backgroundColor: '#f4f6f8',
    borderWidth: 1,
    borderColor: '#dfe5ec',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  optionText: { fontSize: 15, fontWeight: '600', color: '#333' },
  formatExcel: { backgroundColor: '#e8f5ec', borderColor: '#28a745' },
  formatPdf: { backgroundColor: '#fdecea', borderColor: '#dc3545' },
  formatText: { fontSize: 15, fontWeight: '700', color: '#333' },
});
