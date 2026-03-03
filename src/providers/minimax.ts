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

    const self = this;

    return new ReadableStream({
      start(controller) {
        const reader = response.data;
        
        reader.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            
            const data = line.slice(6);
            if (data === '[DONE]') {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              // Convert MiniMax format to OpenAI format
              const converted = self.convertChunkToOpenAI(parsed);
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(converted)}\n\n`));
            } catch (e) {
              // Skip invalid JSON
            }
          }
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

  private convertChunkToOpenAI(chunk: any): any {
    // MiniMax returns content in reasoning_content, need to move to content
    const choices = chunk.choices?.map((choice: any) => {
      const delta = choice.delta || {};
      
      // If content is empty but reasoning_content exists, use reasoning_content as content
      let content = delta.content || '';
      const reasoningContent = delta.reasoning_content || '';
      
      // For MiniMax, reasoning_content is the actual text response
      if (!content && reasoningContent) {
        content = reasoningContent;
      }
      
      return {
        ...choice,
        delta: {
          ...delta,
          content: content
        }
      };
    });
    
    return {
      ...chunk,
      choices
    };
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
