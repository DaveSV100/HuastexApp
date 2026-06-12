// The Descargar PDF preview must read like a bill/document and show the
// same derived fields as the PDF itself.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import DocumentTicket from '../src/components/DocumentTicket';

const creditSale = {
  id: 808,
  nombre: 'Miguel Angel Huerta',
  fecha: '2026-06-07T00:00:00.000Z',
  formadepago: 'Crédito',
  sucursal: 'aquismon',
  agentedeventas: 'DSV',
  enganche: '225.00',
  preciopromocion: '2670.00',
  saldo_precio_normal: '3315.00',
  saldo_precio_promocion: '2445.00',
  fechavencimiento: '2026-08-25T00:00:00.000Z',
  aclaraciones: 'Pagos semanales de $225',
  firmadigital: null,
  products: [
    {
      title: 'MINISPLIT MIRAGE 1 T R 110V S/F NEX 2024',
      quantity: 2,
      unit_price: 8970,
      serial_number: 'EHF120T3012505403',
    },
  ],
};

const payment = {
  id: 4,
  sale_id: 808,
  fecha: '2026-06-07',
  cantidad: 225,
  saldo_precio_normal: 3315,
  saldo_precio_promocion: 2445,
};

function collectStrings(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectStrings).join('');
  return collectStrings(node.children);
}

function allText(tree: ReactTestRenderer.ReactTestRenderer): string {
  return collectStrings(tree.toJSON());
}

describe('DocumentTicket', () => {
  it('renders the sale as a bill with table columns and totals', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<DocumentTicket sale={creditSale} />);
    });
    const text = allText(tree);
    expect(text).toContain('Comprobante de Venta');
    expect(text).toContain('Folio: 808');
    expect(text).toContain('Fecha: 07-06-2026');
    expect(text).toContain('Miguel Angel Huerta');
    expect(text).toContain('Importe');
    expect(text).toContain('$17940.00'); // 2 × 8970
    expect(text).toContain('Total:');
    expect(text).toContain('2670.00');
    expect(text).toContain('Fecha límite para liquidar:');
    expect(text).toContain('Serie: EHF120T3012505403');
    expect(text).toContain('Compra en huastex.com');
    // No signature section when the customer didn't sign.
    expect(text).not.toContain('Firma del cliente');
  });

  it('renders the abono variant', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <DocumentTicket sale={creditSale} payment={payment} />,
      );
    });
    const text = allText(tree);
    expect(text).toContain('Recibo de Abono');
    expect(text).toContain('Cantidad pagada:');
    expect(text).toContain('225.00');
    expect(text).toContain('WhatsApp: 482 108 8377');
    expect(text).not.toContain('Total:');
  });

  it('hides Saldo Precio Normal for apartado sales', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <DocumentTicket sale={{ ...creditSale, formadepago: 'Apartado' }} />,
      );
    });
    const text = allText(tree);
    expect(text).not.toContain('Saldo Precio Normal');
    expect(text).toContain('Saldo Precio Promoción:');
  });

  it('shows the signature box when the customer signed', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <DocumentTicket
          sale={{ ...creditSale, firmadigital: 'data:image/png;base64,xxx' }}
        />,
      );
    });
    expect(allText(tree)).toContain('Firma del cliente');
  });
});
