import { createContext, createRef, type RefObject, useReducer } from 'react';
import type { Rnd } from 'react-rnd';

interface LayoutState {
  mainHeight: string;

  leftPanel: RefObject<Rnd | null>;
  leftPanelStartWidth: string;
  leftPanelMaxWidth: string;
  leftPanelWidth: string;
  isLeftPanelExpanded: boolean;
  lastLeftMenuButtonClicked: string | null;
  lastLeftBorderClicked: string;
  leftborderClickTime: number;
  isRightPanelExpanded: boolean;
  lastRightMenuButtonClicked: string | null;

  homePanel: RefObject<Rnd | null>;
  homeHeight: string;
  homeWidth: string;
  homeStartWidth: string;
  homeStartHeight: string;
  lastHomeButtonClicked: string | null;
  lastHomeButtonClickedTime: number;
  lastHomeBorderClicked: string;
  lastHomeBorderClickedTime: number;

  chatPanel: RefObject<Rnd | null>;
  chatHeight: string;
  chatWidth: string;
  chatStartWidth: string;
  chatStartHeight: string;
  chatMaxHeight: string;
  lastChatButtonClicked: string | null;
  lastChatButtonClickedTime: number;
  lastChatBorderClicked: string;
  lastChatBorderClickedTime: number;

  mixerPanel: RefObject<Rnd | null>;
  mixerHeight: string;
  mixerWidth: string;
  mixerStartWidth: string;
  mixerStartHeight: string;
  mixerMaxWidth: string;
  isMixerPanelExpanded: boolean;
  lastMixerButtonClicked: string | null;
  lastMixerButtonClickedTime: number;
  lastMixerBorderClicked: string;
  lastMixerBorderClickedTime: number;
}

const defaultState: LayoutState = {
  mainHeight: '80vh',
  leftPanel: createRef<Rnd>(),
  leftPanelStartWidth: '200px',
  leftPanelMaxWidth: '500px',
  leftPanelWidth: '200px',
  isLeftPanelExpanded: false,
  lastLeftMenuButtonClicked: null,
  lastLeftBorderClicked: '',
  leftborderClickTime: 0,
  lastHomeButtonClicked: null,
  isRightPanelExpanded: false,
  lastRightMenuButtonClicked: null,
  homePanel: createRef<Rnd>(),
  homeHeight: '64px',
  homeWidth: '64px',
  homeStartWidth: '64px',
  homeStartHeight: '64px',
  lastHomeButtonClickedTime: 0,
  lastHomeBorderClicked: '',
  lastHomeBorderClickedTime: 0,
  chatPanel: createRef<Rnd>(),
  chatHeight: '52px',
  chatWidth: '100%',
  chatStartWidth: '100%',
  chatStartHeight: '52px',
  chatMaxHeight: '70vh',
  lastChatButtonClicked: null,
  lastChatButtonClickedTime: 0,
  lastChatBorderClicked: '',
  lastChatBorderClickedTime: 0,

  mixerPanel: createRef<Rnd>(),
  mixerHeight: '100%',
  mixerWidth: '24px',
  mixerStartHeight: '100%',
  mixerStartWidth: '250px',
  mixerMaxWidth: '300px',
  isMixerPanelExpanded: false,
  lastMixerButtonClicked: null,
  lastMixerButtonClickedTime: 0,
  lastMixerBorderClicked: '',
  lastMixerBorderClickedTime: 0,
};

const LayoutActionTypes = [
  'SET_LEFT_PANEL',
  'TOGGLE_LEFT_PANEL',
  'SET_LAST_LEFT_BUTTON_CLICKED',
  'LEFT_PANEL_WIDTH',
  'LEFT_BORDER_CLICKED',
  'TOGGLE_RIGHT_PANEL',
  'SET_LAST_RIGHT_BUTTON_CLICKED',
  'SAVE_SESSION',
  'SET_ALERTS',
  'LOAD_PROFILE',
  'SET_HOME_PANEL',
  'SET_LAST_HOME_BUTTON_CLICKED',
  'HOME_BORDER_CLICKED',
  'UPDATE_HOME_DIMENSIONS',
  'SET_CHAT_PANEL',
  'SET_LAST_CHAT_BUTTON_CLICKED',
  'CHAT_BORDER_CLICKED',
  'UPDATE_CHAT_DIMENSIONS',
  'TOGGLE_MIXER_PANEL',
  'SET_MIXER_PANEL',
  'SET_LAST_MIXER_BUTTON_CLICKED',
  'SET_LAST_MIXER_BORDER_CLICKED',
  'MIXER_BORDER_CLICKED',
  'UPDATE_MIXER_DIMENSIONS',
] as const;

type LayoutActionType = (typeof LayoutActionTypes)[number];

interface LayoutActionBase {
  type: LayoutActionType;
}

interface ActionToggleLeftPanel extends LayoutActionBase {
  type: 'TOGGLE_LEFT_PANEL';
  toggle: boolean;
}

function toggleLeftPanel(
  state: LayoutState,
  action: ActionToggleLeftPanel,
): LayoutState {
  return {
    ...state,
    isLeftPanelExpanded: action.toggle,
  };
}

interface ActionLeftPanelWidth extends LayoutActionBase {
  type: 'LEFT_PANEL_WIDTH';
  width: string;
}

function leftPanelWidth(
  state: LayoutState,
  action: ActionLeftPanelWidth,
): LayoutState {
  return {
    ...state,
    leftPanelWidth: action.width,
  };
}

interface ActionSetLastLeftButtonClicked extends LayoutActionBase {
  type: 'SET_LAST_LEFT_BUTTON_CLICKED';
  button: string;
}

function setLastLeftButtonClicked(
  state: LayoutState,
  action: ActionSetLastLeftButtonClicked,
): LayoutState {
  return {
    ...state,
    lastLeftMenuButtonClicked: action.button,
  };
}

interface ActionLeftBorderClicked extends LayoutActionBase {
  type: 'LEFT_BORDER_CLICKED';
  direction: string;
}

function leftBorderClicked(
  state: LayoutState,
  action: ActionLeftBorderClicked,
): LayoutState {
  return {
    ...state,
    lastLeftBorderClicked: action.direction,
    leftborderClickTime: Date.now(),
  };
}

interface ActionToggleRightPanel extends LayoutActionBase {
  type: 'TOGGLE_RIGHT_PANEL';
  toggle: boolean;
}

function toggleRightPanel(
  state: LayoutState,
  action: ActionToggleRightPanel,
): LayoutState {
  return {
    ...state,
    isRightPanelExpanded: action.toggle,
  };
}

interface ActionSetLastRightButtonClicked extends LayoutActionBase {
  type: 'SET_LAST_RIGHT_BUTTON_CLICKED';
  button: string;
}

function setLastRightButtonClicked(
  state: LayoutState,
  action: ActionSetLastRightButtonClicked,
): LayoutState {
  return {
    ...state,
    lastRightMenuButtonClicked: action.button,
  };
}

interface ActionSetLastHomeButtonClicked extends LayoutActionBase {
  type: 'SET_LAST_HOME_BUTTON_CLICKED';
  button: string;
}

function setLastHomeButtonClicked(
  state: LayoutState,
  action: ActionSetLastHomeButtonClicked,
): LayoutState {
  return {
    ...state,
    lastHomeButtonClicked: action.button,
    lastHomeButtonClickedTime: Date.now(),
  };
}

interface ActionHomeBorderClicked extends LayoutActionBase {
  type: 'HOME_BORDER_CLICKED';
  direction: string;
}

function homeBorderClicked(
  state: LayoutState,
  action: ActionHomeBorderClicked,
): LayoutState {
  return {
    ...state,
    lastHomeBorderClicked: action.direction,
    lastHomeBorderClickedTime: Date.now(),
  };
}

interface ActionUpdateHomeDimensions extends LayoutActionBase {
  type: 'UPDATE_HOME_DIMENSIONS';
  height: string;
  width: string;
}

function updateHomeDimensions(
  state: LayoutState,
  action: ActionUpdateHomeDimensions,
): LayoutState {
  if (state.homePanel === null) {
    return state;
  }
  const pannel = state.homePanel.current;
  if (!pannel) {
    return state;
  }
  pannel.updateSize({
    width: action.width,
    height: action.height,
  });
  return {
    ...state,
    homeHeight: action.height,
    homeWidth: action.width,
  };
}

interface ActionSetLastChatButtonClicked extends LayoutActionBase {
  type: 'SET_LAST_CHAT_BUTTON_CLICKED';
  button: string;
}

function setLastChatButtonClicked(
  state: LayoutState,
  action: ActionSetLastChatButtonClicked,
): LayoutState {
  return {
    ...state,
    lastChatButtonClicked: action.button,
    lastChatButtonClickedTime: Date.now(),
  };
}

interface ActionChatBorderClicked extends LayoutActionBase {
  type: 'CHAT_BORDER_CLICKED';
  direction: string;
}

function chatBorderClicked(
  state: LayoutState,
  action: ActionChatBorderClicked,
): LayoutState {
  return {
    ...state,
    lastChatBorderClicked: action.direction,
    lastChatBorderClickedTime: Date.now(),
  };
}

interface ActionUpdateChatDimensions extends LayoutActionBase {
  type: 'UPDATE_CHAT_DIMENSIONS';
  height: string;
  width: string;
}

function updateChatDimensions(
  state: LayoutState,
  action: ActionUpdateChatDimensions,
) {
  if (state.chatPanel === null) {
    return state;
  }
  const panel = state.chatPanel.current;
  if (!panel) {
    return state;
  }
  panel.updateSize({
    width: action.width,
    height: action.height,
  });
  return {
    ...state,
    chatHeight: action.height,
    chatWidth: action.width,
  };
}

interface ActionSetMixerPanel extends LayoutActionBase {
  type: 'SET_MIXER_PANEL';
  mixerPanel: RefObject<Rnd>;
}

function setMixerPanel(
  state: LayoutState,
  action: ActionSetMixerPanel,
): LayoutState {
  return {
    ...state,
    mixerPanel: action.mixerPanel,
  };
}

interface ActionSetLastMixerButtonClicked extends LayoutActionBase {
  type: 'SET_LAST_MIXER_BUTTON_CLICKED';
  button: string;
}

function setLastMixerButtonClicked(
  state: LayoutState,
  action: ActionSetLastMixerButtonClicked,
): LayoutState {
  return {
    ...state,
    lastMixerButtonClicked: action.button,
    lastMixerButtonClickedTime: Date.now(),
  };
}

interface ActionMixerBorderClicked extends LayoutActionBase {
  type: 'MIXER_BORDER_CLICKED';
  direction: string;
}

function mixerBorderClicked(
  state: LayoutState,
  action: ActionMixerBorderClicked,
): LayoutState {
  return {
    ...state,
    lastMixerBorderClicked: action.direction,
    lastMixerBorderClickedTime: Date.now(),
  };
}

interface ActionUpdateMixerDimensions extends LayoutActionBase {
  type: 'UPDATE_MIXER_DIMENSIONS';
  height: string;
  width: string;
}

function updateMixerDimensions(
  state: LayoutState,
  action: ActionUpdateMixerDimensions,
) {
  if (state.mixerPanel === null) {
    return state;
  }
  const panel = state.mixerPanel.current;
  if (panel) {
    panel.updateSize({
      width: action.width,
      height: action.height,
    });
  }
  return {
    ...state,
    mixerHeight: action.height,
    mixerWidth: action.width,
  };
}

interface ActionToggleMixerPanel extends LayoutActionBase {
  type: 'TOGGLE_MIXER_PANEL';
  toggle: boolean;
}

export function toggleMixerPanel(
  state: LayoutState,
  action: ActionToggleMixerPanel,
): LayoutState {
  return {
    ...state,
    isMixerPanelExpanded: action.toggle,
  };
}

interface ActionSetMixerBorderClicked extends LayoutActionBase {
  type: 'SET_LAST_MIXER_BORDER_CLICKED';
  direction: string;
}

export function setLastMixerBorderClicked(
  state: LayoutState,
  action: ActionSetMixerBorderClicked,
): LayoutState {
  return {
    ...state,
    lastMixerBorderClicked: action.direction,
    lastMixerBorderClickedTime: Date.now(),
  };
}

type Action =
  | ActionToggleLeftPanel
  | ActionSetLastLeftButtonClicked
  | ActionLeftPanelWidth
  | ActionLeftBorderClicked
  | ActionToggleRightPanel
  | ActionSetLastRightButtonClicked
  | ActionSetLastHomeButtonClicked
  | ActionHomeBorderClicked
  | ActionUpdateHomeDimensions
  | ActionSetLastChatButtonClicked
  | ActionChatBorderClicked
  | ActionUpdateChatDimensions
  | ActionSetMixerPanel
  | ActionSetLastMixerButtonClicked
  | ActionMixerBorderClicked
  | ActionUpdateMixerDimensions
  | ActionToggleMixerPanel
  | ActionSetMixerBorderClicked;

function reducer(state: LayoutState, action: Action): LayoutState {
  switch (action.type) {
    case 'TOGGLE_LEFT_PANEL':
      return toggleLeftPanel(state, action);
    case 'SET_LAST_LEFT_BUTTON_CLICKED':
      return setLastLeftButtonClicked(state, action);
    case 'LEFT_BORDER_CLICKED':
      return leftBorderClicked(state, action);
    case 'LEFT_PANEL_WIDTH':
      return leftPanelWidth(state, action);
    case 'TOGGLE_RIGHT_PANEL':
      return toggleRightPanel(state, action);
    case 'SET_LAST_RIGHT_BUTTON_CLICKED':
      return setLastRightButtonClicked(state, action);
    case 'SET_LAST_HOME_BUTTON_CLICKED':
      return setLastHomeButtonClicked(state, action);
    case 'HOME_BORDER_CLICKED':
      return homeBorderClicked(state, action);
    case 'UPDATE_HOME_DIMENSIONS':
      return updateHomeDimensions(state, action);
    case 'SET_LAST_CHAT_BUTTON_CLICKED':
      return setLastChatButtonClicked(state, action);
    case 'CHAT_BORDER_CLICKED':
      return chatBorderClicked(state, action);
    case 'UPDATE_CHAT_DIMENSIONS':
      return updateChatDimensions(state, action);
    case 'SET_MIXER_PANEL':
      return setMixerPanel(state, action);
    case 'SET_LAST_MIXER_BUTTON_CLICKED':
      return setLastMixerButtonClicked(state, action);
    case 'MIXER_BORDER_CLICKED':
      return mixerBorderClicked(state, action);
    case 'UPDATE_MIXER_DIMENSIONS':
      return updateMixerDimensions(state, action);
    case 'TOGGLE_MIXER_PANEL':
      return toggleMixerPanel(state, action);
    case 'SET_LAST_MIXER_BORDER_CLICKED':
      return setLastMixerBorderClicked(state, action);
  }
}

export const LayoutContext = createContext<{
  state: LayoutState;
  dispatch: React.Dispatch<Action>;
}>({ state: defaultState, dispatch: () => undefined });

interface LayoutProviderProps {
  children: React.ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const currentState: LayoutState = { ...defaultState };
  const [state, dispatch] = useReducer(reducer, currentState);
  return (
    <LayoutContext.Provider value={{ state, dispatch }}>
      {children}
    </LayoutContext.Provider>
  );
}
