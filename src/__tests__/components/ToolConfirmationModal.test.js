import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

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
    Modal: mock('Modal'),
    Pressable: mock('Pressable'),
    ActivityIndicator: mock('ActivityIndicator'),
    Platform: { OS: 'ios', select: (obj) => obj.ios },
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('../../ai/tools/executeCoachTool', () => ({
  normalizeToolCall: (raw) => {
    if (!raw) return null;
    const nameRaw = raw.name || raw.tool || raw.action;
    if (!nameRaw) return null;
    const params =
      raw.params && typeof raw.params === 'object'
        ? { ...raw.params }
        : { ...raw };
    if (nameRaw === 'logNutrition' && params.name && !params.food && !params.foodName) {
      params.food = params.name;
      params.foodName = params.name;
    }
    delete params.name;
    delete params.tool;
    return { name: nameRaw, params, reasoning: raw.reasoning || null };
  },
  TOOL_DISPLAY_NAMES: {
    logSleep: 'Log sleep',
    logNutrition: 'Log nutrition',
    adjustMacroTargets: 'Adjust macros',
  },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
}));

jest.mock('../../app/config', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}));

const passthroughModal = () => () => null;

jest.mock('../../aiChat/tool-modals/toolModalHelpers', () => {
  const ReactLocal = require('react');
  return {
    ToolModalBody: ({ children }) => ReactLocal.createElement('ToolModalBody', null, children),
    ConfirmCancelRow: ({ onConfirm, onCancel, loading }) =>
      ReactLocal.createElement(
        'ConfirmCancelRow',
        null,
        ReactLocal.createElement('Pressable', {
          onPress: onConfirm,
          accessibilityLabel: 'Confirm',
          accessibilityState: { disabled: !!loading },
        }),
        ReactLocal.createElement('Pressable', {
          onPress: onCancel,
          accessibilityLabel: 'Cancel',
        }),
        loading ? ReactLocal.createElement('ActivityIndicator') : null,
      ),
    DetailRow: ({ value }) => ReactLocal.createElement('Text', null, value),
  };
});

jest.mock('../../aiChat/tool-modals/UpdateWorkoutModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/BookSessionModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/UpdateGoalModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/NotifyTrainerModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/LogWaterModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/LogStepsModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/RateEnergyModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/LogMoodModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/RateWorkoutModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/OpenWorkoutPlanModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/LogRestDayModal', () => passthroughModal());
jest.mock('../../aiChat/tool-modals/DeleteLogModal', () => passthroughModal());

jest.mock('../../aiChat/tool-modals/LogSleepModal', () => {
  const ReactLocal = require('react');
  return function LogSleepModal({ params, onConfirm, onCancel, loading }) {
    return ReactLocal.createElement(
      'LogSleepModal',
      null,
      ReactLocal.createElement('Text', null, String(params?.hours)),
      ReactLocal.createElement('Text', null, 'hours'),
      ReactLocal.createElement('Pressable', {
        onPress: onConfirm,
        accessibilityLabel: 'Confirm',
        accessibilityState: { disabled: !!loading },
      }),
      ReactLocal.createElement('Pressable', {
        onPress: onCancel,
        accessibilityLabel: 'Cancel',
      }),
      loading ? ReactLocal.createElement('ActivityIndicator') : null,
    );
  };
});

jest.mock('../../aiChat/tool-modals/LogNutritionModal', () => {
  const ReactLocal = require('react');
  return function LogNutritionModal({ params }) {
    const food = params?.name || params?.food || params?.foodName || 'Food';
    return ReactLocal.createElement(
      'LogNutritionModal',
      null,
      ReactLocal.createElement('Text', null, food),
      ReactLocal.createElement('Text', null, String(params?.calories ?? '')),
    );
  };
});

jest.mock('../../aiChat/tool-modals/AdjustMacrosModal', () => {
  const ReactLocal = require('react');
  return function AdjustMacrosModal({ params }) {
    return ReactLocal.createElement(
      'AdjustMacrosModal',
      null,
      ReactLocal.createElement('Text', null, String(params?.calories ?? '')),
      ReactLocal.createElement('Text', null, String(params?.protein ?? '')),
    );
  };
});

const ToolConfirmationModal = require('../../aiChat/chat-thread/ToolConfirmationModal').default;

function renderModal(props = {}) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <ToolConfirmationModal
        visible={true}
        toolCall={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        loading={false}
        {...props}
      />,
    );
  });
  return tree;
}

function textContent(tree) {
  return tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => node.children.join(''))
    .join(' ');
}

describe('ToolConfirmationModal rendering', () => {
  it('does not render when no tool is present', () => {
    const tree = renderModal({ toolCall: null });
    expect(tree.root.findAllByType('LogSleepModal')).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Confirm' })).toHaveLength(0);
  });

  it('renders logSleep modal with hours and action buttons', () => {
    const tree = renderModal({
      toolCall: { tool: 'logSleep', params: { hours: 7 } },
    });

    expect(textContent(tree)).toMatch(/7/);
    expect(textContent(tree)).toMatch(/hours/i);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Confirm' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Cancel' }).length).toBeGreaterThan(0);
  });

  it('renders logNutrition modal with food and calories', () => {
    const tree = renderModal({
      toolCall: { tool: 'logNutrition', params: { name: 'Big Mac', calories: 580 } },
    });

    expect(textContent(tree)).toMatch(/Big Mac/);
    expect(textContent(tree)).toMatch(/580/);
  });

  it('renders adjustMacroTargets modal with calorie and protein values', () => {
    const tree = renderModal({
      toolCall: { tool: 'adjustMacroTargets', params: { calories: 2000, protein: 150 } },
    });

    expect(textContent(tree)).toMatch(/2000/);
    expect(textContent(tree)).toMatch(/150/);
  });

  it('disables confirm and shows loading indicator when loading', () => {
    const tree = renderModal({
      toolCall: { tool: 'logSleep', params: { hours: 6 } },
      loading: true,
    });

    const confirm = tree.root.findByProps({ accessibilityLabel: 'Confirm' });
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
    expect(tree.root.findAllByType('ActivityIndicator').length).toBeGreaterThan(0);
  });

  it('calls onCancel when Cancel is pressed', () => {
    const onCancel = jest.fn();
    const tree = renderModal({
      toolCall: { tool: 'logSleep', params: { hours: 8 } },
      onCancel,
    });

    const cancel = tree.root.findByProps({ accessibilityLabel: 'Cancel' });
    act(() => cancel.props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm is pressed', () => {
    const onConfirm = jest.fn();
    const tree = renderModal({
      toolCall: { tool: 'logSleep', params: { hours: 8 } },
      onConfirm,
    });

    const confirm = tree.root.findByProps({ accessibilityLabel: 'Confirm' });
    act(() => confirm.props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
