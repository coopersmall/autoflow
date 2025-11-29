import { Flex } from '@radix-ui/themes';
import { LayoutContext } from '@web/components/context/LayoutContext';
import { Panel } from '@web/components/ui/Panel';
import { useCallback, useContext } from 'react';
import type { RndResizeCallback, RndResizeStartCallback } from 'react-rnd';
import styled from 'styled-components';

export function LeftMenu({
  topButtons,
  bottomButtons,
  panelHeader,
  panelContent,
}: {
  topButtons?: React.ReactNode;
  bottomButtons?: React.ReactNode;
  panelHeader?: React.ReactNode;
  panelContent?: React.ReactNode;
}) {
  return (
    <>
      <StyledLeftPanelContainer>
        <StyledLeftTopButtonsContainer>
          {topButtons}
        </StyledLeftTopButtonsContainer>
        <StyledLeftBottomContainer>{bottomButtons}</StyledLeftBottomContainer>
      </StyledLeftPanelContainer>
      <LeftPanel panelHeader={panelHeader} panelContent={panelContent} />
      <StyledLeftPanelSpacer />
    </>
  );
}

const maxWidth = '400px' as const;
const x = 56 as const;
const y = 52 as const;

function LeftPanel({
  panelHeader,
  panelContent,
}: {
  panelHeader?: React.ReactNode;
  panelContent?: React.ReactNode;
}) {
  const { state } = useContext(LayoutContext);
  const { onResizeStart, onResizeStop } = useLeftPanel();

  const ref = state.leftPanel;

  return (
    <Panel
      ref={ref}
      x={x}
      y={y}
      height="90%"
      width={state.leftPanelStartWidth}
      maxWidth={maxWidth}
      isExpanded={state.isLeftPanelExpanded}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
    >
      <StyledLeftPanelHeader>{panelHeader}</StyledLeftPanelHeader>
      <StyledLeftPanelContent>{panelContent}</StyledLeftPanelContent>
    </Panel>
  );
}

function useLeftPanel() {
  const { state, dispatch } = useContext(LayoutContext);
  const wasLeftPanelDoubleClicked = useCallback(
    (direction: string): boolean => {
      return (
        direction === state.lastLeftBorderClicked &&
        state.leftborderClickTime !== 0 &&
        Date.now() - state.leftborderClickTime <= 300
      );
    },
    [state],
  );

  const onResizeStart: RndResizeStartCallback = useCallback(
    (_e, dir, _elementRef) => {
      dispatch({
        type: 'LEFT_BORDER_CLICKED',
        direction: dir,
      });

      if (wasLeftPanelDoubleClicked(dir)) {
        if (state.leftPanelWidth === maxWidth) {
          dispatch({
            type: 'LEFT_PANEL_WIDTH',
            width: state.leftPanelStartWidth,
          });
        } else if (state.leftPanelWidth === state.leftPanelStartWidth) {
          dispatch({
            type: 'LEFT_PANEL_WIDTH',
            width: maxWidth,
          });
        } else {
          dispatch({
            type: 'LEFT_PANEL_WIDTH',
            width: maxWidth,
          });
        }
      }
    },
    [state, dispatch, wasLeftPanelDoubleClicked],
  );

  const onResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, _position) => {
      dispatch({
        type: 'LEFT_PANEL_WIDTH',
        width: ref.style.width,
      });
    },
    [dispatch],
  );

  return {
    onResizeStart,
    onResizeStop,
  };
}

const StyledLeftPanelContainer = styled(Flex)`
  display: flex;
  flex-direction: column;
  height: 90%;
  padding-top: 52px;
`;

const StyledLeftTopButtonsContainer = styled(Flex)`
  height: 70%;
  padding: 10px;
  border: 1px solid #ff0000;
`;

const StyledLeftBottomContainer = styled(Flex)`
  height: 30%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid #ff0000;
`;

const StyledLeftPanelHeader = styled(Flex)`
  display: flex;
  flex-direction: row;
  height: 5%;
  min-height: 20px;
  border: 1px solid #ff0000;
`;

const StyledLeftPanelContent = styled(Flex)`
  background-color: #ff0000;
  height: 95%;
`;

const StyledLeftPanelSpacer = styled(Flex)`
  display: flex;
  width: 2%;
`;
