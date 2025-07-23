// Default configuration for chat
export const DEFAULT_CHAT_CONFIG = {
  // LLM configuration
  llm: {
    model: "Qwen/Qwen3-14B-AWQ",
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
        model: parsed.model || "Qwen/Qwen3-14B-AWQ",
        temperature: parsed.temperature || 0.7,
      };
    }
  } catch (error) {
    console.error('Error loading LLM config:', error);
  }
  
  return {
    model: "Qwen/Qwen3-14B-AWQ",
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

// Create request data from configuration
export const createRequestData = (question, conversationId, userId, chatHistory, config = DEFAULT_CHAT_CONFIG) => {
  return {
    question,
    conversation_id: conversationId,
    created_by: userId,
    chat_history: chatHistory,
    mode: "RAG", // hoặc "RAG" tùy config
    reasoning_settings: {
      language: config.reasoning.language,
      framework: config.reasoning.framework,
      llm: config.llm
    }
  };
}; 