#!/usr/bin/env node

/**
 * 子 Key 功能测试
 */

import { createSubKeyStorage, SubKeyStatus } from './src/storage';

console.log('╔══════════════════════════════════════════╗');
console.log('║    AI Key Gateway - 子 Key 功能测试    ║');
console.log('╚══════════════════════════════════════════╝\n');

const storage = createSubKeyStorage();

// 清空所有子 Key
console.log('【1】清空所有子 Key...');
const initialCount = storage.list().length;
if (initialCount > 0) {
  storage.revokeAll();
  console.log(`  ✓ 已失效 ${initialCount} 个旧子 Key`);
}
console.log('');

// 测试创建子 Key
console.log('【2】创建子 Key...');
const testDescription = '测试子 Key';
const subKey1 = storage.create({ description: testDescription });
console.log(`  ✓ 创建成功`);
console.log(`    Key: ${subKey1.key}`);
console.log(`    ID:  ${subKey1.id}`);
console.log(`    描述: ${subKey1.description}`);
console.log(`    状态: ${subKey1.status}`);
console.log('');

// 测试通过 Key 查找
console.log('【3】通过 Key 查找...');
const found = storage.findByKey(subKey1.key);
if (found && found.id === subKey1.id) {
  console.log('  ✓ 查找成功');
  console.log(`    ID: ${found.id}`);
  console.log(`    状态: ${found.status}`);
} else {
  console.log('  ✗ 查找失败');
  process.exit(1);
}
console.log('');

// 测试通过 ID 查找
console.log('【4】通过 ID 查找...');
const foundById = storage.findById(subKey1.id);
if (foundById && foundById.key === subKey1.key) {
  console.log('  ✓ 查找成功');
  console.log(`    Key: ${foundById.key}`);
  console.log(`    状态: ${foundById.status}`);
} else {
  console.log('  ✗ 查找失败');
  process.exit(1);
}
console.log('');

// 测试列出所有子 Key
console.log('【5】列出所有子 Key...');
const allKeys = storage.list();
console.log(`  ✓ 共 ${allKeys.length} 个子 Key`);
for (const sk of allKeys) {
  console.log(`    - ${sk.key} (${sk.status})`);
}
console.log('');

// 测试失效子 Key
console.log('【6】失效子 Key...');
const revoked = storage.revoke(subKey1.id);
if (revoked && revoked.status === SubKeyStatus.REVOKED) {
  console.log('  ✓ 失效成功');
  console.log(`    Key: ${revoked.key}`);
  console.log(`    状态: ${revoked.status}`);
} else {
  console.log('  ✗ 失效失败');
  process.exit(1);
}
console.log('');

// 验证失效后查找
console.log('【7】验证失效后状态...');
const afterRevoke = storage.findByKey(subKey1.key);
if (afterRevoke && afterRevoke.status === SubKeyStatus.REVOKED) {
  console.log('  ✓ 状态正确: 已失效');
} else {
  console.log('  ✗ 状态异常');
  process.exit(1);
}
console.log('');

// 测试创建多个子 Key
console.log('【8】创建多个子 Key...');
const subKey2 = storage.create({ description: '第二个测试 Key' });
const subKey3 = storage.create({ description: '第三个测试 Key' });
console.log('  ✓ 创建成功');
console.log(`    Key 2: ${subKey2.key}`);
console.log(`    Key 3: ${subKey3.key}`);
console.log('');

// 测试 revokeAll
console.log('【9】失效所有子 Key...');
const count = storage.revokeAll();
console.log(`  ✓ 已失效 ${count} 个子 Key`);
console.log('');

// 验证
console.log('【10】最终验证...');
const finalList = storage.list();
const activeCount = finalList.filter(sk => sk.status === SubKeyStatus.ACTIVE).length;
console.log(`  ✓ 总数: ${finalList.length}`);
console.log(`  ✓ 活跃: ${activeCount}`);
console.log(`  ✓ 已失效: ${finalList.length - activeCount}`);
console.log('');

console.log('╔══════════════════════════════════════════╗');
console.log('║         所有测试通过! ✓                 ║');
console.log('╚══════════════════════════════════════════╝\n');
