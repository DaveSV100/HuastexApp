/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Text, TextInput } from 'react-native';
import SaleModal from '../src/components/SaleModal';
import api from '../src/api';

jest.mock('../src/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));
jest.mock('../src/utils/thermalPrinter', () => ({ openCashDrawer: jest.fn() }));

type Node = ReactTestRenderer.ReactTestInstance;

const textOf = (node: Node): string =>
  node.children
    .map((c) => (typeof c === 'string' ? c : textOf(c)))
    .join('');

const autoField = (root: Node, label: string): Node =>
  root.find((n) => typeof n.type === 'function' && n.props.label === label);

const fieldValue = (root: Node, label: string): string =>
  autoField(root, label).findByType(TextInput).props.value;

const fieldEditable = (root: Node, label: string): boolean =>
  autoField(root, label).findByType(TextInput).props.editable;

// 'edit' (Assets/edit.png), 'robot' (Assets/robot.png) or null (no toggle).
const toggleIcon = (root: Node, label: string): string | null => {
  const images = autoField(root, label).findAll((n) => n.type === Image);
  if (!images.length) return null;
  const source = JSON.stringify(images[0].props.source);
  return /robot\.png/.test(source) ? 'robot' : /edit\.png/.test(source) ? 'edit' : source;
};

const hasWarning = (root: Node, text: string): boolean =>
  root.findAll((n) => n.type === Text && textOf(n) === text).length > 0;

// The TextInput that follows a plain <Text> label (product/enganche fields).
const inputAfterLabel = (root: Node, label: string, nth = 0): Node => {
  const labelNode = root.findAll(
    (n) => n.type === Text && textOf(n) === label,
  )[nth];
  const siblings = labelNode.parent!.children as Node[];
  return siblings[siblings.indexOf(labelNode) + 1];
};

const pressText = async (root: Node, text: string) => {
  const target = root
    .findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === text)
    .pop()!;
  await ReactTestRenderer.act(async () => target.props.onPress());
};

const type = async (input: Node, value: string) => {
  await ReactTestRenderer.act(async () => input.props.onChangeText(value));
};

const toggle = async (root: Node, label: string) => {
  const button = autoField(root, label).findAll(
    (n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function',
  )[0];
  await ReactTestRenderer.act(async () => button.props.onPress());
};

const setFormaDePago = async (root: Node, value: string) => {
  const picker = root.find(
    (n) => typeof n.type === 'function' && n.props.selectedValue === 'Contado',
  );
  await ReactTestRenderer.act(async () => picker.props.onValueChange(value));
};

const render = async (initialData: any = null) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SaleModal visible onClose={jest.fn()} onSaved={jest.fn()} initialData={initialData} />,
    );
  });
  return renderer!.root;
};

describe('SaleModal manual pricing', () => {
  it('auto-calculates promo, normal and saldos from hand-typed unit prices', async () => {
    const root = await render();
    await setFormaDePago(root, 'Crédito');
    await pressText(root, 'Agregar precio manualmente');

    await type(inputAfterLabel(root, 'Precio unitario'), '1000');
    await type(inputAfterLabel(root, 'Cantidad'), '2');
    expect(fieldValue(root, 'Precio de promoción')).toBe('2000.00');

    await pressText(root, 'Agregar Producto');
    await type(inputAfterLabel(root, 'Precio unitario', 1), '300');
    expect(fieldValue(root, 'Precio de promoción')).toBe('2300.00');
    // 2300 × 1.12 = 2576 → rounded up to end in 0/5
    expect(fieldValue(root, 'Precio normal')).toBe('2580.00');

    await type(inputAfterLabel(root, 'Enganche'), '500');
    expect(fieldValue(root, 'Saldo Precio Promoción')).toBe('1800.00');
    expect(fieldValue(root, 'Saldo Precio Normal')).toBe('2080.00');

    // Auto fields are locked and offer ✏️
    expect(fieldEditable(root, 'Precio de promoción')).toBe(false);
    expect(toggleIcon(root, 'Precio de promoción')).toBe('edit');
  });

  it('✏️ hands a field to the seller and 🤖 hands it back', async () => {
    const root = await render();
    await setFormaDePago(root, 'Crédito');
    await pressText(root, 'Agregar precio manualmente');
    await type(inputAfterLabel(root, 'Precio unitario'), '2000');
    await type(inputAfterLabel(root, 'Enganche'), '500');

    await toggle(root, 'Precio de promoción');
    expect(toggleIcon(root, 'Precio de promoción')).toBe('robot');
    expect(fieldEditable(root, 'Precio de promoción')).toBe(true);

    await type(autoField(root, 'Precio de promoción').findByType(TextInput), '2100');
    expect(fieldValue(root, 'Precio de promoción')).toBe('2100');
    // Derived fields build on the hand-typed promo price
    expect(fieldValue(root, 'Precio normal')).toBe('2355.00');
    expect(fieldValue(root, 'Saldo Precio Promoción')).toBe('1600.00');

    // Hand-typed saldo survives enganche changes
    await toggle(root, 'Saldo Precio Normal');
    await type(autoField(root, 'Saldo Precio Normal').findByType(TextInput), '999');
    await type(inputAfterLabel(root, 'Enganche'), '600');
    expect(fieldValue(root, 'Saldo Precio Normal')).toBe('999');
    expect(fieldValue(root, 'Saldo Precio Promoción')).toBe('1500.00');

    await toggle(root, 'Precio de promoción');
    expect(fieldValue(root, 'Precio de promoción')).toBe('2000.00');
    expect(toggleIcon(root, 'Precio de promoción')).toBe('edit');
  });

  it('keeps the inventory flow free of toggles', async () => {
    const root = await render();
    expect(toggleIcon(root, 'Precio de promoción')).toBeNull();
    expect(toggleIcon(root, 'Saldo Precio Promoción')).toBeNull();
  });

  it('lets Pagos de be typed by hand and recalculated', async () => {
    const root = await render();
    await setFormaDePago(root, 'Crédito');
    await pressText(root, 'Agregar precio manualmente');
    await type(inputAfterLabel(root, 'Precio unitario'), '2300');
    await type(inputAfterLabel(root, 'Enganche'), '500');
    await type(inputAfterLabel(root, 'Plazo'), '10');
    await pressText(root, 'Seleccionar frecuencia');
    await pressText(root, 'Semanal');

    // (2300 − 500) / 10 weeks = 180
    expect(fieldValue(root, 'Pagos de')).toBe('180.00');
    expect(fieldEditable(root, 'Pagos de')).toBe(false);

    await toggle(root, 'Pagos de');
    expect(fieldEditable(root, 'Pagos de')).toBe(true);
    expect(fieldValue(root, 'Pagos de')).toBe('180.00');
    await type(autoField(root, 'Pagos de').findByType(TextInput), '250');
    expect(fieldValue(root, 'Pagos de')).toBe('250');

    await toggle(root, 'Pagos de');
    expect(fieldValue(root, 'Pagos de')).toBe('180.00');
    expect(fieldEditable(root, 'Pagos de')).toBe(false);
  });

  it('blocks saving without a fecha and flags it', async () => {
    const root = await render();
    await type(inputAfterLabel(root, 'Nombre *'), 'Ana');
    await type(inputAfterLabel(root, 'Teléfono *'), '5551234');
    expect(root.findAll((n) => n.type === Text && textOf(n) === 'Agregar fecha')).toHaveLength(0);

    await pressText(root, 'Guardar');
    expect(api.post).not.toHaveBeenCalled();
    expect(root.findAll((n) => n.type === Text && textOf(n) === 'Agregar fecha')).toHaveLength(1);
  });

  it('keeps stored saldos when editing (they already include abonos)', async () => {
    const root = await render({
      id: 7,
      nombre: 'Ana',
      formadepago: 'Crédito',
      fecha: '2026-09-01',
      enganche: 500,
      preciopromocion: 2000,
      precionormal: 2240,
      saldo_precio_promocion: 1000,
      saldo_precio_normal: 1240,
      plazo: { value: 10, unit: 'weeks' },
      products: [{ title: 'Estufa', source: 'inventory', id: 3, quantity: 1, unit_price: 2000 }],
    });
    expect(fieldValue(root, 'Saldo Precio Promoción')).toBe('1000');
    expect(fieldValue(root, 'Saldo Precio Normal')).toBe('1240');

    await type(inputAfterLabel(root, 'Enganche'), '700');
    expect(fieldValue(root, 'Saldo Precio Promoción')).toBe('1000');
  });

  it('warns "Checar Precio Total" when the typed promo differs from the products', async () => {
    const root = await render();
    await pressText(root, 'Agregar precio manualmente');
    await type(inputAfterLabel(root, 'Precio unitario'), '1000');
    await type(inputAfterLabel(root, 'Cantidad'), '2');
    expect(hasWarning(root, 'Checar Precio Total')).toBe(false);

    await toggle(root, 'Precio de promoción');
    // Still equal to 2 × 1000 right after switching to manual
    expect(hasWarning(root, 'Checar Precio Total')).toBe(false);

    await type(autoField(root, 'Precio de promoción').findByType(TextInput), '1800');
    expect(hasWarning(root, 'Checar Precio Total')).toBe(true);

    // Matches again once the descuento accounts for it (2000 − 10% = 1800)
    await type(inputAfterLabel(root, 'Descuento (%)'), '10');
    expect(hasWarning(root, 'Checar Precio Total')).toBe(false);
  });

  it('uses the cerro_azul_* inventory prices for a Cerro Azul seller', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('role', 'staff');
    await AsyncStorage.setItem('branch', 'Cerro Azul');
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 1, product: 'Estufa Mabe', cerro_azul_price: 1000, cerro_azul_creditprice: 1200 }],
    });
    const root = await render();
    await setFormaDePago(root, 'Crédito');
    await type(root.findByProps({ placeholder: '🔍 Escriba aquí para buscar...' }), 'estufa');
    await pressText(root, 'Estufa Mabe - Seleccionar');
    expect(inputAfterLabel(root, 'Precio unitario').props.value).toBe('1200');
    expect(fieldValue(root, 'Precio de promoción')).toBe('1200.00');
    await AsyncStorage.clear();
  });

  it('reopens a sale saved with a hand-typed Pagos de as manual', async () => {
    const root = await render({
      id: 8,
      nombre: 'Ana',
      formadepago: 'Crédito',
      fecha: '2026-09-01',
      enganche: 500,
      preciopromocion: 2300,
      precionormal: 2580,
      saldo_precio_promocion: 1800,
      saldo_precio_normal: 2080,
      plazo: { value: 10, unit: 'weeks' },
      payment_frequency: 'Semanal',
      pagos_de: '250.00',
      products: [{ title: 'Estufa', source: 'inventory', id: 3, quantity: 1, unit_price: 2300 }],
    });
    expect(fieldValue(root, 'Pagos de')).toBe('250.00');
    expect(fieldEditable(root, 'Pagos de')).toBe(true);
    expect(toggleIcon(root, 'Pagos de')).toBe('robot');

    // Back to automatic: the calculated (2300 − 500) / 10 = 180
    await toggle(root, 'Pagos de');
    expect(fieldValue(root, 'Pagos de')).toBe('180.00');
  });
});

describe('SaleModal — calcular cambio & cash drawer', () => {
  const { openCashDrawer } = require('../src/utils/thermalPrinter');

  const renderWithSave = async (onSaved: jest.Mock) => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SaleModal visible onClose={jest.fn()} onSaved={onSaved} initialData={null} />,
      );
    });
    const root = renderer!.root;
    await type(inputAfterLabel(root, 'Nombre *'), 'Ana');
    await type(inputAfterLabel(root, 'Teléfono *'), '5551234');
    await pressText(root, 'Seleccionar fecha');
    await pressText(root, 'Confirmar');
    await pressText(root, 'Agregar precio manualmente');
    await type(inputAfterLabel(root, 'Precio unitario'), '1000');
    return root;
  };

  beforeEach(() => jest.clearAllMocks());

  it('charges the promo price for Contado and passes the change on save', async () => {
    const onSaved = jest.fn();
    const root = await renderWithSave(onSaved);
    expect(root.findAll((n) => n.type === Text && textOf(n) === 'Pago en efectivo')).toHaveLength(0);

    await pressText(root, 'Calcular cambio');
    expect(
      root.findAll((n) => n.type === Text && textOf(n) === 'A cobrar: $1,000.00'),
    ).toHaveLength(1);
    await type(root.find((n) => n.type === TextInput && n.props.placeholder === '0.00'), '1500');
    expect(root.findAll((n) => n.type === Text && textOf(n) === '$500.00')).toHaveLength(1);

    await pressText(root, 'Guardar');
    expect(openCashDrawer).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
      pagaCon: 1500,
      cambio: 500,
    });
  });

  it('charges the enganche for credit sales', async () => {
    const root = await renderWithSave(jest.fn());
    await setFormaDePago(root, 'Crédito');
    await type(inputAfterLabel(root, 'Enganche'), '300');
    await pressText(root, 'Calcular cambio');
    expect(
      root.findAll((n) => n.type === Text && textOf(n) === 'A cobrar: $300.00'),
    ).toHaveLength(1);
  });

  it('keeps the drawer closed for an electronic payment', async () => {
    const onSaved = jest.fn();
    const root = await renderWithSave(onSaved);
    await pressText(root, 'Pago electrónico');
    await pressText(root, 'Guardar');
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), null);
    expect(openCashDrawer).not.toHaveBeenCalled();
  });
});
