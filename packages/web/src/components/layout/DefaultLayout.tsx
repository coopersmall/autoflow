import { Container, Flex, Section, Theme } from '@radix-ui/themes';
import styled from 'styled-components';

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <Theme appearance="dark" panelBackground="solid">
      <Flex>
        <StyledDefaultLayoutContainer>
          <StyledDefaultLayoutContent>{children}</StyledDefaultLayoutContent>
        </StyledDefaultLayoutContainer>
      </Flex>
    </Theme>
  );
}

const StyledDefaultLayoutContainer = styled(Container)`
  margin: 0 16px;
  size: 2;
`;

const StyledDefaultLayoutContent = styled(Section)`
  size: 1;
  border-radius: 8px;
`;
