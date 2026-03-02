import { Command } from 'commander';
import { loadConfig, saveConfig, Config, AIProvider, getConfigPath, interactiveSetup } from './config';
import { createSubKeyStorage } from './storage';

// PID file for auto-restart
const PID_FILE = process.cwd() + '/.ai-key-gateway.pid';

function getPid(): number | null {
  try {
    const pid = parseInt(require('fs').readFileSync(PID_FILE, 'utf-8').trim());
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function savePid(pid: number): void {
  require('fs').writeFileSync(PID_FILE, pid.toString());
}

function removePid(): void {
  try {
    require('fs').unlinkSync(PID_FILE);
  } catch {}
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function restartServer(): void {
  console.log('\n  正在重启服务...\n');

  setTimeout(() => {
    const { spawn } = require('child_process');
    const child = spawn(
      process.execPath,
      [require('path').join(process.cwd(), 'dist/index.js'), 'start'],
      {
        detached: true,
        stdio: 'ignore',
        cwd: process.cwd()
      }
    );

    child.unref();
    savePid(child.pid);

    setTimeout(() => {
      // 读取配置并显示状态
      const config = loadConfig();
      const storage = createSubKeyStorage();

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║         服务已重启                      ║');
      console.log('╚══════════════════════════════════════════╝');
      console.log(`  端口:    ${config.port}`);
      console.log(`  厂商:    ${config.provider?.type || '未设置'}`);
      console.log(`  模型:    ${config.model || '默认'}`);
      console.log(`  子 Keys: ${storage.list().length} 个`);
      console.log('\n  API 端点:');
      console.log(`    OpenAI:   POST http://localhost:${config.port}/v1/chat/completions`);
      console.log(`    Anthropic: POST http://localhost:${config.port}/v1/messages`);
      console.log('');
      process.exit(0);
    }, 1500);
  }, 500);
}

// 通用输入处理函数
function prompt(question: string, options?: {
  valid?: string[],      // 有效选项，如 ['1','2','3','b','s']
  required?: boolean,    // 是否必填（空值时是否退出）
  default?: string,      // 默认值
  validate?: (value: string) => boolean, // 自定义验证
}): Promise<{ value: string, action: 'submit' | 'back' | 'skip' }> {
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // 构建提示文本
    let promptText = question;
    if (options?.valid && options.valid.length > 0) {
      promptText += ` (${options.valid.join('/')})`;
    }
    if (options?.default) {
      promptText += ` [${options.default}]`;
    }
    promptText += ': ';

    rl.question(promptText, (answer: string) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();

      // 处理返回和跳过
      if (trimmed === 'b') {
        resolve({ value: '', action: 'back' });
        return;
      }
      if (trimmed === 's') {
        resolve({ value: '', action: 'skip' });
        return;
      }

      // 空值处理
      if (!trimmed) {
        if (options?.default !== undefined) {
          resolve({ value: options.default, action: 'submit' });
          return;
        }
        if (options?.required === false) {
          resolve({ value: '', action: 'skip' });
          return;
        }
        // 必填但为空，提示重试
        console.log('  ✗ 输入不能为空，请重试\n');
        resolve({ value: '__RETRY__', action: 'submit' });
        return;
      }

      // 验证选项
      if (options?.valid && options.valid.length > 0) {
        if (!options.valid.includes(trimmed)) {
          console.log(`  ✗ 无效选择，有效选项: ${options.valid.join(', ')}\n`);
          resolve({ value: '__RETRY__', action: 'submit' });
          return;
        }
      }

      // 自定义验证
      if (options?.validate && !options.validate(trimmed)) {
        console.log('  ✗ 输入无效，请重试\n');
        resolve({ value: '__RETRY__', action: 'submit' });
        return;
      }

      resolve({ value: trimmed, action: 'submit' });
    });
  });
}

// 带重试的输入循环
async function promptLoop(question: string, options?: {
  valid?: string[],
  required?: boolean,
  default?: string,
  validate?: (value: string) => boolean,
}): Promise<{ value: string, action: 'back' | 'skip' | 'submit' }> {
  while (true) {
    const result = await prompt(question, options);

    if (result.value === '__RETRY__') {
      continue;
    }

    if (result.action === 'back') {
      return { value: '', action: 'back' };
    }

    if (result.action === 'skip') {
      return { value: '', action: 'skip' };
    }

    return { value: result.value, action: 'submit' };
  }
}

// 重新运行 config 命令
function rerunConfig(): void {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, [require('path').join(process.cwd(), 'dist/index.js'), 'config'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  child.on('close', () => process.exit(0));
}

// 带参数的 config 子命令
function rerunConfigCmd(...args: string[]): void {
  const { spawn } = require('child_process');
  const child = spawn(
    process.execPath,
    [require('path').join(process.cwd(), 'dist/index.js'), 'config', ...args],
    { cwd: process.cwd(), stdio: 'inherit' }
  );
  child.on('close', () => process.exit(0));
}

export function createCLI() {
  const program = new Command();

  program
    .name('ai-key-gateway')
    .description('AI Key Gateway - 本地部署的 AI Key 管理与请求转发服务')
    .version('1.0.0');

  // config command
  const configCmd = program
    .command('config')
    .description('配置管理')
    .allowUnknownOption();

  // config list
  configCmd
    .command('list')
    .description('查看当前配置')
    .action(() => {
      const config = loadConfig();
      console.log('\n=== 当前配置 ===');
      console.log(`  配置文件: ${getConfigPath()}`);
      console.log(`  端口:     ${config.port}`);
      console.log(`  AI 厂商:  ${config.provider?.type || '✗ 未设置'}`);
      console.log(`  默认模型: ${config.model || '✗ 未设置'}`);
      if (config.provider) {
        const maskedKey = config.provider.apiKey.substring(0, 4) + '****' + config.provider.apiKey.substring(config.provider.apiKey.length - 4);
        console.log(`  API Key:  ${maskedKey}`);
      }

      const storage = createSubKeyStorage();
      const subKeys = storage.list();
      console.log(`  子 Keys:  ${subKeys.length} 个`);
      console.log('');
    });

  // config provider
  configCmd
    .command('provider')
    .description('设置 AI 厂商')
    .action(async () => {
      const config = loadConfig();
      const currentProvider = config.provider?.type;
      const currentApiKey = config.provider?.apiKey;

      console.log('\n=== 配置 AI 厂商 ===');
      console.log('  1) glm      - 智谱 AI');
      console.log('  2) deepseek - Deepseek');
      console.log('  3) minimax  - MiniMax');
      console.log('  4) kimi     - 月之暗面 (KIMI)');
      if (currentProvider) {
        console.log(`\n  当前: ${currentProvider}`);
      }
      console.log('  b) 返回  s) 跳过  e) 退出\n');

      const result = await promptLoop('  请选择', { valid: ['1', '2', '3', '4', 'b', 's', 'e'] });

      if (result.action === 'back') {
        console.log('  ↩ 已返回\n');
        rerunConfig();
        return;
      }
      if (result.action === 'skip') {
        console.log('  ↩ 已跳过\n');
        return;
      }
      if (result.value === 'e') {
        console.log('  再见!\n');
        process.exit(0);
      }

      const providers: Record<string, { type: AIProvider['type'], name: string }> = {
        '1': { type: 'glm', name: '智谱 AI (GLM)' },
        '2': { type: 'deepseek', name: 'Deepseek' },
        '3': { type: 'minimax', name: 'MiniMax' },
        '4': { type: 'kimi', name: '月之暗面 (KIMI)' }
      };

      const selected = providers[result.value];
      const isSameAsCurrent = currentProvider === selected.type;

      // 如果已配置，询问操作
      if (isSameAsCurrent && currentApiKey) {
        console.log(`  ✓ 已选择: ${selected.name} (当前设置)\n`);
        console.log('  1) 继续    - 保留当前设置');
        console.log('  2) 修改    - 重新设置 API Key');
        console.log('  3) 改模型  - 修改默认模型');
        console.log('  0) 返回\n');

        const subResult = await promptLoop('  请选择', { valid: ['0', '1', '2', '3', 'e'] });

        if (subResult.action === 'back' || subResult.value === '0') {
          console.log('  ↩ 已返回\n');
          rerunConfig();
          return;
        }
        if (subResult.value === 'e') {
          console.log('  再见!\n');
          process.exit(0);
        }

        if (subResult.value === '1') {
          console.log('  ✓ 保留当前设置\n');
          return;
        }

        if (subResult.value === '2') {
          // 修改 API Key
          console.log('\n  请输入新的 API Key (输入 b 返回, s 跳过):\n');
          const keyResult = await promptLoop('  API Key', { required: false });

          if (keyResult.action === 'back') {
            console.log('  ↩ 已返回\n');
            rerunConfig();
            return;
          }
          if (keyResult.action === 'skip' || !keyResult.value) {
            console.log('  ↩ 已跳过\n');
            return;
          }

          config.provider = { type: selected.type, apiKey: keyResult.value };
          saveConfig(config);
          console.log('  ✓ API Key 已更新\n');
          restartServer();
          return;
        }

        if (subResult.value === '3') {
          // 修改模型
          await promptForModel(config, selected.type);
          return;
        }
      }

      // 新选择厂商，输入 API Key
      console.log(`  已选择: ${selected.name}\n`);
      console.log('  请输入 API Key (输入 b 返回, s 跳过)\n');

      const apiKeyResult = await promptLoop('  API Key', { required: false });

      if (apiKeyResult.action === 'back') {
        console.log('  ↩ 已返回\n');
        rerunConfig();
        return;
      }
      if (apiKeyResult.action === 'skip' || !apiKeyResult.value) {
        console.log('  ↩ 已跳过\n');
        return;
      }

      config.provider = { type: selected.type, apiKey: apiKeyResult.value };
      saveConfig(config);
      console.log(`  ✓ 厂商已设置: ${selected.name}\n`);

      // 继续设置模型
      await promptForModel(config, selected.type);
    });

  // config models
  configCmd
    .command('models')
    .description('设置默认模型')
    .action(async () => {
      const config = loadConfig();
      const providerType = config.provider?.type || 'glm';

      const providerModels: Record<string, string[]> = {
        glm: ['glm-4-flash-2', 'glm-4-plus', 'glm-4'],
        deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-math'],
        minimax: ['MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1'],
        kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
      };

      const models = providerModels[providerType] || [];

      console.log(`\n=== 配置模型 (当前厂商: ${providerType}) ===`);
      if (config.model) console.log(`  当前模型: ${config.model}`);
      if (models.length > 0) {
        console.log('  常用模型:');
        models.forEach((m, i) => console.log(`    ${i + 1}) ${m}`));
      }
      console.log('  或直接输入自定义模型名');
      console.log('  b) 返回  s) 跳过  e) 退出\n');

      const result = await promptLoop('  请输入模型名称', { required: false });

      if (result.action === 'back') {
        console.log('  ↩ 已返回\n');
        rerunConfig();
        return;
      }
      // Check for exit
      if (result.value === 'e') {
        console.log('  再见!\n');
        process.exit(0);
      }

      const modelNum = parseInt(result.value, 10);
      if (!isNaN(modelNum) && modelNum > 0 && modelNum <= models.length) {
        config.model = models[modelNum - 1];
      } else {
        config.model = result.value;
      }

      saveConfig(config);
      console.log(`  ✓ 默认模型已设置为: ${config.model}\n`);
      restartServer();
    });

  // 辅助函数：设置模型
  async function promptForModel(config: Config, providerType: string): Promise<void> {
    const providerModels: Record<string, string[]> = {
      glm: ['glm-4-flash-2', 'glm-4-plus', 'glm-4'],
      deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-math'],
      minimax: ['MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1'],
      kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
    };

    const models = providerModels[providerType] || [];

    console.log('\n=== 设置默认模型 ===');
    console.log(`  当前厂商: ${providerType}`);
    if (config.model) console.log(`  当前模型: ${config.model}`);
    if (models.length > 0) {
      console.log('  常用模型:');
      models.forEach((m, i) => console.log(`    ${i + 1}) ${m}`));
    }
    console.log('  或直接输入自定义模型名');
    console.log('  b) 返回  s) 跳过\n');

    const result = await promptLoop('  请输入模型名称', { required: false });

    if (result.action === 'back') {
      console.log('  ↩ 已返回\n');
      rerunConfig();
      return;
    }
    if (result.action === 'skip' || !result.value) {
      console.log('  ↩ 已跳过\n');
      restartServer();
      return;
    }

    const modelNum = parseInt(result.value, 10);
    if (!isNaN(modelNum) && modelNum > 0 && modelNum <= models.length) {
      config.model = models[modelNum - 1];
    } else {
      config.model = result.value;
    }

    saveConfig(config);
    console.log(`  ✓ 默认模型已设置为: ${config.model}\n`);
    restartServer();
  }

  // config subkeys
  const subkeyCmd = configCmd
    .command('subkeys')
    .description('子 Key 管理')
    .action(async () => {
      const storage = createSubKeyStorage();
      const subKeys = storage.list();

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║       子 Key 管理                    ║');
      console.log('╚══════════════════════════════════════════╝\n');
      console.log(`  当前子 Keys: ${subKeys.length} 个\n`);
      console.log('  1) create     - 创建新的子 Key');
      console.log('  2) list       - 列出所有子 Key');
      console.log('  3) revoke     - 失效指定子 Key');
      console.log('  4) revoke-all - 失效所有子 Key');
      console.log('  0) 返回       e) 退出\n');

      const result = await promptLoop('  请选择', { valid: ['0', '1', '2', '3', '4', 'e'] });

      if (result.action === 'back' || result.value === '0') {
        console.log('  ↩ 已返回\n');
        rerunConfig();
        return;
      }
      if (result.value === 'e') {
        console.log('  再见!\n');
        process.exit(0);
      }

      if (result.value === '1') {
        // create
        const storage = createSubKeyStorage();
        const subKey = storage.create({ description: '新建子 Key' });

        console.log('\n=== 子 Key 已创建 ===');
        console.log(`  Key: ${subKey.key}`);
        console.log(`  ID:  ${subKey.id}`);
        console.log('');
        // 返回子菜单
        rerunConfigCmd('subkeys');
        return;
      }

      if (result.value === '2') {
        // list
        const storage = createSubKeyStorage();
        const subKeys = storage.list();

        console.log('\n=== 子 Key 列表 ===');
        if (subKeys.length === 0) {
          console.log('  (无)');
        } else {
          for (const sk of subKeys) {
            const status = sk.status === 'active' ? '✓' : '✗';
            console.log(`  ${status} ${sk.key}`);
            console.log(`      ID: ${sk.id}`);
            console.log(`      状态: ${sk.status}`);
            if (sk.description) console.log(`      描述: ${sk.description}`);
            console.log(`      创建: ${sk.createdAt.toLocaleString()}`);
            console.log('');
          }
        }
        console.log(`  共 ${subKeys.length} 个子 Key\n`);
        // 返回子菜单
        rerunConfigCmd('subkeys');
        return;
      }

      if (result.value === '3') {
        // revoke
        console.log('\n  请输入要失效的子 Key 或 ID (输入 b 返回):\n');
        const keyResult = await promptLoop('  子 Key', { required: false });

        if (keyResult.action === 'back') {
          console.log('  ↩ 已返回\n');
          rerunConfigCmd('subkeys');
          return;
        }

        const storage = createSubKeyStorage();
        let subKey = storage.findByKey(keyResult.value);
        if (!subKey) {
          subKey = storage.findById(keyResult.value);
        }

        if (!subKey) {
          console.log(`  ✗ 未找到子 Key\n`);
          rerunConfigCmd('subkeys');
          return;
        }

        storage.revoke(subKey.id);
        console.log(`  ✓ 子 Key 已失效: ${subKey.key}\n`);
        // 返回子菜单
        rerunConfigCmd('subkeys');
        return;
      }

      if (result.value === '4') {
        // revoke-all
        const storage = createSubKeyStorage();
        const count = storage.revokeAll();
        console.log(`  ✓ 已失效 ${count} 个子 Key\n`);
        // 返回子菜单
        rerunConfigCmd('subkeys');
        return;
      }
    });

  // config port
  configCmd
    .command('port')
    .description('设置服务端口')
    .action(async () => {
      const config = loadConfig();

      console.log(`\n  当前端口: ${config.port}`);
      console.log('  b) 返回  s) 跳过  e) 退出\n');

      const result = await promptLoop('  请输入端口号', {
        default: config.port.toString(),
        validate: (v) => {
          const n = parseInt(v, 10);
          return !isNaN(n) && n > 0 && n <= 65535;
        }
      });

      if (result.action === 'back') {
        console.log('  ↩ 已返回\n');
        rerunConfig();
        return;
      }
      if (result.action === 'skip') {
        console.log('  ↩ 已跳过\n');
        return;
      }
      if (result.value === 'e') {
        console.log('  再见!\n');
        process.exit(0);
      }

      const portNum = parseInt(result.value, 10);
      config.port = portNum;
      saveConfig(config);
      console.log(`  ✓ 端口已设置为: ${portNum}\n`);
      restartServer();
    });

  // config setup
  configCmd
    .command('setup')
    .description('交互式配置向导')
    .action(async () => {
      await interactiveSetup();
      restartServer();
    });

  // config 默认菜单
  configCmd.action(async () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║    AI Key Gateway 配置菜单             ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('  1) provider  - 设置 AI 厂商和 API Key');
    console.log('  2) models    - 设置默认模型');
    console.log('  3) subkeys   - 子 Key 管理');
    console.log('  4) port      - 设置服务端口');
    console.log('  5) setup     - 交互式配置向导');
    console.log('  6) list      - 查看当前配置');
    console.log('  0) 退出\n');

    const result = await promptLoop('  请选择', { valid: ['0', '1', '2', '3', '4', '5', '6', 'e'] });

    if (result.value === '0' || result.value === 'e' || result.action === 'back') {
      console.log('  再见!\n');
      process.exit(0);
    }

    const options: Record<string, string[]> = {
      '1': ['config', 'provider'],
      '2': ['config', 'models'],
      '3': ['config', 'subkeys'],
      '4': ['config', 'port'],
      '5': ['config', 'setup'],
      '6': ['config', 'list']
    };

    const cmd = options[result.value];
    if (cmd) {
      const { spawn } = require('child_process');
      const child = spawn(
        process.execPath,
        [require('path').join(process.cwd(), 'dist/index.js'), ...cmd],
        { cwd: process.cwd(), stdio: 'inherit' }
      );
      child.on('close', () => process.exit(0));
    }
  });

  // start command
  program
    .command('start')
    .description('启动服务')
    .action(async () => {
      const pid = getPid();
      if (pid && isProcessRunning(pid)) {
        console.log(`服务已在运行中 (PID: ${pid})`);
        console.log(`如需重启，请先运行: kill ${pid}`);
        process.exit(1);
      }

      savePid(process.pid);

      const { startServer } = require('./server');
      await startServer();
    });

  return program;
}
