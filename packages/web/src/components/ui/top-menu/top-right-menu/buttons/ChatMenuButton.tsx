import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { LayoutContext } from '@web/components/context/LayoutContext';
import IconButton from '@web/components/ui/IconButton';
import { useCallback, useContext } from 'react';

interface ChatButtonProps {
  onClick: () => void;
}

export function ChatButton({ onClick }: ChatButtonProps) {
  const { state, dispatch } = useContext(LayoutContext);

  const handleClick = useCallback(() => {
    if (state.chatHeight === state.chatStartHeight) {
      dispatch({
        type: 'UPDATE_CHAT_DIMENSIONS',
        height: state.chatMaxHeight,
        width: state.chatStartWidth,
      });
    } else {
      dispatch({
        type: 'UPDATE_CHAT_DIMENSIONS',
        height: state.chatStartHeight,
        width: state.chatStartWidth,
      });
    }
    if (state.lastChatButtonClicked === 'chat') {
      dispatch({
        type: 'SET_LAST_CHAT_BUTTON_CLICKED',
        button: '',
      });
      return;
    }
    dispatch({
      type: 'SET_LAST_CHAT_BUTTON_CLICKED',
      button: 'chat',
    });
    onClick();
  }, [dispatch, state]);

  const icon = <ChatBubbleIcon data-icon />;

  return (
    <IconButton
      invertIcon={true}
      solidSelected={state.chatStartHeight !== state.chatHeight}
      solidColor="#ffffff"
      onClick={handleClick}
    >
      {icon}
    </IconButton>
  );
}
