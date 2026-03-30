import axios from './instance';
import Cookies from 'js-cookie';

// Base URL backend
const baseUrl = import.meta.env.VITE_APP_BACKEND_BASE_URL || "http://localhost:8096";

// Get user's conversation list
export const getConversations = (userId) =>
  axios.get(`${baseUrl}/history/${userId}`);

// Create new conversation
export const createConversation = (userId, name) => {
  return axios.post(`${baseUrl}/conversations`, {
    user_id: userId || 1,
    name: name || "New Chat"
  });
};

// Send new message with streaming support
export const sendMessageStream = async (requestData, onChunk, onComplete, onError) => {
  try {
    const response = await fetch(
      `${baseUrl}/chat/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Cookies.get('token') || ''}`
        },
        body: JSON.stringify(requestData)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onComplete();
        break;
      }

      const chunk = decoder.decode(value);
      buffer += chunk;
      const lines = buffer.split('\n');

      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);

            if (jsonStr.trim()) {
              const data = JSON.parse(jsonStr);
              onChunk(data);
            }

          } catch (e) {
            console.error('JSON parse error for line:', line);

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

// Rename conversation
export const renameConversation = (userId, conversationId, name) =>
  axios.put(`${baseUrl}/conversations/${conversationId}`, { user_id: userId, name });

// Upload document to Qdrant
export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return response.json();
};

// Get collection stats
export const getUploadStats = () =>
  fetch(`${baseUrl}/upload/stats`).then(r => r.json());

// Sync user from auth_db to vchatbot
export const syncUser = async (userId, username, firstName = null, lastName = null, departmentId = null, positionId = 1) => {
  return axios.post(`${baseUrl}/sync-user`, null, {
    params: {
      user_id: userId,
      username: username,
      first_name: firstName,
      last_name: lastName,
      department_id: departmentId,
      position_id: positionId
    }
  });
};

// Save named image to BE
export const saveImage = (name, base64Data, mediaType) =>
  axios.post(`${baseUrl}/save-image`, { base64: base64Data, media_type: mediaType }, { params: { name } });

// Get URL of a saved image by name
export const getImageUrl = (name) => {
  const safeName = name.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${baseUrl}/image/${encodeURIComponent(safeName)}`;
};

// Get list of all saved champion image names from server
export const getSavedImages = () =>
  fetch(`${baseUrl}/saved-images`).then(r => r.json());

export const getUsageStats = (userId = null, days = 30) => {
  const params = new URLSearchParams({ days });
  if (userId) params.append('user_id', userId);
  return fetch(`${baseUrl}/report/usage?${params}`).then(r => r.json());
};

export const getAdminFeedbackReport = (days = 30) => {
  const params = new URLSearchParams({ days });
  return fetch(`${baseUrl}/report/admin/feedback?${params}`).then(r => r.json());
};

// Update last bot message content and sources
export const updateLastBotMessage = (conversationId, content, sources = null) => {
  const body = { content };
  if (sources) body.sources = sources;
  return axios.patch(`${baseUrl}/messages/${conversationId}/last-bot`, body);
};

// Submit thumbs-up or thumbs-down feedback for a bot message
export const submitFeedback = (messageId, userId, feedback) =>
  axios.post(`${baseUrl}/messages/${messageId}/feedback`, { user_id: userId || null, feedback });

// Get feedback stats for multiple messages
export const getBatchFeedback = (messageIds, userId = null) =>
  axios.post(`${baseUrl}/messages/feedback/batch`, { message_ids: messageIds, user_id: userId || null });