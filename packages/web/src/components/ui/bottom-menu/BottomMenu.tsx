import { Flex } from '@radix-ui/themes';
import styled from 'styled-components';

export function BottomMenu({
  leftContent,
  middleContent,
  rightContent,
}: {
  leftContent?: React.ReactNode;
  middleContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}) {
  return (
    <StyledBottomMenuContainer>
      <StyledBottomMenuLeftContent>{leftContent}</StyledBottomMenuLeftContent>
      <StyledBottomMenuMiddleContent>
        {middleContent}
      </StyledBottomMenuMiddleContent>
      <StyledBottomMenuRightContent>
        {rightContent}
      </StyledBottomMenuRightContent>
    </StyledBottomMenuContainer>
  );
}

const StyledBottomMenuContainer = styled(Flex)`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
`;

const StyledBottomMenuLeftContent = styled(Flex)`
  border: 1px solid red;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15%;
  height: 100%;
`;

const StyledBottomMenuMiddleContent = styled(Flex)`
  border: 1px solid red;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 55%;
  height: 100%;
`;

const StyledBottomMenuRightContent = styled(Flex)`
  background-color: black;
  border: 1px solid red;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30%;
  height: 100%;
`;
