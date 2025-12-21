import { Flex } from '@radix-ui/themes';
import { LayoutContext } from '@web/components/context/LayoutContext';
import { useContext } from 'react';
import styled from 'styled-components';

export function TopRightMenuContent({
  buttons,
  content,
}: {
  buttons?: React.ReactNode;
  content?: React.ReactNode;
}) {
  const { state } = useContext(LayoutContext);
  const isVisible = state.chatHeight !== state.chatStartHeight;

  return (
    <StyledTopRightMenu>
      <StyledTopRightMenuButtonsContainer height={state.chatStartHeight}>
        {buttons}
      </StyledTopRightMenuButtonsContainer>
      {isVisible && (
        <StyledTopRightMenuContentContainer isVisible={isVisible}>
          {content}
        </StyledTopRightMenuContentContainer>
      )}
    </StyledTopRightMenu>
  );
}

const StyledTopRightMenu = styled(Flex)<{
  isVisible?: boolean;
}>`
  width: 100%;
  display: flex;
  flex-direction: column;
  transition: opacity 0.4s ease-in-out;
  background-color: #000000;
`;

const StyledTopRightMenuButtonsContainer = styled(Flex)<{
  height: string;
}>`
  display: grid;
  justify-content: flex-end;
  align-items: center;
  height: ${(props) => props.height};
  padding-right: 16px;
`;

const StyledTopRightMenuContentContainer = styled(Flex)<{
  isVisible?: boolean;
}>`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  opacity: ${(props) => (props.isVisible ? 1 : 0)};
  visibility: ${(props) => (props.isVisible ? 'visible' : 'hidden')};
`;
