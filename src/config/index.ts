import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';

export interface AIProvider {
  type: 'glm' | 'deepseek' | 'minimax' | 'kimi';
  apiKey: string;
}

export interface Config {
  port: number;
  provider?: AIProvider;
  model?: string;
}

const DEFAULT_CONFIG: Config = {
  port: 3600
};

const CONFIG_FILE = path.join(process.cwd(), 'ai-key-gateway.config.json');

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: Config): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function interactiveSetup(): Promise<Config> {
  const config = loadConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    AI Key Gateway 配置向导             ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Set API Key (master key for AI requests)
  if (!config.provider || !config.provider.apiKey) {
    console.log('【1/3】设置 API Key (主 Key)');
    console.log('  1) glm      - 智谱 AI');
    console.log('  2) deepseek - Deepseek');
    console.log('  3) minimax  - MiniMax');
    console.log('  4) kimi     - 月之暗面 (KIMI)');

    const choice = await askQuestion('  请选择 AI 厂商 (1-4): ');

    const providers: Record<string, { type: AIProvider['type'], name: string }> = {
      '1': { type: 'glm', name: '智谱 AI (GLM)' },
      '2': { type: 'deepseek', name: 'Deepseek' },
      '3': { type: 'minimax', name: 'MiniMax' },
      '4': { type: 'kimi', name: '月之暗面 (KIMI)' }
    };

    const selected = providers[choice];
    if (!selected) {
      console.log('  ✗ 无效选择\n');
      process.exit(1);
    }

    console.log(`  已选择: ${selected.name}`);

    const apiKey = await askQuestion('\n  请输入 API Key: ');
    if (!apiKey) {
      console.log('  ✗ API Key 不能为空\n');
      process.exit(1);
    }

    config.provider = {
      type: selected.type,
      apiKey
    };
    console.log('  ✓ API Key 已设置\n');
  }

  // Set model (optional, after API Key is configured)
  console.log('【2/3】设置默认模型 (可选)');
  console.log('  常用模型:');

  const providerModels: Record<string, string[]> = {
    glm: ['glm-4-flash-2', 'glm-4-plus', 'glm-4'],
    deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-math'],
    minimax: ['MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1'],
    kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
  };

  const models = providerModels[config.provider?.type || 'minimax'];
  models.forEach((m, i) => console.log(`    ${i + 1}) ${m}`));

  console.log('  直接回车可跳过，稍后可使用 set-model 命令配置');

  const modelChoice = await askQuestion('\n  请选择模型 (输入编号或直接输入模型名，直接回车跳过): ');

  if (modelChoice) {
    const modelNumber = parseInt(modelChoice, 10);
    if (!isNaN(modelNumber) && modelNumber > 0 && modelNumber <= models.length) {
      config.model = models[modelNumber - 1];
    } else {
      config.model = modelChoice;
    }
    console.log(`  ✓ 默认模型: ${config.model}\n`);
  } else {
    console.log('  ↩ 已跳过\n');
  }

  // Save config
  saveConfig(config);

  rl.close();
  return config;
}
