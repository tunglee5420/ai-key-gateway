import express, { Request, Response, NextFunction } from 'express';
import { loadConfig, interactiveSetup } from '../config';
import { createSubKeyStorage, SubKeyStorage } from '../storage';
import { createProvider, getDefaultModel } from '../providers/factory';
import { AIProvider } from '../providers';
import { generateRequestId, createLogger, LogStage } from '../logger';

export const app = express();
export let subKeyStorage: SubKeyStorage;
export let provider: AIProvider;
export let defaultModel: string | undefined;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID middleware - generates unique ID for each request
function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = generateRequestId();
  (req as any).requestId = requestId;
  (req as any).logger = createLogger(requestId);
  next();
}

app.use(requestIdMiddleware);

// Middleware to check if provider is configured
function requireProvider(req: Request, res: Response, next: NextFunction) {
  const config = loadConfig();
  if (!config.provider) {
    return res.status(503).json({ error: 'AI provider not configured. Run: ai-key-gateway set-provider <type> <api-key>' });
  }
  if (!provider) {
    provider = createProvider(config.provider);
  }
  next();
}

// SubKey authentication middleware
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const logger = (req as any).logger;

  logger.logAuthStart();

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.logAuthFailed('Missing authorization header');
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const key = authHeader.replace('Bearer ', '');
  const subKey = subKeyStorage.findByKey(key);

  if (!subKey) {
    logger.logAuthFailed('Invalid sub-key');
    return res.status(401).json({ error: 'Invalid sub-key' });
  }

  if (subKey.status === 'revoked') {
    logger.logAuthFailed('Sub-key has been revoked');
    return res.status(401).json({ error: 'Sub-key has been revoked' });
  }

  logger.logAuthSuccess(subKey.id, subKey.key.substring(0, 8));
  (req as any).subKeyId = subKey.id;
  next();
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', provider: provider?.type });
});

// OpenAI compatible endpoints
app.post('/v1/chat/completions', requireProvider, authMiddleware, async (req: Request, res: Response) => {
  const logger = (req as any).logger;
  const startTime = Date.now();

  logger.logRequestReceived(req.method, req.path, req.body.model);

  try {
    const requestBody = { ...req.body };
    const isStream = requestBody.stream === true;

    // Use default model if not specified
    if (!requestBody.model) {
      requestBody.model = defaultModel || getDefaultModel(provider.type);
    }

    logger.logProviderRequest(provider.type, requestBody.model, requestBody.messages?.length || 0);

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const streamObj = await provider.streamChat(requestBody);
      const reader = streamObj.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        res.write(chunk);
        // Flush the response to ensure immediate delivery
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }
      res.end();

      const duration = Date.now() - startTime;
      logger.logProviderResponse(200, duration);
      logger.logResponseSent(200, duration);
    } else {
      const response = await provider.chat(requestBody);

      const duration = Date.now() - startTime;
      logger.logProviderResponse(200, duration);

      logger.logResponseSent(200, duration);
      res.json(response);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.logProviderError(error.name || 'Error', error.message, error.response?.status);
    console.error('Chat error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

app.post('/v1/embeddings', requireProvider, authMiddleware, async (req: Request, res: Response) => {
  const logger = (req as any).logger;
  const startTime = Date.now();

  logger.logRequestReceived(req.method, req.path, req.body.model);

  try {
    const requestBody = { ...req.body };

    // Use default model if not specified
    if (!requestBody.model) {
      requestBody.model = defaultModel || 'embedding-2';
    }

    logger.logProviderRequest(provider.type, requestBody.model, 0);

    const response = await provider.embeddings(requestBody);

    const duration = Date.now() - startTime;
    logger.logProviderResponse(200, duration);

    logger.logResponseSent(200, duration);
    res.json(response);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.logProviderError(error.name || 'Error', error.message, error.response?.status);
    console.error('Embeddings error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// Anthropic compatible endpoint
app.post('/v1/messages', requireProvider, authMiddleware, async (req: Request, res: Response) => {
  const logger = (req as any).logger;
  const startTime = Date.now();

  const { model: reqModel, messages } = req.body;
  const effectiveModel = reqModel || defaultModel || getDefaultModel(provider.type);

  logger.logRequestReceived(req.method, req.path, effectiveModel);

  try {
    const { model, messages, max_tokens, temperature, stream } = req.body;

    let requestMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system',
      content: m.content
    }));

    const chatRequest = {
      model: model || defaultModel || getDefaultModel(provider.type),
      messages: requestMessages,
      temperature,
      max_tokens,
      stream: stream || false
    };

    logger.logProviderRequest(provider.type, chatRequest.model, requestMessages.length || 0);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const streamObj = await provider.streamChat(chatRequest);
      const reader = streamObj.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullContent += chunk;
        res.write(chunk);
        // Flush the response to ensure immediate delivery
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }
      res.end();
    } else {
      const response = await provider.chat(chatRequest);

      // Convert back to Anthropic format
      const anthropicResponse = {
        id: response.id,
        type: 'message',
        role: 'assistant',
        content: response.choices[0]?.message.content || '',
        model: response.model,
        stop_reason: response.choices[0]?.finish_reason || 'end_turn',
        usage: {
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0
        }
      };
      res.json(anthropicResponse);
    }

    const duration = Date.now() - startTime;
    logger.logProviderResponse(200, duration);
    logger.logResponseSent(200, duration);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.logProviderError(error.name || 'Error', error.message, error.response?.status);
    console.error('Anthropic error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export async function startServer() {
  let config = loadConfig();

  // Check if provider is configured, if not run interactive setup
  if (!config.provider) {
    config = await interactiveSetup();
  }

  defaultModel = config.model;
  subKeyStorage = createSubKeyStorage();
  provider = createProvider(config.provider!);

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║     AI Key Gateway 已启动            ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`  端口:    ${config.port}`);
  console.log(`  厂商:    ${config.provider?.type}`);
  console.log(`  模型:    ${config.model || '默认'}`);
  console.log(`  子 Key:  ${subKeyStorage.list().length} 个`);
  console.log('\n  API 端点:');
  console.log(`    OpenAI:   POST http://localhost:${config.port}/v1/chat/completions`);
  console.log(`    OpenAI:   POST http://localhost:${config.port}/v1/embeddings`);
  console.log(`    Anthropic: POST http://localhost:${config.port}/v1/messages`);
  console.log('');

  // Start server
  return new Promise<void>((resolve) => {
    app.listen(config.port, () => {
      resolve();
    });
  });
}
