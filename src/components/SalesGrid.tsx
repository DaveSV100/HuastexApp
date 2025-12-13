// src/components/SalesGrid.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Product {
  id?: number;
  title?: string;
  producto?: string;
  quantity: number;
  unit_price: number;
  serial_number?: string;
}

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
  products: Product[];
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
}

interface SalesGridProps {
  sales: Sale[];
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (saleId: number) => void;
}

export default function SalesGrid({
  sales,
  onEditSale,
  onDeleteSale,
}: SalesGridProps): React.JSX.Element {
  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadRole = async () => {
      const userRole = await AsyncStorage.getItem('role');
      setRole(userRole);
    };
    loadRole();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { timeZone: 'UTC' });
  };

  const formatProductTitles = (products: Product[]) => {
    if (!products) return '';
    return products
      .filter((product) => product !== null)
      .map((product) => product.title || product.producto || 'Sin nombre')
      .join(', ');
  };

  const formatPlazo = (plazo: any) => {
    if (!plazo || !plazo.value || !plazo.unit) return '';
    
    let rawPlazo = plazo;
    if (typeof rawPlazo.value === 'string' && rawPlazo.value.trim().startsWith('{')) {
      try {
        rawPlazo = JSON.parse(rawPlazo.value);
      } catch {
        // ignore parse error
      }
    }
    
    const value = rawPlazo.value != null ? String(rawPlazo.value) : '';
    const unit = ['days', 'weeks', 'months'].includes(rawPlazo.unit)
      ? rawPlazo.unit
      : 'weeks';
    
    const label = unit === 'days' ? 'días' : unit === 'weeks' ? 'semanas' : 'meses';
    return `${value} ${label}`;
  };

  const sortedSales = [...sales].sort((a, b) => b.id - a.id);

  if (sortedSales.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tienes ningún pedido</Text>
      </View>
    );
  }

  const canEditDelete = role === 'admin' || role === 'superadmin' || role === 'staff' || role === 'iT';

  return (
    <ScrollView>
      {sortedSales.map((sale) => {
        const discount = isNaN(Number(sale.discount)) ? 0 : Number(sale.discount);
        
        return (
          <View key={sale.id} style={styles.saleCard}>
            <View style={styles.saleHeader}>
              <Text style={styles.saleId}>ID: {sale.id}</Text>
              <Text style={styles.saleName}>{sale.nombre}</Text>
            </View>

            <View style={styles.saleDetails}>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Productos: </Text>
                {formatProductTitles(sale.products)}
              </Text>

              {sale.products &&
                sale.products.filter((p) => p).map((product, index) => (
                  <View key={product.id || `product-${index}`} style={styles.productDetail}>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Producto: </Text>
                      {product.title || product.producto || 'Sin nombre'}
                      {product.serial_number ? ` (#Serie: ${product.serial_number})` : ''}
                    </Text>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Cantidad: </Text>
                      {product.quantity}
                    </Text>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Precio Unitario: </Text>
                      ${product.unit_price}
                    </Text>
                  </View>
                ))}

              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Precio Normal: </Text>${sale.precionormal}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Precio Promoción: </Text>${sale.preciopromocion}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Enganche: </Text>${sale.enganche}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Saldo Precio Promoción: </Text>
                ${sale.saldo_precio_promocion}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Saldo Precio Normal: </Text>
                ${sale.saldo_precio_normal}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Fecha de Vencimiento: </Text>
                {formatDate(sale.fechavencimiento)}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Forma de Pago: </Text>
                {sale.formadepago}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Descuento: </Text>
                {discount}%
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Calle y Número: </Text>
                {sale.calleynumero}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Ciudad: </Text>
                {sale.ciudad}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Estado: </Text>
                {sale.estado}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Fecha de compra: </Text>
                {formatDate(sale.fecha)}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Plazo: </Text>
                {formatPlazo(sale.plazo)}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Sucursal: </Text>
                {sale.sucursal}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Agente de Ventas: </Text>
                {sale.agentedeventas}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Email: </Text>
                {sale.email}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Teléfono: </Text>
                {sale.phone}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Aclaraciones: </Text>
                {sale.aclaraciones}
              </Text>
            </View>

            {canEditDelete && (
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => onEditSale(sale)}
                >
                  <Text style={styles.buttonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => onDeleteSale(sale.id)}
                >
                  <Text style={styles.buttonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  saleCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saleHeader: {
    marginBottom: 12,
  },
  saleId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  saleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saleDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
  },
  productDetail: {
    marginLeft: 12,
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#007bff',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});