// The shop assistant must only render for signed-in users while the backend
// reports free quota available, and must remove itself when the daily quota
// runs out mid-conversation (503 AI_QUOTA_EXHAUSTED).
import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import ShopAssistant from '../src/components/ShopAssistant';
import { AuthContext } from '../src/contexts/AuthContext';
import api from '../src/api';

jest.mock('../src/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderWithUser(user: any) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AuthContext.Provider value={{ user, signIn: jest.fn(), signOut: jest.fn() } as any}>
        <ShopAssistant />
      </AuthContext.Provider>,
    );
  });
  return tree;
}

// All nodes carrying the testID; [0] is the composite (has onPress etc.).
const findByTestID = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(n => n.props.testID === id);

describe('ShopAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing for anonymous shoppers (no status call)', async () => {
    const tree = await renderWithUser(null);
    expect(tree.toJSON()).toBeNull();
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('renders nothing when the backend reports quota exhausted', async () => {
    mockedApi.get.mockResolvedValue({ data: { available: false } });
    const tree = await renderWithUser({ email: 'c@c.com' });
    expect(mockedApi.get).toHaveBeenCalledWith('/ai/status');
    expect(tree.toJSON()).toBeNull();
  });

  it('shows the button when signed in and quota is available', async () => {
    mockedApi.get.mockResolvedValue({ data: { available: true } });
    const tree = await renderWithUser({ email: 'c@c.com' });
    expect(findByTestID(tree, 'shop-assistant-fab').length).toBeGreaterThan(0);
  });

  it('hides itself when the daily quota runs out mid-chat', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.get.mockResolvedValue({ data: { available: true } });
    mockedApi.post.mockRejectedValue({
      response: { status: 503, data: { code: 'AI_QUOTA_EXHAUSTED' } },
    });

    const tree = await renderWithUser({ email: 'c@c.com' });
    await ReactTestRenderer.act(async () => {
      findByTestID(tree, 'shop-assistant-fab')[0].props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findByTestID(tree, 'shop-assistant-input')[0].props.onChangeText('busco un refri');
    });
    await ReactTestRenderer.act(async () => {
      findByTestID(tree, 'shop-assistant-send')[0].props.onPress();
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/ai/shop-assistant', {
      message: 'busco un refri',
      history: [],
    });
    // Assistant removed for the rest of the day + user informed.
    expect(tree.toJSON()).toBeNull();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
