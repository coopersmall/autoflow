import { Flex } from '@radix-ui/themes';
import styled from 'styled-components';

interface HeaderProps {
  link: string;
  children?: React.ReactNode;
}

export function Header({ link, children }: HeaderProps) {
  return (
    <StyledHeaderContainer>
      <StyledHeaderLogo href={link}>
        <StyledHeaderLogoIcon data-icon />
      </StyledHeaderLogo>
      <StyledHeaderSpacer />
      <StyledHeaderContentSection>{children}</StyledHeaderContentSection>
      <StyledHeaderRightSection />
    </StyledHeaderContainer>
  );
}

const StyledHeaderContainer = styled(Flex)`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: 36px;
  margin-top: 16px;
  margin-bottom: 36px;
  margin-left: 30px;
  justify-content: center;
`;

const StyledHeaderLogo = styled.a`
  display: flex;
  align-items: center;
  text-decoration: none;
`;

const StyledHeaderLogoIcon = styled.div`
  width: 36px;
  height: 36px;
  background-image: url('/path/to/logo.svg'); /* Replace with your logo path */
  background-size: cover;
`;

const StyledHeaderSpacer = styled(Flex)`
  align-items: center;
  display: flex;
  flex-basis: 10%;
  flex-grow: 0;
  flex-shrink: 0;
  width: 10%;
`;

const StyledHeaderContentSection = styled(Flex)`
  align-items: center;
  justify-content: center;
  display: flex;
  flex-basis: 60%;
  height: 64px;
  margin-top: 40px;
  flex-grow: 0;
  flex-shrink: 0;
`;

const StyledHeaderRightSection = styled.div`
  display: flex;
  flex-basis: 20%;
  flex-grow: 0;
  flex-shrink: 0;
  justify-content: right;
  align-items: flex-end;
`;
