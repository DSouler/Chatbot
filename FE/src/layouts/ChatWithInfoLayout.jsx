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
  currentConversationId = null
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        background: '#f9fafb',
      }}
    >
      <div
        style={{
          flexGrow: 1,
          padding: 24,
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
