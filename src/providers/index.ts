export type ProviderType = 'glm' | 'deepseek' | 'minimax' | 'kimi';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingsRequest {
  model: string;
  input: string | string[];
}

export interface EmbeddingsResponse {
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface AIProvider {
  type: ProviderType;

  // Chat completion
  chat(request: ChatRequest): Promise<ChatResponse>;

  // Stream chat completion
  streamChat(request: ChatRequest): Promise<ReadableStream>;

  // Embeddings
  embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse>;
}

export { GLMProvider } from './glm';
export { DeepseekProvider } from './deepseek';
export { MinimaxProvider } from './minimax';
export { KIMIProvider } from './kimi';
