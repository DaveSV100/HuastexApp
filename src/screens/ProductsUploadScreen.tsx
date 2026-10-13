// src/screens/ProductsUploadScreen.tsx
// Store catalog management ("Upload" in the menu): list the shop's products
// and add/edit/delete them, including picking a photo from the gallery and
// uploading it as multipart form-data to POST/PUT /products (same contract as
// the web Products page). Server locks writes to admin/superadmin/iT.
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
  Image,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import api from '../api';
import { CATEGORIES } from '../utils/categories';

interface StoreProduct {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  image_url: string | null;
  category: string | null;
}

interface PickedImage {
  uri: string;
  type: string;
  fileName: string;
}

const API_BASE = 'https://api.huastex.com';

/** /uploads/... paths come back relative — prefix the API host for <Image>. */
const imageUri = (raw: string | null) => {
  if (!raw) return null;
  return raw.startsWith('http') ? raw : `${API_BASE}${raw}`;
};

const EMPTY_FORM = {
  id: undefined as number | undefined,
  title: '',
  description: '',
  price: '',
  category: '',
  imageUrl: '',
};

export default function ProductsUploadScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/all-products');
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setPickedImage(null);
    setShowModal(true);
  };

  const openEdit = (product: StoreProduct) => {
    setForm({
      id: product.id,
      title: product.title || '',
      description: product.description || '',
      price: product.price != null ? String(product.price) : '',
      category: product.category || '',
      imageUrl: product.image_url || '',
    });
    setPickedImage(null);
    setShowModal(true);
  };

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets && result.assets[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'No se pudo leer la imagen seleccionada');
        return;
      }
      setPickedImage({
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        fileName: asset.fileName || `photo-${Date.now()}.jpg`,
      });
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'No se pudo abrir la galería');
    }
  };

  const handleSave = async () => {
    const price = parseFloat(form.price);
    if (!form.title.trim() || !form.description.trim() || isNaN(price) || price < 0 || !form.category) {
      Alert.alert('Error', 'Completa título, descripción, precio y categoría');
      return;
    }
    setIsSaving(true);
    try {
      // Same multipart contract the web page sends: an `image` file when one
      // was picked, otherwise the existing `imageUrl` string.
      const data = new FormData();
      data.append('title', form.title.trim());
      data.append('description', form.description.trim());
      data.append('price', String(price));
      data.append('category', form.category);
      if (pickedImage) {
        data.append('image', {
          uri: pickedImage.uri,
          type: pickedImage.type,
          name: pickedImage.fileName,
        } as any);
      } else {
        data.append('imageUrl', form.imageUrl || '');
      }

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (form.id) {
        await api.put(`/products/${form.id}`, data, config);
      } else {
        await api.post('/products/add', data, config);
      }
      setShowModal(false);
      fetchProducts();
      Alert.alert('Éxito', form.id ? 'Producto actualizado' : 'Producto subido a la tienda');
    } catch (err: any) {
      console.error('Error saving product:', err.response?.data || err.message);
      Alert.alert('Error', 'No se pudo guardar el producto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (product: StoreProduct) => {
    Alert.alert('Eliminar producto', `¿Eliminar "${product.title}" de la tienda?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/products/${product.id}`);
            fetchProducts();
          } catch (err) {
            console.error('Error deleting product:', err);
            Alert.alert('Error', 'No se pudo eliminar el producto');
          }
        },
      },
    ]);
  };

  const modalPreview = pickedImage?.uri || imageUri(form.imageUrl);

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Subir productos a la tienda</Text>

        <TouchableOpacity style={styles.addButton} onPress={openNew}>
          <Text style={styles.addButtonText}>Agregar Producto</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
        ) : (
          products
            .slice()
            .sort((a, b) => b.id - a.id)
            .map(product => (
              <View key={product.id} style={styles.card}>
                <View style={styles.cardRow}>
                  {imageUri(product.image_url) ? (
                    <Image source={{ uri: imageUri(product.image_url)! }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Text style={styles.thumbEmptyText}>Sin foto</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{product.title}</Text>
                    <Text style={styles.cardMeta}>
                      ${product.price} · {product.category || 'Sin categoría'}
                    </Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {product.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editButton} onPress={() => openEdit(product)}>
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(product)}>
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
                {form.id ? 'Editar Producto' : 'Agregar Producto'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={v => setForm(prev => ({ ...prev, title: v }))}
              />

              <Text style={styles.label}>Descripción *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={v => setForm(prev => ({ ...prev, description: v }))}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Precio *</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={v => setForm(prev => ({ ...prev, price: v }))}
                keyboardType="numeric"
                placeholder="0.00"
              />

              <Text style={styles.label}>Categoría *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.category}
                  onValueChange={v => setForm(prev => ({ ...prev, category: v }))}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="-- Selecciona --" value="" color="#333" />
                  {CATEGORIES.map(cat => (
                    <Picker.Item key={cat.slug} label={cat.label} value={cat.label} color="#333" />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Imagen</Text>
              <TouchableOpacity style={styles.pickImageButton} onPress={handlePickImage}>
                <Text style={styles.pickImageButtonText}>
                  {pickedImage ? 'Cambiar imagen seleccionada' : 'Elegir imagen de la galería'}
                </Text>
              </TouchableOpacity>
              {modalPreview ? (
                <Image source={{ uri: modalPreview }} style={styles.preview} resizeMode="contain" />
              ) : null}

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
  cardRow: { flexDirection: 'row' },
  thumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#eef1f4' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { fontSize: 10, color: '#99a' },
  cardInfo: { flex: 1, marginLeft: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
  cardMeta: { fontSize: 12, color: '#667', marginVertical: 2 },
  cardDesc: { fontSize: 12, color: '#555' },
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
  textArea: { height: 90, textAlignVertical: 'top' },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  pickerItem: { color: '#333', fontSize: 16 },
  pickImageButton: {
    backgroundColor: '#e7f1ff',
    borderWidth: 1,
    borderColor: '#007bff',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickImageButtonText: { color: '#007bff', fontWeight: '600' },
  preview: {
    width: '100%',
    height: 180,
    marginTop: 10,
    borderRadius: 6,
    backgroundColor: '#f4f6f8',
  },
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
