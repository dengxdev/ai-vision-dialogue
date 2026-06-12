const { DialogueService } = require('../dist/dialogue/dialogue.service');
const { VisionService } = require('../dist/vision/vision.service');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const visionService = new VisionService();
  const dialogueService = new DialogueService(visionService);
  const sessionId = 'test-session';

  console.log('\n========== 对话上下文验收测试 ==========');

  // 1. 纯文本消息能收到 AI 回复
  const r1 = await dialogueService.chat({
    sessionId,
    message: '你好',
  });
  console.log('[test] text reply:', r1.reply);
  console.log('[check] 收到 AI 回复:', r1.reply.length > 0 ? '✅' : '❌');

  // 2. 带视觉描述时回复引用画面内容
  const r2 = await dialogueService.chat({
    sessionId,
    message: '这是什么',
    visualContext: 'data:image/jpeg;base64,' + 'A'.repeat(2000),
  });
  console.log('[test] visual reply:', r2.reply);
  const visualReferenced = r2.reply.includes('画面');
  console.log('[check] 回复引用画面内容:', visualReferenced ? '✅' : '❌');

  // 3 & 4. 多轮对话 + 历史摘要压缩
  // 再发送 6 轮，使总轮数达到 8 轮（超过 6 轮阈值）
  for (let i = 1; i <= 6; i++) {
    await dialogueService.chat({
      sessionId,
      message: `第 ${i} 轮问题`,
    });
    await sleep(10);
  }

  const history = dialogueService.histories.get(sessionId);
  console.log('[test] final history length:', history.length);
  console.log('[test] final history roles:', history.map((m) => m.role));

  const hasSummary = history.some(
    (m) => m.role === 'system' && m.content.startsWith('历史对话摘要'),
  );
  const withinWindow = history.length <= 20; // 10 轮 * 2

  console.log('[check] 历史被摘要压缩:', hasSummary ? '✅' : '❌');
  console.log('[check] 历史在滑动窗口内:', withinWindow ? '✅' : '❌');

  // 打印摘要内容用于人工确认
  const summaryMsg = history.find((m) => m.role === 'system');
  if (summaryMsg) {
    console.log('[test] summary content:', summaryMsg.content.slice(0, 100) + '...');
  }

  // 5. 多 session 隔离
  const otherSession = 'other-session';
  await dialogueService.chat({ sessionId: otherSession, message: '另一个会话' });
  const otherHistory = dialogueService.histories.get(otherSession);
  console.log('[check] 多 session 历史隔离:', otherHistory.length === 2 ? '✅' : '❌');

  const allPassed =
    r1.reply.length > 0 &&
    visualReferenced &&
    hasSummary &&
    withinWindow &&
    otherHistory.length === 2;

  console.log('\n========== 总结果 ==========');
  console.log(allPassed ? '✅ 全部通过' : '❌ 存在失败项');

  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
