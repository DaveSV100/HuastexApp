import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api';
import {
  registerPasskey,
  isPasskeySupported,
  isPasskeyCancelledError,
} from '../../utils/passkey';

interface PasskeyRow {
  credential_id: string;
  device_name: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

export default function UserScreen(): React.JSX.Element {
  // AuthContext is an untyped JS context; cast to what the provider supplies.
  const { user } = useContext(AuthContext) as { user?: { email?: string } };
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/passkey/credentials');
      setPasskeys(data);
    } catch (err) {
      console.error('Error loading passkeys:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddPasskey = async () => {
    setMessage('');
    setBusy(true);
    try {
      await registerPasskey();
      setMessage('✅ Passkey creada. Ya puedes iniciar sesión sin contraseña.');
      await refresh();
    } catch (err) {
      if (isPasskeyCancelledError(err)) {
        setMessage('Creación de passkey cancelada.');
      } else {
        setMessage('No se pudo crear la passkey. Intenta de nuevo.');
        console.error('Error creating passkey:', err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (credentialId: string) => {
    Alert.alert('Eliminar passkey', '¿Ya no podrás iniciar sesión con ella. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/passkey/credentials/${encodeURIComponent(credentialId)}`);
            await refresh();
          } catch (err) {
            console.error('Error deleting passkey:', err);
            setMessage('No se pudo eliminar la passkey.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi cuenta</Text>
      {user?.email ? <Text style={styles.subtitle}>{user.email}</Text> : null}

      <Text style={styles.sectionTitle}>Passkeys</Text>
      <Text style={styles.help}>
        Inicia sesión con Face ID, huella o el bloqueo del teléfono — sin contraseña.
      </Text>

      {isPasskeySupported() ? (
        <TouchableOpacity style={styles.addButton} onPress={handleAddPasskey} disabled={busy}>
          <Text style={styles.addButtonText}>🔑 Agregar passkey en este dispositivo</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.help}>Este dispositivo no soporta passkeys.</Text>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <FlatList
        style={styles.list}
        data={passkeys}
        keyExtractor={item => item.credential_id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.device_name || 'Passkey sin nombre'}</Text>
              <Text style={styles.rowMeta}>
                Creada: {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.credential_id)}>
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: '600', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 20 },
  help: { fontSize: 13, color: '#666', marginVertical: 6 },
  addButton: {
    backgroundColor: 'rgb(76,110,90)',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 15 },
  message: { marginTop: 10, fontSize: 14 },
  list: { marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    paddingVertical: 12,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15 },
  rowMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  deleteText: { color: '#c0392b', fontSize: 14, paddingHorizontal: 8 },
});
