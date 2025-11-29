import { LayoutContext } from '@web/components/context/LayoutContext';
import type React from 'react';
import { forwardRef, useCallback, useContext } from 'react';
import {
  Rnd,
  type RndResizeCallback,
  type RndResizeStartCallback,
} from 'react-rnd';
import styled from 'styled-components';

export function TopRightMenuPanel({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { state } = useContext(LayoutContext);
  const { onResizeStart, onResizeStop } = useTopLetfPanel();

  return (
    <TopRightMenuPanelRef
      ref={state.chatPanel}
      height={state.chatHeight}
      startWidth={state.chatStartWidth}
      startHeight={state.chatStartHeight}
      maxHeigth={state.chatMaxHeight}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
    >
      {children}
    </TopRightMenuPanelRef>
  );
}

interface TopRightMenuRefProps {
  height: string;
  startWidth: string;
  startHeight: string;
  maxHeigth: string;
  children?: React.ReactNode;
  onResizeStart: RndResizeStartCallback;
  onResizeStop: RndResizeCallback;
}

const TopRightMenuPanelRef = forwardRef<Rnd, TopRightMenuRefProps>(
  (
    {
      height,
      startWidth,
      startHeight,
      maxHeigth,
      children,
      onResizeStart,
      onResizeStop,
    },
    ref,
  ) => (
    <StyledRnd
      isExpanded={height !== startHeight}
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
      }}
      enableResizing={{
        bottom: true,
      }}
      height={height}
      minHeight={startHeight}
      maxHeight={maxHeigth}
      disableDragging={true}
      minWidth={startWidth}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
    >
      {children}
    </StyledRnd>
  ),
);

function useTopLetfPanel() {
  const { state, dispatch } = useContext(LayoutContext);

  const wasTopPanelDoubleClicked = useCallback(
    (direction: string): boolean => {
      return (
        direction === state.lastChatBorderClicked &&
        state.lastChatBorderClickedTime !== 0 &&
        Date.now() - state.lastChatBorderClickedTime <= 300
      );
    },
    [state],
  );

  const onResizeStart: RndResizeStartCallback = useCallback(
    (_e, dir, _elementRef) => {
      dispatch({
        type: 'CHAT_BORDER_CLICKED',
        direction: dir,
      });

      if (wasTopPanelDoubleClicked(dir)) {
        const { height, width } = onDoubleCick(
          state.chatStartHeight,
          state.chatHeight,
          state.chatStartWidth,
          state.chatMaxHeight,
        );
        dispatch({
          type: 'UPDATE_CHAT_DIMENSIONS',
          height,
          width,
        });
      }
    },
    [state, dispatch, wasTopPanelDoubleClicked],
  );

  const onResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, _position) => {
      dispatch({
        type: 'UPDATE_CHAT_DIMENSIONS',
        width: ref.style.width,
        height: ref.style.height,
      });
    },
    [dispatch],
  );

  return {
    onResizeStart,
    onResizeStop,
  };
}

function onDoubleCick(
  startHeight: string,
  height: string,
  width: string,
  maxHeigth: string,
): { height: string; width: string } {
  if (height === startHeight) {
    return { height: maxHeigth, width: width };
  }
  return { height: startHeight, width: width };
}

const StyledRnd = styled(Rnd)<{
  isExpanded: boolean;
}>`
  background-color: #000000;
  opacity: ${({ isExpanded }) => (isExpanded ? 0.8 : 0.2)};
  transition:
    opacity 0.4s ease-in-out,
    box-shadow 0.4s ease-in-out;
  border-radius: 5px;
  &:hover {
    opacity: 1;
    box-shadow: 0 0 0 2px #ff0000;
  }
  z-index: 1000;
`;
