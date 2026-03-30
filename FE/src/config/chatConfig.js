// Default configuration for chat
export const DEFAULT_CHAT_CONFIG = {
  // LLM configuration
  llm: {
    model: "gpt-5.4-nano",
  },

  // Reasoning configuration
  reasoning: {
    language: "Vietnamese",
    framework: "simple",
  },

};

// Get LLM config from localStorage
export const getLLMConfig = () => {
  try {
    const savedConfig = localStorage.getItem('llm_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      return {
        model: parsed.model || "gpt-5.4-nano",
        temperature: parsed.temperature || 0.7,
      };
    }
  } catch (error) {
    console.error('Error loading LLM config:', error);
  }
  
  return {
    model: "gpt-5.4-nano",
    temperature: 0.7,
  };
};

// Get current chat config with LLM settings
export const getCurrentChatConfig = () => {
  const llmConfig = getLLMConfig();
  return {
    ...DEFAULT_CHAT_CONFIG,
    llm: llmConfig,
  };
};

// Available reasoning frameworks
export const REASONING_FRAMEWORKS = [
  { value: "simple", label: "Simple" },
  { value: "complex", label: "Complex" },
  { value: "react", label: "ReAct" },
  { value: "rewoo", label: "ReWOO" }
];

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Vietnamese", label: "Tiếng Việt" },
  { value: "Japanese", label: "日本語" }
];

// Retrieval modes
export const RETRIEVAL_MODES = [
  { value: "vector", label: "Vector Search" },
  { value: "hybrid", label: "Hybrid Search" },
  { value: "text", label: "Text Search" }
];

// Available chat modes
export const CHAT_MODES = [
  { value: "RAG", label: "📄 Tài liệu" },
  { value: "WEB_SEARCH", label: "🔍 Tìm web" },
];

// Create request data from configuration
export const createRequestData = (question, conversationId, userId, chatHistory, config = DEFAULT_CHAT_CONFIG, mode = "RAG", images = null) => {
  return {
    question,
    conversation_id: conversationId,
    created_by: userId,
    chat_history: chatHistory,
    mode,
    images: images && images.length > 0 ? images : null,
    retrieval_settings: {
      retrieval_mode: "vector",
      use_MMR: false,
      use_reranking: false,
      use_llm_relevant_scoring: false,
      prioritize_table: false
    },
    reasoning_settings: {
      language: config.reasoning.language,
      framework: config.reasoning.framework,
      llm: config.llm
    }
  };
}; 