import {
  Rnd,
  type RndResizeCallback,
  type RndResizeStartCallback,
} from 'react-rnd';
import styled from 'styled-components';

interface SidePanelProps {
  x: number;
  y: number;
  height: string;
  width: string;
  maxWidth: string;
  isExpanded: boolean;
  children?: React.ReactNode;
  onResizeStart?: RndResizeStartCallback;
  onResizeStop?: RndResizeCallback;
  style?: React.CSSProperties;
  ref?: React.Ref<Rnd>;
}

export function Panel({
  x,
  y,
  height,
  width,
  maxWidth,
  isExpanded,
  style = {},
  ref,
  children,
  onResizeStart,
  onResizeStop,
}: SidePanelProps) {
  if (!isExpanded) {
    return null; // Return null to render nothing when the panel is not expanded
  }

  return (
    <StyledRnd
      ref={ref}
      position={{
        x: x,
        y: y,
      }}
      size={{
        width: width,
        height: height,
      }}
      disableDragging={true}
      enableResizing={{ right: true }}
      minHeight={height}
      minWidth={width}
      maxWidth={maxWidth}
      isExpanded={isExpanded}
      expandedWidth={width}
      bounds="parent"
      style={{
        ...style,
        position: 'relative',
        display: 'flex',
      }}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
    >
      {children}
    </StyledRnd>
  );
}

const StyledRnd = styled(Rnd)<{
  isExpanded: boolean;
  expandedWidth: string;
}>`
  display: flex;
  flex: ${(props) =>
    props.isExpanded ? `0 0 ${props.expandedWidth}` : '0 0 0'};
  flex-direction: column;
  transition:
    opacity 0.2s ease-in-out,
    visibility 0.2s ease-in-out;
  opacity: ${(props) => (props.isExpanded ? 1 : 0)};
  visibility: ${(props) => (props.isExpanded ? 'visible' : 'hidden')};
  overflow: hidden;
  border: ${(props) =>
    props.isExpanded ? '1px solid #ff0000' : '0px solid #ff0000'};
  box-sizing: border-box; // Include border in the element's dimensions
`;
