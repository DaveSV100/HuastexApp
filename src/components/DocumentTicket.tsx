// src/components/DocumentTicket.tsx
// On-screen "bill" preview matching the shareable PDF's layout
// (src/utils/ticketPdf.ts): header band with the brand on the left and
// folio/fecha on the right, a two-column info grid, a full-width product
// table and right-aligned totals. Shown by the Descargar PDF flow so the
// preview reads like a document instead of a thermal ticket.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { formatTime12h, deriveTicketModel } from '../utils/ticketFormat';

interface DocumentTicketProps {
  sale: any;
  /** When present the document is an abono (payment) receipt. */
  payment?: any | null;
  /** Attached to the signature image box so callers can capture the firma. */
  signatureRef?: React.Ref<View>;
}

export default function DocumentTicket({
  sale,
  payment,
  signatureRef,
}: DocumentTicketProps) {
  const m = deriveTicketModel(sale, payment);
  const title = m.isPayment ? 'Recibo de Abono' : 'Comprobante de Venta';

  const info: Array<[string, string]> = [['CLIENTE', m.clientName]];
  if (sale?.sucursal) {
    info.push(['SUCURSAL', String(sale.sucursal)]);
  }
  if (sale?.agentedeventas) {
    info.push(['AGENTE DE VENTAS', String(sale.agentedeventas)]);
  }
  if (sale?.formadepago) {
    info.push(['FORMA DE PAGO', String(sale.formadepago)]);
  }
  const infoPairs: Array<Array<[string, string]>> = [];
  for (let i = 0; i < info.length; i += 2) {
    infoPairs.push(info.slice(i, i + 2));
  }

  const importeFor = (p: any) => {
    const n = Number(p.quantity ?? 1) * Number(p.unit_price ?? p.price);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : '-';
  };

  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>huastex</Text>
          <Text style={styles.slogan}>Acondiciona tu espacio</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.headerMeta}>Folio: {m.folio}</Text>
          <Text style={styles.headerMeta}>Fecha: {m.ticketDate}</Text>
          <Text style={styles.headerMeta}>Hora: {formatTime12h()}</Text>
        </View>
      </View>
      <View style={styles.thickRule} />

      {infoPairs.map((pair, idx) => (
        <View key={idx} style={styles.infoRow}>
          {pair.map(([label, value]) => (
            <View key={label} style={styles.infoCol}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Productos</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.colName]}>Producto</Text>
        <Text style={[styles.th, styles.colQty]}>Cant.</Text>
        <Text style={[styles.th, styles.colUnit]}>Precio unit.</Text>
        <Text style={[styles.th, styles.colImp]}>Importe</Text>
      </View>
      {m.products.length ? (
        m.products.map((p: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <View style={styles.rowLine}>
              <Text style={[styles.td, styles.colName]}>
                {p.title || p.producto || 'Sin nombre'}
              </Text>
              <Text style={[styles.td, styles.colQty]}>
                {String(p.quantity ?? 1)}
              </Text>
              <Text style={[styles.td, styles.colUnit]}>
                ${String(p.unit_price ?? p.price ?? 'N/A')}
              </Text>
              <Text style={[styles.td, styles.colImp]}>{importeFor(p)}</Text>
            </View>
            {p.serial_number ? (
              <Text style={styles.serial}>Serie: {p.serial_number}</Text>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.td}>Sin productos</Text>
      )}

      <View style={styles.totals}>
        {m.isPayment ? (
          <>
            <Text style={styles.totalMain}>
              Cantidad pagada:  ${m.paymentAmount}
            </Text>
            <Text style={styles.totalLine}>
              <Text style={styles.bold}>Fecha límite para liquidar:</Text>{' '}
              {m.dueDate}
            </Text>
            {!m.apartado && (
              <Text style={styles.totalLine}>
                <Text style={styles.bold}>Saldo Precio Normal:</Text>{' '}
                {m.saldoNormal || '-'}
              </Text>
            )}
            <Text style={styles.totalLine}>
              <Text style={styles.bold}>Saldo Precio Promoción:</Text>{' '}
              {m.saldoPromo || '-'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.totalMain}>Total:  ${m.total}</Text>
            {!m.contado && (
              <Text style={styles.totalLine}>
                <Text style={styles.bold}>Enganche:</Text> ${m.formattedEnganche}
              </Text>
            )}
            {m.credit && (
              <>
                <Text style={styles.totalLine}>
                  <Text style={styles.bold}>Fecha límite para liquidar:</Text>{' '}
                  {m.dueDate}
                </Text>
                {!m.apartado && (
                  <Text style={styles.totalLine}>
                    <Text style={styles.bold}>Saldo Precio Normal:</Text>{' '}
                    {m.saldoNormal || '-'}
                  </Text>
                )}
                <Text style={styles.totalLine}>
                  <Text style={styles.bold}>Saldo Precio Promoción:</Text>{' '}
                  {m.saldoPromo || '-'}
                </Text>
              </>
            )}
          </>
        )}
      </View>

      <View style={styles.lightRule} />

      <View style={styles.bottomZone}>
        <View style={styles.bottomLeft}>
          {sale?.aclaraciones ? (
            <>
              <Text style={styles.infoLabel}>NOTAS</Text>
              <Text style={styles.notes}>{String(sale.aclaraciones)}</Text>
            </>
          ) : null}
          <Text style={styles.contact}>
            {m.isPayment
              ? 'WhatsApp: 482 108 8377'
              : 'Número de cel: 482 108 8377'}
          </Text>
          <Text style={styles.contact}>Correo: contacto@huastex.com</Text>
        </View>
        {sale?.firmadigital ? (
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureCaption}>Firma del cliente</Text>
            {/* collapsable={false} keeps the native view alive on Android so
                captureRef(signatureRef) works for the PDF. */}
            <View
              ref={signatureRef}
              collapsable={false}
              style={styles.signatureBox}
            >
              <Image
                source={{ uri: sale.firmadigital }}
                style={styles.signature}
                resizeMode="contain"
              />
            </View>
          </View>
        ) : null}
      </View>

      <Text style={styles.footer}>
        {m.isPayment ? 'huastex — Acondiciona tu espacio\n' : ''}
        Compra en huastex.com
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexShrink: 1,
  },
  brand: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
  },
  slogan: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 11,
    color: '#000',
    marginTop: 1,
  },
  thickRule: {
    height: 2,
    backgroundColor: '#333',
    marginTop: 12,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13.5,
    color: '#000',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 6,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#ededed',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#444',
  },
  tableRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rowLine: {
    flexDirection: 'row',
  },
  td: {
    fontSize: 12,
    color: '#000',
  },
  colName: {
    flex: 5,
    paddingRight: 4,
  },
  colQty: {
    flex: 1,
    textAlign: 'right',
  },
  colUnit: {
    flex: 2,
    textAlign: 'right',
  },
  colImp: {
    flex: 2,
    textAlign: 'right',
  },
  serial: {
    fontSize: 9.5,
    color: '#777',
    marginTop: 2,
    marginLeft: 8,
  },
  totals: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  totalMain: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  totalLine: {
    fontSize: 11.5,
    color: '#000',
    marginTop: 2,
  },
  bold: {
    fontWeight: 'bold',
  },
  lightRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#bbb',
    marginVertical: 12,
  },
  bottomZone: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomLeft: {
    flex: 1,
    paddingRight: 8,
  },
  notes: {
    fontSize: 11,
    color: '#222',
    marginBottom: 8,
  },
  contact: {
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
  signatureBlock: {
    width: 150,
  },
  signatureCaption: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  signatureBox: {
    // Explicit white so the JPEG capture (no alpha channel) stays white.
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  signature: {
    width: '100%',
    height: 90,
  },
  footer: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});
