// src/screens/InventoryScreen.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import InventoryModal from '../components/InventoryModal';

const BackImg = require('../../Assets/back.png'); // adjust path if needed

type Product = { id: number; product: string; [key: string]: any };
type Formula = { id: number; name: string; operators?: string };

export default function InventoryScreen(): JSX.Element {
  const navigation = useNavigation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBranch, setUserBranch] = useState<string | null>(null);

  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);

  // load role/branch from AsyncStorage (web used localStorage)
  useEffect(() => {
    (async () => {
      const role = await AsyncStorage.getItem('role');
      const branch = await AsyncStorage.getItem('branch');
      setUserRole(role);
      setUserBranch(branch);
    })();
  }, []);

  // fetch formulas
useFocusEffect(
  useCallback(() => {
    const fetchFormulas = async () => {
      try {
        const response = await api.get('/formulas');
        setFormulas(response.data || []);
      } catch (err) {
        console.error('Error fetching formulas:', err);
      }
    };
    fetchFormulas();
  }, [])
);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      const sorted = Array.isArray(res.data) ? res.data.sort((a: any, b: any) => b.id - a.id) : [];
      setProducts(sorted);
    } catch (err) {
      console.error('Error fetching inventory products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleOpenProductModal = (product: Product | null = null) => {
    setCurrentProduct(product);
    setShowProductModal(true);
  };

  const handleCloseProductModal = () => {
    setCurrentProduct(null);
    setShowProductModal(false);
  };

  const handleSaveProduct = async (productData: any, cb?: () => void) => {
    try {
      if (productData.id) {
        await api.put(`/inventory/${productData.id}`, productData);
      } else {
        await api.post('/inventory/add', productData);
      }
      await loadProducts();
      handleCloseProductModal();
      if (cb) cb();
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleDeleteProduct = (id: number) => {
    Alert.alert('Confirm', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/inventory/${id}`);
            await loadProducts();
          } catch (err) {
            console.error('Error deleting:', err);
          }
        },
      },
    ]);
  };

  // Normalize strings: remove accents and lowercase
  const normalizeString = (str: string) =>
    (str || '')
      .normalize?.('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredProducts = useMemo(() => {
    const normSearch = normalizeString(searchTerm || '');
    const keywords = normSearch.split(' ').filter(Boolean);
    if (!keywords.length) return products;
    return products.filter((p) => {
      const normalizedProduct = normalizeString(p.product || '');
      return keywords.every((k) => normalizedProduct.includes(k));
    });
  }, [products, searchTerm]);

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.productItem}>
      <Text style={styles.productTitle}>{item.product}</Text>

      {userRole === 'admin' || userRole === 'superadmin' ? (
        <Text style={styles.productRow}>
          <Text style={styles.bold}>Precio de costo: </Text>{item.price_cost ?? ''}
        </Text>
      ) : null}

      <Text style={styles.productRow}><Text style={styles.bold}>Categoría: </Text>{item.category}</Text>
      <Text style={styles.productRow}><Text style={styles.bold}>Modelo: </Text>{item.model}</Text>

      {/* branch/role-specific prices (same logic as web) */}
      {userRole === 'admin' || userRole === 'superadmin' ? (
        <>
          <Text style={styles.productRow}><Text style={styles.bold}>Cerro Azul precio contado: </Text>{item.cerro_azul_price}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Cerro Azul precio MSI: </Text>{item.cerro_azul_msiprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Cerro Azul precio crédito: </Text>{item.cerro_azul_creditprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Aquismon precio contado: </Text>{item.aquismon_price}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Aquismon precio MSI: </Text>{item.aquismon_msiprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Aquismon precio crédito: </Text>{item.aquismon_creditprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Tepetzintla precio contado: </Text>{item.tepetzintla_price}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Tepetzintla precio MSI: </Text>{item.tepetzintla_msiprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Tepetzintla precio crédito: </Text>{item.tepetzintla_creditprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Tlacolula precio contado: </Text>{item.tlacolula_price}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Tlacolula precio MSI: </Text>{item.tlacolula_msiprice}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Tlacolula precio crédito: </Text>{item.tlacolula_creditprice}</Text>

          {/* ... other fields */}
        </>
      ) : userBranch === 'cerroazul' ? (
        <>
          <Text style={styles.productRow}><Text style={styles.bold}>Cerro Azul Precio Contado: </Text>{item.cerro_azul_price}</Text>
        </>
      ) : userBranch === 'aquismon' ? (
        <Text style={styles.productRow}><Text style={styles.bold}>Aquismon Precio Contado: </Text>{item.aquismon_price}</Text>
      ) : userBranch === 'tepetzintla' ? (
        <Text style={styles.productRow}><Text style={styles.bold}>Tepetzintla Precio Contado: </Text>{item.tepetzintla_price}</Text>
      ) : userBranch === 'tlacolula' ? (
        <Text style={styles.productRow}><Text style={styles.bold}>Tlacolula Precio: </Text>{item.tlacolula_price}</Text>
      ) : null}

      <Text style={styles.productRow}><Text style={styles.bold}>Número de serie: </Text>{item.serial_number}</Text>

      {userRole === 'admin' || userRole === 'superadmin' ? (
        <Text style={styles.productRow}><Text style={styles.bold}>Fecha de llegada a matriz: </Text>{item.headquarters_arrival_date}</Text>
      ) : null}

      <Text style={styles.productRow}><Text style={styles.bold}>Cantidad original: </Text>{item.original_quantity}</Text>
      <Text style={styles.productRow}><Text style={styles.bold}>Cantidad actual: </Text>{item.all_branches_quantity}</Text>
      <Text style={styles.productRow}><Text style={styles.bold}>Identificador: </Text>{item.internal_number}</Text>
      <Text style={styles.productRow}><Text style={styles.bold}>Descripción: </Text>{item.description}</Text>
      {userRole === 'admin' || userRole === 'superadmin' ? (
        <>
          <Text style={styles.productRow}><Text style={styles.bold}>Proveedor: </Text>{item.supplier}</Text>
          <Text style={styles.productRow}><Text style={styles.bold}>Factura proveedor: </Text>{item.supplier_bill}</Text>
        </>
      ) : null}

      <Text style={styles.productRow}><Text style={styles.bold}>Factura cliente: </Text>{item.final_customer_bill}</Text>
      <Text style={styles.productRow}><Text style={styles.bold}>Comentarios: </Text>{item.comments}</Text>

      {userRole === 'admin' || userRole === 'superadmin' ? (
        <View style={styles.itemActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenProductModal(item)}>
            <Text style={styles.actionText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDeleteProduct(item.id)}>
            <Text style={styles.actionText}>Borrar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
      <TouchableOpacity onPress={() => navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })
      )}>
        <Image source={BackImg} style={styles.backIcon} />
      </TouchableOpacity>
        {userRole === 'superadmin' && (
          <TouchableOpacity style={styles.formsBtn} onPress={() => navigation.navigate?.('Forms' as never)}>
            <Text style={styles.btnText}>FÓRMULAS</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>Inventario de productos</Text>

      {(userRole === 'admin' || userRole === 'superadmin') && (
        <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenProductModal()}>
          <Text style={styles.btnText}>Agregar producto</Text>
        </TouchableOpacity>
      )}

      <TextInput
        placeholder="Buscar producto por nombre..."
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.searchInput}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No products</Text>}
        />
      )}

      <TouchableOpacity style={styles.backToTop} onPress={() => { /* optional: scroll to top logic */ }}>
        <Text>Back to Top</Text>
      </TouchableOpacity>

      <InventoryModal
        visible={showProductModal}
        onClose={handleCloseProductModal}
        onSave={handleSaveProduct}
        initialData={currentProduct}
        formulas={formulas}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#f3f6fb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backIcon: { width: 40, height: 40, resizeMode: 'contain' },
  formsBtn: { backgroundColor: '#1a6a1f', padding: 10, borderRadius: 6 },
  addBtn: { backgroundColor: '#3890e9', padding: 10, marginVertical: 8, borderRadius: 6, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', marginVertical: 8, textAlign: 'center' },
  searchInput: { backgroundColor: '#fff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  listContainer: { paddingVertical: 12, paddingBottom: 120 },
  productItem: { backgroundColor: '#fff', padding: 12, borderRadius: 6, marginVertical: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  productTitle: { fontSize: 16, fontWeight: '700' },
  productRow: { marginTop: 6 },
  bold: { fontWeight: '700' },
  itemActions: { flexDirection: 'row', marginTop: 10, justifyContent: 'flex-end' },
  actionBtn: { padding: 8, backgroundColor: '#0070f3', borderRadius: 4, marginLeft: 8 },
  deleteBtn: { backgroundColor: '#d9534f' },
  actionText: { color: 'white' },
  backToTop: { position: 'absolute', right: 16, bottom: 20, padding: 10, backgroundColor: '#eee', borderRadius: 20 },
});
