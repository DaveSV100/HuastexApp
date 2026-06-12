// src/components/ReceiptTicket.tsx
// 58mm thermal ticket, replicating the web's ticketPrinter.js /
// paymentTicketPrinter.js layout 1:1 (276px-wide design, same fields, same
// wording). Rendered on a white background and captured with ViewShot; the
// capture is then dithered and streamed to the printer.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { formatTime12h, deriveTicketModel } from '../utils/ticketFormat';

const logo = require('../../Assets/logo.png');

interface ReceiptTicketProps {
  sale: any;
  /** When present the ticket is an abono (payment) receipt. */
  payment?: any | null;
  /** Attached to the signature box so callers can capture just the firma. */
  signatureRef?: React.Ref<View>;
}

export default function ReceiptTicket({
  sale,
  payment,
  signatureRef,
}: ReceiptTicketProps) {
  const {
    isPayment,
    products,
    credit,
    contado,
    apartado,
    clientName,
    folio,
    ticketDate,
    dueDate,
    total,
    formattedEnganche,
    paymentAmount,
    saldoNormal,
    saldoPromo,
  } = deriveTicketModel(sale, payment);

  const time = formatTime12h();

  return (
    <View style={styles.ticket}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.businessName, isPayment && styles.businessNamePayment]}>
          huastex
        </Text>
        <Text style={styles.slogan}>Acondiciona tu espacio</Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>
          <Text style={styles.bold}>Cliente:</Text> {clientName}
        </Text>
        <Text style={styles.metaText}>
          <Text style={styles.bold}>Folio:</Text> {folio}
        </Text>
        <Text style={[styles.metaText, styles.date]}>
          <Text style={styles.bold}>Fecha:</Text> {ticketDate}
        </Text>
        <Text style={styles.time}>
          <Text style={styles.bold}>Hora:</Text> {time}
        </Text>
      </View>

      <View style={styles.dashedLine} />

      <View style={styles.products}>
        {products.length ? (
          products.map((p: any, i: number) => (
            <View key={i} style={styles.productLine}>
              <Text style={styles.productText}>
                <Text style={styles.bold}>
                  {p.title || p.producto || 'Sin nombre'}
                </Text>
                {'  x'}
                {p.quantity ?? 1}
                {'  $'}
                {p.unit_price ?? p.price ?? 'N/A'}
              </Text>
              {p.serial_number ? (
                <Text style={styles.small}>Serie: {p.serial_number}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.productText}>Sin productos</Text>
        )}
      </View>

      {!isPayment && <View style={styles.brSpace} />}
      <View style={styles.dashedLine} />

      <View style={styles.meta}>
        {isPayment ? (
          <>
            <Text style={styles.metaText}>
              <Text style={styles.bold}>Cantidad pagada:</Text> ${paymentAmount}
            </Text>
            <Text style={styles.metaText}>
              <Text style={styles.bold}>Fecha límite para liquidar:</Text>{' '}
              {dueDate}
            </Text>
            {!apartado && (
              <Text style={styles.metaText}>
                <Text style={styles.bold}>Saldo Precio Normal:</Text>{' '}
                {saldoNormal}
              </Text>
            )}
            <Text style={styles.metaText}>
              <Text style={styles.bold}>Saldo Precio Promoción:</Text>{' '}
              {saldoPromo}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.metaText}>
              <Text style={styles.bold}>Total:</Text> ${total}
            </Text>
            {!contado && (
              <Text style={styles.metaText}>
                <Text style={styles.bold}>Enganche:</Text> ${formattedEnganche}
              </Text>
            )}
            {credit && (
              <>
                <Text style={styles.metaText}>
                  <Text style={styles.bold}>Fecha límite para liquidar:</Text>{' '}
                  {dueDate}
                </Text>
                {!apartado && (
                  <Text style={styles.metaText}>
                    <Text style={styles.bold}>Saldo Precio Normal:</Text>{' '}
                    {saldoNormal}
                  </Text>
                )}
                <Text style={styles.metaText}>
                  <Text style={styles.bold}>Saldo Precio Promo.:</Text>{' '}
                  {saldoPromo}
                </Text>
              </>
            )}
          </>
        )}

        <View style={styles.brSpace} />
        {sale?.agentedeventas ? (
          <Text style={styles.small}>Agente: {sale.agentedeventas}</Text>
        ) : null}
        {sale?.sucursal ? (
          <Text style={styles.small}>Sucursal: {sale.sucursal}</Text>
        ) : null}
        <Text style={styles.small}>
          {isPayment ? 'WhatsApp: 482 108 8377' : 'Número de cel: 482 108 8377'}
        </Text>
        <Text style={styles.small}>Correo: contacto@huastex.com</Text>
        {sale?.aclaraciones ? (
          <Text style={styles.small}>Notas: {sale.aclaraciones}</Text>
        ) : null}
      </View>

      {sale?.firmadigital ? (
        // collapsable={false} keeps the native view alive on Android so
        // captureRef(signatureRef) works for the PDF.
        <View ref={signatureRef} collapsable={false} style={styles.signatureBox}>
          <Image
            source={{ uri: sale.firmadigital }}
            style={styles.signature}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {isPayment ? (
        <View style={styles.footerCentered}>
          <Text style={styles.small}>huastex — Acondiciona tu espacio</Text>
          <Text style={styles.small}>Compra en huastex.com</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.small}>Compra en huastex.com</Text>
        </View>
      )}

      <View style={styles.bottomSpace} />
    </View>
  );
}

// Same numbers as the web's ticketCss (276px visual width for 58mm).
const styles = StyleSheet.create({
  ticket: {
    width: 276,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 160,
    height: 90,
    marginBottom: 6,
  },
  businessName: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '400',
    color: '#000',
    marginBottom: 2,
  },
  businessNamePayment: {
    fontWeight: '500',
  },
  slogan: {
    fontSize: 20,
    lineHeight: 24,
    color: '#000',
    marginBottom: 6,
  },
  meta: {
    marginBottom: 6,
  },
  metaText: {
    fontSize: 20,
    lineHeight: 24,
    color: '#000',
  },
  date: {
    marginTop: 4,
    fontWeight: '600',
  },
  time: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 22,
    color: '#000',
  },
  bold: {
    fontWeight: 'bold',
  },
  dashedLine: {
    height: 0,
    borderWidth: 0.6,
    borderColor: '#333',
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  products: {
    marginBottom: 6,
  },
  productLine: {
    marginBottom: 6,
  },
  productText: {
    fontSize: 20,
    lineHeight: 24,
    color: '#000',
  },
  small: {
    fontSize: 14,
    lineHeight: 17,
    color: '#000',
    opacity: 0.9,
  },
  brSpace: {
    height: 20,
  },
  signatureBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#999',
    paddingTop: 6,
    // Explicit white so the JPEG capture of this box (no alpha channel)
    // doesn't come out black.
    backgroundColor: '#fff',
  },
  signature: {
    width: 256,
    height: 120,
  },
  footerCentered: {
    marginTop: 8,
    alignItems: 'center',
  },
  bottomSpace: {
    height: 50,
  },
});
