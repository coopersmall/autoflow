import { Flex } from '@radix-ui/themes';
import { LayoutContext } from '@web/components/context/LayoutContext.tsx';
import { useContext } from 'react';
import styled from 'styled-components';

interface TopMenuProps {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function TopMenu({ leftContent, rightContent }: TopMenuProps) {
  const { state } = useContext(LayoutContext);
  return (
    <StyleTopMenuContainer height={state.chatStartHeight}>
      <StyleTopMenuLeft>{leftContent}</StyleTopMenuLeft>
      <StyleTopMenuRight>{rightContent}</StyleTopMenuRight>
    </StyleTopMenuContainer>
  );
}

const StyleTopMenuContainer = styled(Flex)<{
  height: string;
}>`
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  transition: all 0.5s ease-in-out;
`;

const StyleTopMenuLeft = styled(Flex)`
  width: 70%;
`;

const StyleTopMenuRight = styled(Flex)`
  width: 30%;
`;
