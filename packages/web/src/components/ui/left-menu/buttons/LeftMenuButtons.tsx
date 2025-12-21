import {
  BellIcon,
  BookmarkFilledIcon,
  BookmarkIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import { Flex } from '@radix-ui/themes';
import { LayoutContext } from '@web/components/context/LayoutContext';
import { IconButton } from '@web/components/ui/IconButton';
import { useContext } from 'react';
import styled from 'styled-components';

export const LeftButtonIds = ['account', 'alerts', 'saved'] as const;
export type LeftButtonId = (typeof LeftButtonIds)[number];

type LeftButtonProps = {
  onAccountClick?: () => void;
  onAlertsClick?: () => void;
  onSaveClick?: () => void;
  onUnsaveClick?: () => void;
};

export function LeftButtons({
  onAccountClick,
  onAlertsClick,
  onSaveClick,
  onUnsaveClick,
}: LeftButtonProps) {
  return (
    <StyledLeftMenuButtonsContainer>
      <AccountButton onClick={onAccountClick} />
      <AlertsButton onClick={onAlertsClick} />
      <SaveButton onSaveClick={onSaveClick} onUnsaveClick={onUnsaveClick} />
    </StyledLeftMenuButtonsContainer>
  );
}

interface AccountButtonProps {
  onClick?: () => void;
}

function AccountButton({ onClick }: AccountButtonProps) {
  const { state, dispatch } = useContext(LayoutContext);

  const onButtonClick = () => {
    if (
      state.lastLeftMenuButtonClicked &&
      state.lastLeftMenuButtonClicked === 'account'
    ) {
      dispatch({
        type: 'SET_LAST_LEFT_BUTTON_CLICKED',
        button: '',
      });
      dispatch({
        type: 'TOGGLE_LEFT_PANEL',
        toggle: false,
      });
      return;
    }
    onClick?.();
    dispatch({
      type: 'SET_LAST_LEFT_BUTTON_CLICKED',
      button: 'account',
    });
    dispatch({
      type: 'TOGGLE_LEFT_PANEL',
      toggle: true,
    });
  };

  const isSelected = !!(
    state.lastLeftMenuButtonClicked &&
    state.lastLeftMenuButtonClicked === 'account'
  );

  return (
    <IconButton
      onClick={onButtonClick}
      invertIcon={true}
      solidSelected={isSelected}
    >
      <PersonIcon data-icon />
    </IconButton>
  );
}

interface AlertsButtonProps {
  onClick?: () => void;
}

function AlertsButton({ onClick }: AlertsButtonProps) {
  const { state, dispatch } = useContext(LayoutContext);
  const onButtonClick = () => {
    if (
      state.lastLeftMenuButtonClicked &&
      state.lastLeftMenuButtonClicked === 'alerts'
    ) {
      dispatch({
        type: 'SET_LAST_LEFT_BUTTON_CLICKED',
        button: '',
      });
      dispatch({
        type: 'TOGGLE_LEFT_PANEL',
        toggle: false,
      });
      return;
    }
    onClick?.();
    dispatch({
      type: 'SET_LAST_LEFT_BUTTON_CLICKED',
      button: 'alerts',
    });
    dispatch({
      type: 'TOGGLE_LEFT_PANEL',
      toggle: true,
    });
  };

  const isSelected = !!(
    state.lastLeftMenuButtonClicked &&
    state.lastLeftMenuButtonClicked === 'alerts'
  );

  return (
    <IconButton
      onClick={onButtonClick}
      invertIcon={true}
      solidSelected={isSelected}
    >
      <BellIcon data-icon />
    </IconButton>
  );
}

interface SaveButtonProps {
  onSaveClick?: () => void;
  onUnsaveClick?: () => void;
}

function SaveButton({ onSaveClick, onUnsaveClick }: SaveButtonProps) {
  const { state, dispatch } = useContext(LayoutContext);

  const onButtonClick = () => {
    if (
      state.lastLeftMenuButtonClicked &&
      state.lastLeftMenuButtonClicked === 'saved'
    ) {
      dispatch({
        type: 'SET_LAST_LEFT_BUTTON_CLICKED',
        button: '',
      });
      onUnsaveClick?.();
    } else {
      dispatch({
        type: 'SET_LAST_LEFT_BUTTON_CLICKED',
        button: 'saved',
      });
      onSaveClick?.();
    }
  };

  const isSelected = !!(
    state.lastLeftMenuButtonClicked &&
    state.lastLeftMenuButtonClicked === 'saved'
  );

  const icon = isSelected ? (
    <BookmarkFilledIcon data-icon="bookmark-filled" />
  ) : (
    <BookmarkIcon data-icon="bookmark" />
  );

  return (
    <IconButton onClick={onButtonClick} invertIcon={true}>
      {icon}
    </IconButton>
  );
}

const StyledLeftMenuButtonsContainer = styled(Flex)`
  display: grid;
  grid-template-rows: repeat(3, auto);
  gap: 16px;
`;
