import { useState, useEffect } from 'react';

const LLM_CONFIG_KEY = 'llm_config';

export const useLLMConfig = () => {
  const [llmConfig, setLLMConfig] = useState({
    model: 'Qwen/Qwen3-14B-AWQ',
    temperature: 0.7,
  });

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem(LLM_CONFIG_KEY);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setLLMConfig(parsed);
      } catch (error) {
        console.error('Error parsing LLM config:', error);
      }
    }
  }, []);

  // Save config to localStorage
  const updateLLMConfig = (newConfig) => {
    const updatedConfig = { ...llmConfig, ...newConfig };
    setLLMConfig(updatedConfig);
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(updatedConfig));
  };

  return {
    llmConfig,
    updateLLMConfig,
  };
}; 