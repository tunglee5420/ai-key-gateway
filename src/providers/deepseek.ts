import axios from 'axios';
import { AIProvider, ChatRequest, ChatResponse, EmbeddingsRequest, EmbeddingsResponse, ProviderType } from './index';

export class DeepseekProvider implements AIProvider {
  type: ProviderType = 'deepseek';
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async streamChat(request: ChatRequest): Promise<ReadableStream> {
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    return new ReadableStream({
      start(controller) {
        const reader = response.data;
        reader.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk);
        });
        reader.on('end', () => {
          controller.close();
        });
        reader.on('error', (err: Error) => {
          controller.error(err);
        });
      }
    });
  }

  async embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    const response = await axios.post(
      `${this.baseUrl}/embeddings`,
      {
        model: request.model,
        input: request.input
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }
}
