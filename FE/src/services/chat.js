import axios from './instance';

const baseUrl = '/ai-service'

// Get user's conversation list
export const getConversations = (userId) =>
  axios.get(`${baseUrl}/history/${userId}`);

// Create new conversation
export const createConversation = (userId, name) =>
  axios.post(`${baseUrl}/history/conversations`, { user_id: userId, name });

// Send new message with streaming support
export const sendMessageStream = async (requestData, onChunk, onComplete, onError) => {
  try {
    const response = await fetch(import.meta.env.VITE_APP_BACKEND_BASE_URL + `${baseUrl}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; // Buffer for incomplete chunks

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onComplete();
        break;
      }

      const chunk = decoder.decode(value);
      buffer += chunk;
      const lines = buffer.split('\n');
      
      // Keep the last line in buffer if it's incomplete
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr.trim()) { // Only parse non-empty strings
              const data = JSON.parse(jsonStr);
              onChunk(data);
            }
          } catch (e) {
            // Log parsing errors for debugging
            console.error('JSON parse error for line:', line);

            // Still try to call onChunk with error info for debugging
            onChunk({
              type: 'parse_error',
              error: e.message,
              raw_line: line.slice(6)
            });
          }
        }
      }
    }
  } catch (error) {
    onError(error);
  }
};

// Get messages of a conversation
export const getMessages = (conversationId) =>
  axios.get(`${baseUrl}/history/conversations/${conversationId}`);

// Delete conversation
export const deleteConversation = (userId, conversationId) =>
  axios.delete(`${baseUrl}/history/${userId}/${conversationId}`); 