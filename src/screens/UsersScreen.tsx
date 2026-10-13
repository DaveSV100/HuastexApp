// src/screens/UsersScreen.tsx
// User administration (superadmin only): list every account and create/edit/
// delete users with their role (type_of_user) and branch — the same
// /auth/users + /auth/register contract as the web Users page. The server
// enforces the superadmin lock; the Home menu only shows this to superadmin.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import api from '../api';

interface AppUser {
  id: number;
  name: string;
  email: string;
  type_of_user: string | null;
  branch: string | null;
}

const ROLES = ['normal', 'staff', 'admin', 'iT', 'superadmin'];

const BRANCHES = [
  { value: 'cerroazul', label: 'Cerro Azul' },
  { value: 'aquismon', label: 'Aquismón' },
  { value: 'tepetzintla', label: 'Tepetzintla' },
  { value: 'tlacolula', label: 'Tlacolula' },
];

const EMPTY_FORM = {
  id: undefined as number | undefined,
  name: '',
  email: '',
  password: '',
  type_of_user: 'normal',
  branch: 'cerroazul',
};

export default function UsersScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (user: AppUser) => {
    setForm({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      password: '',
      type_of_user: user.type_of_user || 'normal',
      branch: user.branch || 'cerroazul',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || (!form.id && !form.password)) {
      Alert.alert('Error', 'Completa nombre, email y contraseña');
      return;
    }
    setIsSaving(true);
    try {
      if (form.id) {
        await api.put(`/auth/users/${form.id}`, form);
      } else {
        await api.post('/auth/register', form);
      }
      setShowModal(false);
      fetchUsers();
      Alert.alert('Éxito', form.id ? 'Usuario actualizado' : 'Usuario creado');
    } catch (err: any) {
      console.error('Error saving user:', err.response?.data || err.message);
      Alert.alert('Error', 'No se pudo guardar el usuario');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (user: AppUser) => {
    Alert.alert('Eliminar usuario', `¿Eliminar la cuenta de ${user.name} (${user.email})?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/users/${user.id}`);
            fetchUsers();
          } catch (err) {
            console.error('Error deleting user:', err);
            Alert.alert('Error', 'No se pudo eliminar el usuario');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Usuarios</Text>

        <TouchableOpacity style={styles.addButton} onPress={openNew}>
          <Text style={styles.addButtonText}>Agregar Usuario</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
        ) : (
          users
            .slice()
            .sort((a, b) => a.id - b.id)
            .map(user => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.name}</Text>
                <Text style={styles.cardMeta}>{user.email}</Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.badge}>{user.type_of_user || 'normal'}</Text>
                  {user.branch ? <Text style={styles.badge}>{user.branch}</Text> : null}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editButton} onPress={() => openEdit(user)}>
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(user)}>
                    <Text style={styles.actionText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {form.id ? 'Editar Usuario' : 'Agregar Usuario'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm(prev => ({ ...prev, name: v }))}
              />

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={v => setForm(prev => ({ ...prev, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>{form.id ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</Text>
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={v => setForm(prev => ({ ...prev, password: v }))}
                secureTextEntry
              />

              <Text style={styles.label}>Tipo de usuario *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.type_of_user}
                  onValueChange={v => setForm(prev => ({ ...prev, type_of_user: v }))}
                  itemStyle={styles.pickerItem}
                >
                  {ROLES.map(role => (
                    <Picker.Item key={role} label={role} value={role} color="#333" />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Sucursal *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.branch}
                  onValueChange={v => setForm(prev => ({ ...prev, branch: v }))}
                  itemStyle={styles.pickerItem}
                >
                  {BRANCHES.map(branch => (
                    <Picker.Item key={branch.value} label={branch.label} value={branch.value} color="#333" />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f6fb' },
  content: { padding: 16, paddingBottom: 40 },
  backText: { fontSize: 16, color: '#007bff', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  addButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  loader: { marginTop: 30 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  cardMeta: { fontSize: 13, color: '#667', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: {
    backgroundColor: '#eef1f4',
    color: '#333',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '92%',
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { color: '#dc3545', fontSize: 16, fontWeight: '600' },
  form: { padding: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  pickerItem: { color: '#333', fontSize: 16 },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  saveButtonDisabled: { backgroundColor: '#6c757d' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
