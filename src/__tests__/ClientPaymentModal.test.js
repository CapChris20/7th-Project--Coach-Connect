import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockCreateToken = jest.fn();
const mockPostCoachingCharge = jest.fn();

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const mock = (name) => {
    const Comp = (props) => ReactLocal.createElement(name, props, props.children);
    Comp.displayName = name;
    return Comp;
  };
  return {
    StyleSheet: { create: (styles) => styles, flatten: (styles) => styles, hairlineWidth: 1 },
    View: mock('View'),
    Text: mock('Text'),
    TextInput: mock('TextInput'),
    TouchableOpacity: mock('TouchableOpacity'),
    ActivityIndicator: mock('ActivityIndicator'),
    Platform: { OS: 'ios', select: (obj) => obj.ios },
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('../shared-ui/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      text: '#FFFFFF',
      textSecondary: '#AEAEB2',
      border: '#38383A',
      surface: '#1C1C1E',
      surfaceSecondary: '#2C2C2E',
      error: '#FF453A',
    },
    isDark: true,
  }),
}));

jest.mock('../shared/api/chargesApi', () => ({
  postCoachingCharge: (...args) => mockPostCoachingCharge(...args),
}));

jest.mock('@stripe/stripe-react-native', () => {
  const ReactLocal = require('react');
  return {
    CardField: (props) => {
      ReactLocal.useEffect(() => {
        props.onCardChange?.({ complete: true });
      }, []);
      return ReactLocal.createElement('CardField', { testID: 'stripe-card-field' });
    },
    useStripe: () => ({
      createToken: mockCreateToken,
    }),
  };
});

const { ClientPaymentModal } = require('../components/ClientPaymentModal');

function textContent(tree) {
  return tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => (Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '')))
    .join(' ');
}

function findTouchableByText(tree, label) {
  return tree.root
    .findAll((node) => node.type === 'TouchableOpacity')
    .find((node) => {
      const texts = node
        .findAll((child) => child.type === 'Text')
        .map((child) => (Array.isArray(child.children) ? child.children.join('') : String(child.children ?? '')));
      return texts.some((t) => t === label || t.includes(label));
    });
}

function renderModal(props = {}) {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  let tree;

  act(() => {
    tree = TestRenderer.create(
      <ClientPaymentModal
        trainerId="trainer123"
        trainerName="John"
        onClose={onClose}
        onSuccess={onSuccess}
        {...props}
      />,
    );
  });

  return { tree, onClose, onSuccess };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ClientPaymentModal', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockCreateToken.mockResolvedValue({ token: { id: 'tok_visa' }, error: null });
    mockPostCoachingCharge.mockResolvedValue({
      success: true,
      charge_id: 'ch_test',
      trainer_gets: 45,
    });
  });

  afterEach(() => {
    try {
      jest.useFakeTimers();
      act(() => {
        jest.runOnlyPendingTimers();
      });
    } catch (_) {
      // ignore if no fake timer scope
    }
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  test('Test 1: Form Renders', () => {
    const { tree } = renderModal();
    const content = textContent(tree);

    expect(content).toMatch(/Pay Coach John/);
    expect(tree.root.findAllByType('TextInput').length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'stripe-card-field' }).length).toBe(1);
    expect(content).toMatch(/PAY NOW/);
    expect(content).toMatch(/Cancel/);
  });

  test('Test 2: Amount Selection', () => {
    const { tree } = renderModal();
    const input = tree.root.findByType('TextInput');

    const fifty = findTouchableByText(tree, '$50');
    act(() => fifty.props.onPress());
    expect(input.props.value).toBe('50');

    const hundred = findTouchableByText(tree, '$100');
    act(() => hundred.props.onPress());
    expect(input.props.value).toBe('100');
  });

  test('Test 3: Custom Amount', async () => {
    const { tree } = renderModal();
    const input = tree.root.findByType('TextInput');

    act(() => input.props.onChangeText('75'));

    const payNow = findTouchableByText(tree, 'PAY NOW');
    await act(async () => {
      await payNow.props.onPress();
    });
    await flushPromises();

    expect(mockPostCoachingCharge).toHaveBeenCalledWith({
      trainerId: 'trainer123',
      amount: 75,
      token: 'tok_visa',
    });
  });

  test('Test 4: Payment Success Flow', async () => {
    jest.useFakeTimers();
    let resolveCharge;
    mockPostCoachingCharge.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCharge = () =>
            resolve({
              success: true,
              charge_id: 'ch_fifty',
              trainer_gets: 45,
            });
        }),
    );

    const { tree, onSuccess, onClose } = renderModal();
    const fifty = findTouchableByText(tree, '$50');
    act(() => fifty.props.onPress());

    const payNow = findTouchableByText(tree, 'PAY NOW');
    await act(async () => {
      payNow.props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findAllByType('ActivityIndicator').length).toBeGreaterThan(0);

    await act(async () => {
      resolveCharge();
      await Promise.resolve();
    });

    const successText = textContent(tree);
    expect(successText).toMatch(/Paid \$50/);
    expect(successText).toMatch(/They receive \$45/);
    expect(onSuccess).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onClose).toHaveBeenCalled();
  });

  test('Test 5: Payment Failure (Declined Card) + Retry', async () => {
    mockPostCoachingCharge
      .mockRejectedValueOnce(new Error('Card declined'))
      .mockResolvedValueOnce({
        success: true,
        charge_id: 'ch_retry',
        trainer_gets: 45,
      });

    const { tree, onSuccess } = renderModal();
    const fifty = findTouchableByText(tree, '$50');
    act(() => fifty.props.onPress());

    const payNow = findTouchableByText(tree, 'PAY NOW');
    await act(async () => {
      await payNow.props.onPress();
    });
    await flushPromises();

    expect(textContent(tree)).toMatch(/Card declined/i);
    expect(textContent(tree)).toMatch(/RETRY/);
    expect(onSuccess).not.toHaveBeenCalled();

    const retry = findTouchableByText(tree, 'RETRY');
    await act(async () => {
      await retry.props.onPress();
    });
    await flushPromises();

    expect(onSuccess).toHaveBeenCalled();
    expect(mockPostCoachingCharge).toHaveBeenCalledTimes(2);
  });

  test('Test 6: Cancel Button', () => {
    const { tree, onClose } = renderModal();
    const input = tree.root.findByType('TextInput');

    act(() => input.props.onChangeText('75'));

    const cancel = findTouchableByText(tree, 'Cancel');
    act(() => cancel.props.onPress());

    expect(onClose).toHaveBeenCalled();
    expect(input.props.value).toBe('100');
  });

  test('Test 7: Validation - Zero Amount', async () => {
    const { tree } = renderModal();
    const input = tree.root.findByType('TextInput');

    act(() => input.props.onChangeText('0'));

    const payNow = findTouchableByText(tree, 'PAY NOW');
    await act(async () => {
      await payNow.props.onPress();
    });

    expect(textContent(tree)).toMatch(/Enter amount between \$1-\$10,000/);
    expect(mockPostCoachingCharge).not.toHaveBeenCalled();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  test('Test 8: Validation - Below Minimum Amount', async () => {
    const { tree } = renderModal();
    const input = tree.root.findByType('TextInput');

    act(() => input.props.onChangeText('0.5'));

    const payNow = findTouchableByText(tree, 'PAY NOW');
    await act(async () => {
      await payNow.props.onPress();
    });

    expect(textContent(tree)).toMatch(/Enter amount between \$1-\$10,000/);
    expect(mockPostCoachingCharge).not.toHaveBeenCalled();
  });

  test('Test 9: Validation - Empty Amount', async () => {
    const { tree } = renderModal();
    const input = tree.root.findByType('TextInput');

    act(() => input.props.onChangeText(''));

    const payNow = findTouchableByText(tree, 'PAY NOW');
    await act(async () => {
      await payNow.props.onPress();
    });

    expect(textContent(tree)).toMatch(/Enter amount between \$1-\$10,000/);
    expect(mockPostCoachingCharge).not.toHaveBeenCalled();
  });
});
