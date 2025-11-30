import { Flex } from '@radix-ui/themes';
import styled from 'styled-components';
import { LogoIcon } from './LogoIcon.tsx';

export function TopLeftMenu() {
  return (
    <StyledTopLeftMenu>
      <a href="/" style={{ cursor: 'pointer' }}>
        <LogoIcon />
      </a>
    </StyledTopLeftMenu>
  );
}

const StyledTopLeftMenu = styled(Flex)`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
  background-color: #000000;
  transition: opacity 0.4s ease-in-out;
`;
