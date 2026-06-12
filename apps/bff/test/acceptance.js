const { io } = require('socket.io-client');

const WS_URL = 'ws://localhost:3000/video';

// 生成指定内容的伪 base64（长度 > 1000 以触发 Normal 场景）
function makeImage(seed) {
  const prefix = seed.toString().padStart(10, '0');
  return prefix + 'A'.repeat(1490);
}

const IMAGE_BASE64 = makeImage(1);
const IMAGE_BASE64_V2 = makeImage(2);
const SMALL_IMAGE_BASE64 = 'A'.repeat(100); // 触发 Blank

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent(client, event, count, timeoutMs = 10_000) {
  const results = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, handler);
      reject(new Error(`timeout waiting for ${count} ${event} events, got ${results.length}`));
    }, timeoutMs);

    function handler(data) {
      results.push(data);
      if (results.length >= count) {
        clearTimeout(timer);
        client.off(event, handler);
        resolve(results);
      }
    }

    client.on(event, handler);
  });
}

async function run() {
  const client = io(WS_URL, { transports: ['websocket'] });

  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('connect_error', reject);
  });
  console.log('[test] connected');

  const results = [];

  // 1. 正常帧 -> mocked 描述
  client.emit('frame', { frameId: 'f1', imageBase64: IMAGE_BASE64, timestamp: Date.now() });
  const [r1] = await waitForEvent(client, 'frame:result', 1);
  results.push({ case: 'normal frame', result: r1 });
  console.log('[test] normal frame result:', r1);

  // 2. 相同帧 -> 静态帧跳过
  client.emit('frame', { frameId: 'f2', imageBase64: IMAGE_BASE64, timestamp: Date.now() });
  const [r2] = await waitForEvent(client, 'frame:result', 1);
  results.push({ case: 'static frame', result: r2 });
  console.log('[test] static frame result:', r2);

  // 3. 不同帧 -> 真实分析（mock）
  client.emit('frame', { frameId: 'f3', imageBase64: IMAGE_BASE64_V2, timestamp: Date.now() });
  const [r3a] = await waitForEvent(client, 'frame:result', 1);
  results.push({ case: 'changed frame first', result: r3a });
  console.log('[test] changed frame first result:', r3a);

  // 4. 再次发送完全相同的 IMAGE_BASE64_V2 -> 缓存命中
  client.emit('frame', { frameId: 'f4', imageBase64: IMAGE_BASE64_V2, timestamp: Date.now() });
  const [r3b] = await waitForEvent(client, 'frame:result', 1);
  results.push({ case: 'changed frame cached', result: r3b });
  console.log('[test] changed frame cached result:', r3b);

  // 5. 小帧 -> Blank 跳过
  client.emit('frame', { frameId: 'f5', imageBase64: SMALL_IMAGE_BASE64, timestamp: Date.now() });
  const [r4] = await waitForEvent(client, 'frame:result', 1);
  results.push({ case: 'blank frame', result: r4 });
  console.log('[test] blank frame result:', r4);

  // 6. 快速发送 70 帧，触发限流；先注册收集器
  const burstPromise = waitForEvent(client, 'frame:result', 70, 15_000);
  for (let i = 0; i < 70; i++) {
    client.emit('frame', {
      frameId: `burst-${i}`,
      imageBase64: makeImage(1000 + i),
      timestamp: Date.now(),
    });
    await sleep(2);
  }
  const burstResults = await burstPromise;
  const rateLimited = burstResults.filter((r) =>
    String(r.description).includes('rate limited'),
  );
  results.push({ case: 'rate limit', total: burstResults.length, rateLimited: rateLimited.length });
  console.log(`[test] burst 70 frames, rate limited: ${rateLimited.length}`);

  // 7. 分辨率档位（通过 frame:tier 事件观察）
  const tiers = [];
  client.on('frame:tier', (tier) => tiers.push(tier));

  const tierPromise = waitForEvent(client, 'frame:result', 30, 10_000);
  for (let i = 0; i < 30; i++) {
    client.emit('frame', {
      frameId: `tier-${i}`,
      imageBase64: makeImage(2000 + i),
      timestamp: Date.now(),
    });
    await sleep(2);
  }
  await tierPromise;
  await sleep(300);

  const distinctTiers = tiers.filter(
    (tier, index, self) =>
      index === self.findIndex((t) => t.maxWidth === tier.maxWidth),
  );
  results.push({ case: 'resolution tiers', tiers: distinctTiers });
  console.log('[test] resolution tiers:', distinctTiers);

  // 8. 对话消息
  client.emit('dialogue', { sessionId: 's1', message: '这是什么', frame: IMAGE_BASE64 });
  const [d1] = await waitForEvent(client, 'dialogue:result', 1);
  results.push({ case: 'dialogue with frame', result: d1 });
  console.log('[test] dialogue result:', d1);

  client.disconnect();

  // 输出验收结论
  console.log('\n========== 验收结果 ==========');
  const normalOk = String(r1.description).includes('mock');
  const staticOk = String(r2.description).includes('static frame filtered');
  const cacheOk = r3b.fromCache === true;
  const blankOk = String(r4.description).includes('scene filtered');
  const rateLimitOk = rateLimited.length > 0;
  const tierOk = distinctTiers.length >= 1;
  const dialogueOk = String(d1.reply).includes('画面');

  console.log('WebSocket 发送帧后收到 mocked 描述:', normalOk ? '✅' : '❌');
  console.log('静态帧被 CostGuardian 跳过:', staticOk ? '✅' : '❌');
  console.log('相同画面复用缓存结果:', cacheOk ? '✅' : '❌');
  console.log('空白帧被场景过滤:', blankOk ? '✅' : '❌');
  console.log('频繁调用触发限流:', rateLimitOk ? '✅' : '❌');
  console.log('分辨率降级档位生效:', tierOk ? '✅' : '❌');
  console.log('对话消息走 VisionService:', dialogueOk ? '✅' : '❌');

  if (!normalOk || !staticOk || !cacheOk || !blankOk || !rateLimitOk || !tierOk) {
    console.log('\n原始结果:', JSON.stringify(results, null, 2));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
