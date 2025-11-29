import { Flex } from '@radix-ui/themes';
import styled from 'styled-components';

interface IconButtonProps {
  backgroundColor?: string;
  hoverColor?: string;
  solidSelected?: boolean;
  solidColor?: string;
  invertIcon?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function IconButton({
  backgroundColor = '#000000',
  hoverColor = '#ffffff',
  solidSelected = false,
  solidColor = '#ffffff',
  invertIcon = false,
  children,
  onClick,
  className = '',
}: IconButtonProps) {
  return (
    <StyledIconButton
      className={className}
      backgroundColor={backgroundColor}
      hoverColor={hoverColor}
      solidSelected={solidSelected}
      solidColor={solidColor}
      invertIcon={invertIcon}
      onClick={onClick}
    >
      {children}
    </StyledIconButton>
  );
}

const StyledIconButton = styled(Flex)<{
  backgroundColor?: string;
  hoverColor?: string;
  solidSelected?: boolean;
  solidColor?: string;
  invertIcon?: boolean;
}>`
  padding: 10px;
  border-radius: 8px;
  display: flex;
  cursor: pointer;
  ${(props) =>
    props.solidSelected
      ? `background-color: ${props.solidColor || '#ffffff'};`
      : `background-color: ${props.backgroundColor || '#000000'};`}
  ${(props) =>
    props.solidSelected
      ? `
  [data-icon] {
    filter: invert(100%);
  }
  `
      : ``}
  &:hover {
    background-color: ${(props) => props.hoverColor || '#ffffff'};

    [data-icon] {
      filter: ${(props) => (props.invertIcon ? 'invert(100%)' : 'none')};
    }
  }
`;

export default IconButton;
