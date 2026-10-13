/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import PaymentsModal from '../src/components/PaymentsModal';
import api from '../src/api';
import { openCashDrawer } from '../src/utils/thermalPrinter';

jest.mock('../src/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn((url: string) =>
      Promise.resolve({
        data: url === '/payments/add'
          ? { id: 55, cantidad: '375.00', saldo_precio_promocion: '4725.00' }
          : { id: 9 },
      }),
    ),
  },
}));
jest.mock('../src/utils/thermalPrinter', () => ({ openCashDrawer: jest.fn() }));

type Node = ReactTestRenderer.ReactTestInstance;

const textOf = (node: Node): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

const hasText = (root: Node, text: string) =>
  root.findAll((n) => n.type === Text && textOf(n) === text).length > 0;

const pressText = async (root: Node, text: string) => {
  const target = root
    .findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === text)
    .pop()!;
  await ReactTestRenderer.act(async () => target.props.onPress());
};

// nth: "Cantidad" and "Paga con" share the 0.00 placeholder (0 = Cantidad).
const typeInto = async (root: Node, placeholder: string, value: string, nth = 0) => {
  const input = root.findAll(
    (n) => n.type === TextInput && n.props.placeholder === placeholder,
  )[nth];
  await ReactTestRenderer.act(async () => input.props.onChangeText(value));
};

const setMethod = async (root: Node, value: string) => {
  const picker = root.find(
    (n) => typeof n.type === 'function' && n.props.selectedValue === 'deposit',
  );
  await ReactTestRenderer.act(async () => picker.props.onValueChange(value));
};

const sale = { id: 7, nombre: 'Ana', sucursal: 'cerroazul', saldo_precio_promocion: 5100, saldo_precio_normal: 6120, products: [] };

const render = async (onPaymentSuccess = jest.fn()) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <PaymentsModal visible sale={sale} onClose={jest.fn()} onPaymentSuccess={onPaymentSuccess} />,
    );
  });
  const root = renderer!.root;
  // fecha (today) + cantidad + cajero
  await pressText(root, 'Seleccionar fecha');
  await pressText(root, 'Confirmar');
  await typeInto(root, '0.00', '375');
  await typeInto(root, 'Nombre del cajero', 'Luis');
  return root;
};

beforeEach(() => jest.clearAllMocks());

describe('PaymentsModal — paga con / cambio', () => {
  it('shows the change for a cash abono and passes it to the confirmation', async () => {
    const onPaymentSuccess = jest.fn();
    const root = await render(onPaymentSuccess);
    expect(hasText(root, 'Pago en efectivo')).toBe(true);

    await typeInto(root, '0.00', '500', 1);
    expect(hasText(root, 'Cambio a entregar')).toBe(true);
    expect(hasText(root, '$125.00')).toBe(true);

    await pressText(root, 'Guardar Abono');
    expect(api.post).toHaveBeenCalledWith('/payments/add', expect.any(Object));
    // "Paga con" is screen-only: never sent to the server.
    expect((api.post as jest.Mock).mock.calls[0][1]).not.toHaveProperty('pagaCon');
    expect(openCashDrawer).toHaveBeenCalledTimes(1);
    expect(onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 55, payment_type: 'deposit' }),
      { pagaCon: 500, cambio: 125 },
    );
  });

  it('warns what is missing when the customer pays with less', async () => {
    const root = await render();
    await typeInto(root, '0.00', '300', 1);
    expect(hasText(root, 'Faltan')).toBe(true);
    expect(hasText(root, '$75.00')).toBe(true);
  });

  it.each(['credit_card', 'transfer', 'cash_deposit', 'online'])(
    'hides the calculator and keeps the drawer closed for %s',
    async (method) => {
      const onPaymentSuccess = jest.fn();
      const root = await render(onPaymentSuccess);
      await setMethod(root, method);
      expect(hasText(root, 'Pago en efectivo')).toBe(false);

      await pressText(root, 'Guardar Abono');
      expect(openCashDrawer).not.toHaveBeenCalled();
      expect(onPaymentSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ payment_type: method }),
        null,
      );
    },
  );
});
