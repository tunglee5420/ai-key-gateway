import axios from 'axios';
import { AIProvider, ChatRequest, ChatResponse, EmbeddingsRequest, EmbeddingsResponse, ProviderType } from './index';

export class MinimaxProvider implements AIProvider {
  type: ProviderType = 'minimax';
  private apiKey: string;
  private baseUrl = 'https://api.minimax.chat/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await axios.post(
      `${this.baseUrl}/text/chatcompletion_v2`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return this.convertToOpenAI(response.data);
  }

  async streamChat(request: ChatRequest): Promise<ReadableStream> {
    const response = await axios.post(
      `${this.baseUrl}/text/chatcompletion_v2`,
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
      `${this.baseUrl}/text/embeddings`,
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

    return this.convertEmbeddingsToOpenAI(response.data);
  }

  private convertToOpenAI(data: any): ChatResponse {
    return {
      id: data.id,
      model: data.model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content
        },
        finish_reason: choice.finish_reason
      })),
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens
      } : undefined
    };
  }

  private convertEmbeddingsToOpenAI(data: any): EmbeddingsResponse {
    return {
      object: 'list',
      data: data.data.map((item: any, index: number) => ({
        object: 'embedding',
        embedding: item.embedding,
        index
      })),
      model: data.model,
      usage: {
        prompt_tokens: data.usage.prompt_tokens,
        total_tokens: data.usage.total_tokens
      }
    };
  }
}
