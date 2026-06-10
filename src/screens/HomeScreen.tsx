// @ts-nocheck
import React, { useContext, useEffect, useState } from 'react';
import { 
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity, 
  Linking,
  ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

export default function HomeScreen(): React.JSX.Element {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user has staff/admin roles
  const hasStaffAccess = ['admin', 'superadmin', 'staff', 'iT'].includes(user?.role);

  // Fetch sales on mount
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await api.get('/sales');
        // Filter sales by user's email
        const userSales = response.data.filter(sale => sale.email === user?.email);
        setSales(userSales);
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [user?.email]);

  const openWebsite = () => {
    Linking.openURL('https://huastex.com');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { timeZone: 'UTC' });
  };

  const formatProductTitles = (products) => {
    if (!products) return '';
    return products
      .filter(product => product !== null)
      .map(product => product.title || product.producto || 'Sin nombre')
      .join(', ');
  };

  const renderSaleItem = ({ item }) => (
    <View style={styles.saleCard}>
      <Text style={styles.saleId}>Pedido #{item.id}</Text>
      <Text style={styles.saleDetail}>
        <Text style={styles.label}>Productos: </Text>
        {formatProductTitles(item.products)}
      </Text>
      <Text style={styles.saleDetail}>
        <Text style={styles.label}>Fecha: </Text>
        {formatDate(item.fecha)}
      </Text>
      <Text style={styles.saleDetail}>
        <Text style={styles.label}>Total: </Text>
        ${item.total_price}
      </Text>
      <Text style={styles.saleDetail}>
        <Text style={styles.label}>Estado: </Text>
        {item.formadepago}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Bienvenido, {user?.name}</Text>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.shopButton} onPress={() => navigation.navigate('Shop')}>
          <Text style={styles.shopButtonText}>Ir a la tienda</Text>
        </TouchableOpacity>

        {hasStaffAccess && (
          <>
            <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Inventory')}>
              <Text style={styles.menuButtonText}>Inventario</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Sales')}>
              <Text style={styles.menuButtonText}>Ventas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Dailyreport')}>
              <Text style={styles.menuButtonText}>Reporte Diario</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Perfil')}>
          <Text style={styles.menuButtonText}>Perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Sales Section */}
      <View style={styles.salesSection}>
        <Text style={styles.sectionTitle}>Mis Pedidos</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="rgb(122,149,172)" />
        ) : sales.length > 0 ? (
          <FlatList
            data={sales.sort((a, b) => b.id - a.id)}
            renderItem={renderSaleItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.salesList}
          />
        ) : (
          <View style={styles.noSalesContainer}>
            <Text style={styles.noSalesText}>
              Aún no tienes ningún pedido.{'\n'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  shopButton: {
    backgroundColor: '#1486AC',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  menuButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  salesSection: {
    flex: 1,
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  salesList: {
    flex: 1,
  },
  saleCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: 'rgb(122,149,172)',
  },
  saleId: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: 'rgb(122,149,172)',
  },
  saleDetail: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  label: {
    fontWeight: 'bold',
  },
  noSalesContainer: {
    flex: 1,
    justifyContent: 'bottom',
    alignItems: 'center',
    padding: 20,
  },
  noSalesText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
  link: {
    color: 'rgb(122,149,172)',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});