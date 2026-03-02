# AI Key Gateway

一个支持多子 Key 管理的 AI API 转发服务，支持 MiniMax、DeepSeek、GLM、Kimi 等主流 AI 提供商。

## 功能特性

### 核心功能
- **子 Key 管理**：创建、列出、撤销子 Key，每个子 Key 独立使用
- **独立会话**：每个子 Key 拥有独立的对话上下文，互不干扰
- **调用日志**：完整的请求链路日志，方便排查问题
- **多 Provider 支持**：支持 MiniMax、DeepSeek、GLM、Kimi

### API 兼容
- OpenAI 兼容接口 (`/v1/chat/completions`, `/v1/embeddings`)
- Anthropic 兼容接口 (`/v1/messages`)
- 支持流式响应

## 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 启动服务

```bash
# 首次启动会进入交互式配置
npm start

# 或使用命令
node dist/index.js start
```

### 配置 Provider

```bash
# 设置 Provider（交互式）
node dist/index.js config provider

# 示例输出：
# 请选择 AI 提供商:
#   1) minimax
#   2) deepseek
#   3) glm
#   4) kimi
```

## 使用方法

### 子 Key 管理

```bash
# 进入子 Key 管理菜单
node dist/index.js config subkeys

# 可选操作:
# 1) create     - 创建新的子 Key
# 2) list       - 列出所有子 Key
# 3) revoke     - 失效指定子 Key
# 4) revoke-all - 失效所有子 Key
```

### 使用子 Key 调用 API

在客户端（如 Cherry Studio）中配置：

```
API 地址: http://localhost:3600/v1/chat/completions
API Key:  your-sub-key (如 sk_xxx)
模型:     MiniMax-M2.5 (或 your-configured-model)
```

## API 接口

### Chat Completions

```bash
curl -X POST http://localhost:3600/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUB_KEY" \
  -d '{
    "model": "MiniMax-M2.5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 流式响应

```bash
curl -X POST http://localhost:3600/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUB_KEY" \
  -d '{
    "model": "MiniMax-M2.5",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### Embeddings

```bash
curl -X POST http://localhost:3600/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUB_KEY" \
  -d '{
    "model": "embedding-2",
    "input": "Hello world"
  }'
```

### Anthropic 兼容接口

```bash
curl -X POST http://localhost:3600/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUB_KEY" \
  -d '{
    "model": "MiniMax-M2.5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1024
  }'
```

## 配置说明

### 配置文件

首次启动后，会在当前目录生成 `ai-key-gateway.config.json`：

```json
{
  "port": 3600,
  "provider": {
    "type": "minimax",
    "apiKey": "your-api-key"
  },
  "model": "MiniMax-M2.5"
}
```

### 子 Key 存储

子 Key 存储在 `ai-key-gateway.subkeys.json`：

```json
[
  {
    "id": "subkey_xxx",
    "key": "sk_xxx",
    "status": "active",
    "description": "描述信息",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

> ⚠️ 这两个配置文件包含敏感信息，已在 `.gitignore` 中排除，请勿提交到版本控制

## 模块结构

```
src/
├── cli.ts              # CLI 命令行工具
├── index.ts           # 入口文件
├── logger.ts          # 调用链路日志模块
├── config/            # 配置管理
│   └── index.ts
├── providers/         # AI Provider 实现
│   ├── index.ts      # Provider 接口定义
│   ├── factory.ts    # Provider 工厂
│   ├── minimax.ts    # MiniMax 实现
│   ├── deepseek.ts   # DeepSeek 实现
│   ├── glm.ts        # GLM 实现
│   └── kimi.ts       # Kimi 实现
├── server/           # HTTP 服务
│   └── index.ts      # Express 服务
└── storage/          # 存储模块
    ├── index.ts      # 存储接口
    ├── subkey.ts     # 子 Key 存储
    └── session.ts    # 会话存储
```

## 调用链路日志

每次 API 请求都会输出完整的调用链路日志，便于排查问题：

```json
{"timestamp":"2026-03-02T06:16:28.037Z","requestId":"1f50eeb9","stage":"AUTH_START"}
{"timestamp":"2026-03-02T06:16:28.038Z","requestId":"1f50eeb9","stage":"AUTH_SUCCESS","subKeyId":"subkey_xxx","details":"subKey prefix: sk_xxx"}
{"timestamp":"2026-03-02T06:16:28.038Z","requestId":"1f50eeb9","stage":"REQUEST_RECEIVED","model":"MiniMax-M2.5","details":"POST /v1/chat/completions"}
{"timestamp":"2026-03-02T06:16:28.038Z","requestId":"1f50eeb9","stage":"PROVIDER_REQUEST","model":"MiniMax-M2.5","details":"provider: minimax, messages: 1"}
{"timestamp":"2026-03-02T06:16:29.638Z","requestId":"1f50eeb9","stage":"PROVIDER_RESPONSE","status":200,"duration":1600}
{"timestamp":"2026-03-02T06:16:29.638Z","requestId":"1f50eeb9","stage":"RESPONSE_SENT","status":200,"duration":1600}
```

日志阶段说明：
- `AUTH_START` - 开始认证
- `AUTH_SUCCESS` / `AUTH_FAILED` - 认证成功/失败
- `REQUEST_RECEIVED` - 收到客户端请求
- `PROVIDER_REQUEST` - 转发请求到上游 Provider
- `PROVIDER_RESPONSE` / `PROVIDER_ERROR` - 收到响应/错误
- `RESPONSE_SENT` - 响应发送给客户端

## 常见问题

### 1. 客户端连接显示"检测通过但无返回"

检查调用链路日志，确认请求在各阶段的状态：
- 如果 `AUTH_FAILED` → 检查子 Key 是否正确
- 如果 `PROVIDER_RESPONSE` 有响应但客户端无返回 → 检查是否为流式响应兼容问题

### 2. 不同子 Key 之间会话是否独立

是的，每个子 Key 拥有独立的对话上下文，会话历史不会相互干扰。

### 3. 如何查看/清除会话

当前版本可通过重启服务清除所有会话。后续版本会支持 CLI 命令管理。

## 开发相关

### 命令行参数

```bash
# 启动服务
node dist/index.js start

# 配置
node dist/index.js config

# 配置 Provider
node dist/index.js config provider

# 配置端口
node dist/index.js config port

# 子 Key 管理
node dist/index.js config subkeys

# 交互式帮助
node dist/index.js help
```

### 构建

```bash
npm run build    # 构建 TypeScript
npm start        # 构建并启动
npm run dev      # 开发模式 (需 ts-node)
```

## License

MIT
