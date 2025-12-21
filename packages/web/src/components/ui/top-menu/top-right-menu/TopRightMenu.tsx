import { TopRightMenuContent } from './content/TopRightMenuContent';
import { TopRightMenuPanel } from './pannel/TopRightMenuPanel';

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
