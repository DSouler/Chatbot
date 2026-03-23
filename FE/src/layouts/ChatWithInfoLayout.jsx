import React from 'react';
import ChatArea from '../components/ChatArea';
import InformationPanel from '../components/Layouts/InformationPanel';

const ChatWithInfoLayout = ({
  messages,
  info,
  collapsedInfoPanel,
  onToggleInfoPanel,
  onSend,
  isLoading = false,
  streamingMessage = null,
  streamingThinking = null,
  activeConversationId = null,
  currentConversationId = null,
  chatMode = 'RAG',
  onModeChange = () => {},
  guestLimitReached = false,
  isGuest = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        minHeight: 0,
        width: '100%',
        background: 'transparent',
      }}
    >
      <div
        style={{
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ChatArea
          messages={messages}
          onSend={onSend}
          isLoading={isLoading}
          streamingMessage={streamingMessage}
          streamingThinking={streamingThinking}
          activeConversationId={activeConversationId}
          currentConversationId={currentConversationId}
          chatMode={chatMode}
          onModeChange={onModeChange}
          guestLimitReached={guestLimitReached}
          isGuest={isGuest}
        />
      </div>
      <InformationPanel
        info={info}
        collapsed={collapsedInfoPanel}
        onToggle={onToggleInfoPanel}
      />
    </div>
  );
};

export default ChatWithInfoLayout;
