// src/screens/FormsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api';
import FormulaModal from '../components/FormulaModal';

export default function FormsScreen(): JSX.Element {
  const navigation = useNavigation();
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const loadFormulas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/formulas');
      setFormulas(res.data || []);
    } catch (err) {
      console.error('Error fetching formulas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormulas();
  }, []);

  const openAdd = () => {
    setSelected(null);
    setModalVisible(true);
  };

  const openEdit = (f: any) => {
    setSelected({
      id: f.id,
      name: f.name,
      operators: f.operators,
      initialNumber: f.pc_example,
      finalNumber: f.final_price_example,
    });
    setModalVisible(true);
  };

  const handleSave = async (data: any) => {
    try {
      let response;
      if (data.id) {
        response = await api.put(`/formulas/${data.id}`, {
          name: data.name,
          operators: data.operators,
          pc_example: data.initialNumber,
          final_price_example: data.finalNumber,
        });
        setFormulas((list) => list.map((f) => (f.id === response.data.id ? response.data : f)));
      } else {
        response = await api.post('/formulas/add', {
          name: data.name,
          operators: data.operators,
          pc_example: data.initialNumber,
          final_price_example: data.finalNumber,
        });
        setFormulas((list) => [...list, response.data]);
      }
      setModalVisible(false);
      setSelected(null);
    } catch (err) {
      console.error('Error saving formula:', err);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Confirm', 'Are you sure you want to delete this formula?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/formulas/${id}`);
            setFormulas((f) => f.filter((x) => x.id !== id));
          } catch (err) {
            console.error('Error deleting formula', err);
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Inventory' as never)}>
          <Text style={styles.backBtnText}>Regresar a inventario</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>Agregar Fórmula +</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={formulas}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text>Operators: {item.operators}</Text>
              <Text>Example: {item.pc_example} → {item.final_price_example}</Text>
            </View>

            <View style={styles.itemActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.actionText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Text style={styles.actionText}>Borrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No formulas yet</Text>}
      />

      <FormulaModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleSave} initialData={selected} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#f3f6fb' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { backgroundColor: '#005bb5', padding: 10, borderRadius: 6 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  addBtn: { backgroundColor: '#1a6a1f', padding: 10, borderRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  item: { backgroundColor: '#fff', padding: 12, borderRadius: 6, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontWeight: '700', fontSize: 16, marginBottom: 6 },
  itemActions: { marginLeft: 8, justifyContent: 'center' },
  editBtn: { backgroundColor: '#3890e9', padding: 8, borderRadius: 6, marginBottom: 6 },
  deleteBtn: { backgroundColor: '#d9534f', padding: 8, borderRadius: 6 },
  actionText: { color: '#fff', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
