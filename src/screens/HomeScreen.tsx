// @ts-nocheck
import React, { useContext, useEffect, useState } from 'react';
import { 
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';
import CustomerSaleCard from '../components/CustomerSaleCard';

export default function HomeScreen(): React.JSX.Element {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user has staff/admin roles
  const hasStaffAccess = ['admin', 'superadmin', 'staff', 'iT'].includes(user?.role);

  // Fetch sales on mount. /sales/mine returns only this user's sales,
  // without signatures: downloading every sale (GET /sales) on each app start
  // was huge and slow, and customers aren't allowed to call it at all.
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await api.get('/sales/mine');
        setSales(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [user?.email]);

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Usuario: {user?.name}</Text>

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
            <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Dashboard')}>
              <Text style={styles.menuButtonText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Expenses')}>
              <Text style={styles.menuButtonText}>Gastos</Text>
            </TouchableOpacity>
          </>
        )}

        {['admin', 'superadmin', 'iT'].includes(user?.role) && (
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('ProductsUpload')}>
            <Text style={styles.menuButtonText}>Upload</Text>
          </TouchableOpacity>
        )}

        {user?.role === 'superadmin' && (
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Users')}>
            <Text style={styles.menuButtonText}>Usuarios</Text>
          </TouchableOpacity>
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
            data={[...sales].sort((a, b) => b.id - a.id)}
            renderItem={({ item }) => <CustomerSaleCard sale={item} />}
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