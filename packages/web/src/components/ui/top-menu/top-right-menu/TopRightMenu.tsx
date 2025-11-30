import { TopRightMenuContent } from './content/TopRightMenuContent.tsx';
import { TopRightMenuPanel } from './pannel/TopRightMenuPanel.tsx';

export function TopRightMenu({
  buttons,
  content,
}: {
  buttons?: React.ReactNode[];
  content?: React.ReactNode;
}) {
  return (
    <TopRightMenuPanel>
      <TopRightMenuContent buttons={buttons} content={content} />
    </TopRightMenuPanel>
  );
}
