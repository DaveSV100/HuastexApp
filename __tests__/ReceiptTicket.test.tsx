// Renders both ticket variants with API-shaped data and checks the
// web-matching wording/values appear (and credit-only lines hide for contado).
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import ReceiptTicket from '../src/components/ReceiptTicket';

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
      title: 'MINISPLIT MIRAGE 1 T R 110V S/F NEX 2024 CHF120T/EHF120T',
      quantity: 1,
      unit_price: 8970,
      serial_number: 'EHF120T3012505403 CHF120T3012507468',
    },
  ],
};

const contadoSale = {
  id: 2065,
  nombre: 'Venta al publico',
  fecha: '2026-06-09',
  formadepago: 'Contado',
  sucursal: 'aquismon',
  agentedeventas: 'DM',
  preciopromocion: '695.00',
  products: [
    { title: 'Parrilla fraga dos quemadores P802', quantity: 1, unit_price: 695 },
  ],
};

const payment = {
  id: 4,
  sale_id: 808,
  fecha: '2026-06-07',
  cantidad: 225,
  cajero: 'DSV',
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

describe('ReceiptTicket', () => {
  it('renders a credit sale ticket with the web wording', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ReceiptTicket sale={creditSale} />);
    });
    const text = allText(tree);
    expect(text).toContain('Miguel Angel Huerta');
    expect(text).toContain('808');
    expect(text).toContain('07-06-2026');
    expect(text).toContain('Enganche:');
    expect(text).toContain('Fecha límite para liquidar:');
    expect(text).toContain('25-08-2026');
    expect(text).toContain('Saldo Precio Promo.:');
    expect(text).toContain('Serie: EHF120T3012505403 CHF120T3012507468');
    expect(text).toContain('Número de cel: 482 108 8377');
    expect(text).toContain('Notas: Pagos semanales de $225');
    expect(text).toContain('Compra en huastex.com');
  });

  it('hides credit-only lines for a contado sale', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ReceiptTicket sale={contadoSale} />);
    });
    const text = allText(tree);
    expect(text).toContain('Total:');
    expect(text).toContain('695.00');
    expect(text).not.toContain('Enganche:');
    expect(text).not.toContain('Fecha límite para liquidar:');
    expect(text).not.toContain('Saldo Precio');
  });

  it('hides Saldo Precio Normal for apartado sales and their abonos', async () => {
    const apartadoSale = { ...creditSale, formadepago: 'Apartado' };
    let saleTree!: ReactTestRenderer.ReactTestRenderer;
    let abonoTree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      saleTree = ReactTestRenderer.create(<ReceiptTicket sale={apartadoSale} />);
      abonoTree = ReactTestRenderer.create(
        <ReceiptTicket sale={apartadoSale} payment={payment} />,
      );
    });
    const saleText = allText(saleTree);
    expect(saleText).not.toContain('Saldo Precio Normal');
    expect(saleText).toContain('Saldo Precio Promo.:');
    expect(saleText).toContain('Fecha límite para liquidar:');
    const abonoText = allText(abonoTree);
    expect(abonoText).not.toContain('Saldo Precio Normal');
    expect(abonoText).toContain('Saldo Precio Promoción:');
  });

  it('renders a payment (abono) ticket with the web wording', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ReceiptTicket sale={creditSale} payment={payment} />,
      );
    });
    const text = allText(tree);
    expect(text).toContain('Cantidad pagada:');
    expect(text).toContain('225.00');
    expect(text).toContain('Saldo Precio Promoción:');
    expect(text).toContain('WhatsApp: 482 108 8377');
    expect(text).toContain('huastex — Acondiciona tu espacio');
    expect(text).not.toContain('Total:');
  });
});
