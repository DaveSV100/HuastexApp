// src/screens/Sales/SalesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import api from '../../api';
import SalesGrid from '../../components/SalesGrid';
import SaleModal from '../../components/SaleModal';

interface Sale {
  id: number;
  nombre: string;
  email: string;
  phone: string;
  calleynumero: string;
  ciudad: string;
  estado: string;
  fecha: string;
  formadepago: string;
  sucursal: string;
  products: any[];
  enganche: number;
  preciopromocion: number;
  precionormal: number;
  discount: number;
  saldo_precio_promocion: number;
  saldo_precio_normal: number;
  plazo: any;
  fechavencimiento: string;
  agentedeventas: string;
  aclaraciones: string;
  firmadigital?: string;
}

export default function SalesScreen(): React.JSX.Element {
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [editingSaleData, setEditingSaleData] = useState<Sale | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/sales');
      setSales(response.data);
    } catch (error) {
      console.error('Error fetching sales:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewSale = () => {
    setEditingSaleData(null);
    setIsSaleModalOpen(true);
  };

  const handleEditSale = (saleObj: Sale) => {
    setEditingSaleData(saleObj);
    setIsSaleModalOpen(true);
  };

  const handleCloseSaleModal = () => {
    setIsSaleModalOpen(false);
    setEditingSaleData(null);
  };

  const handleSaleSaved = () => {
    fetchSales();
    handleCloseSaleModal();
  };

  const handleDeleteSale = async (saleId: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Seguro que quieres eliminar esta venta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/sales/${saleId}`);
              fetchSales();
              Alert.alert('Éxito', 'Venta eliminada');
            } catch (err) {
              console.error('Error deleting sale:', err);
              Alert.alert('Error', 'No se pudo eliminar la venta');
            }
          },
        },
      ]
    );
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text.toLowerCase());
  };

  const filteredSales = sales.filter(
    (sale) =>
      sale.id.toString().includes(searchQuery) ||
      sale.nombre.toLowerCase().includes(searchQuery) ||
      sale.products.some(
        (product) =>
          product.title && product.title.toLowerCase().includes(searchQuery)
      )
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ventas</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por ID, Nombre o Producto"
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
      </View>

      <TouchableOpacity
        style={styles.newSaleButton}
        onPress={handleCreateNewSale}
      >
        <Text style={styles.newSaleButtonText}>Smart Venta</Text>
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <ScrollView style={styles.salesList}>
          <SalesGrid
            sales={filteredSales}
            onEditSale={handleEditSale}
            onDeleteSale={handleDeleteSale}
          />
        </ScrollView>
      )}

      {isSaleModalOpen && (
        <SaleModal
          visible={isSaleModalOpen}
          onClose={handleCloseSaleModal}
          onSaved={handleSaleSaved}
          initialData={editingSaleData}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  newSaleButton: {
    backgroundColor: '#007bff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  newSaleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  salesList: {
    flex: 1,
  },
  loader: {
    marginTop: 50,
  },
});