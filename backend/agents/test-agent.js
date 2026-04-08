/**
 * ============================================================
 *  test-agent.js  ·  Qwen Tool Calling 验证脚本
 *  放在项目根目录，完全独立，不影响任何现有文件
 *
 *  用法：node test-agent.js
 *       node test-agent.js --phase=1   只跑阶段1
 *       node test-agent.js --phase=2   只跑阶段2
 *       node test-agent.js --phase=3   只跑阶段3
 * ============================================================
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

// ── 彩色日志 ──────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',  gray:   '\x1b[90m',
  green:  '\x1b[32m', yellow: '\x1b[33m',
  red:    '\x1b[31m', cyan:   '\x1b[36m',
  blue:   '\x1b[34m', bold:   '\x1b[1m',
  magenta:'\x1b[35m',
};
const ts  = () => C.gray + new Date().toTimeString().slice(0, 8) + C.reset;
const log = {
  info:  (...a) => console.log(ts(), C.cyan  + '[INFO]'  + C.reset, ...a),
  ok:    (...a) => console.log(ts(), C.green + '[✓ OK]'  + C.reset, ...a),
  warn:  (...a) => console.log(ts(), C.yellow+ '[WARN]'  + C.reset, ...a),
  error: (...a) => console.error(ts(), C.red + '[✗ ERR]' + C.reset, ...a),
  phase: (n, t) => console.log('\n' + C.bold + C.magenta +
    `${'═'.repeat(55)}\n  阶段 ${n}：${t}\n${'═'.repeat(55)}` + C.reset),
  result:(label, val) => console.log(
    C.bold + '  ' + label.padEnd(20) + C.reset +
    (val === true  ? C.green + '✓ 支持' :
     val === false ? C.red   + '✗ 不支持 / 失败' :
                     C.cyan  + String(val)) + C.reset
  ),
};

// ── 客户端 ────────────────────────────────────────────────────
const client = new Anthropic({
  apiKey:  process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const MODEL_LIGHT = process.env.QWEN_MODEL       || 'qwen-plus';
const MODEL_HEAVY = process.env.QWEN_MODEL_HEAVY || 'qwen-max';

// ── 验证目标 Agent 用到的工具定义（精简版，只有 2 个）────────
const AGENT_TOOLS = [
  {
    name: 'save_person',
    description: '当从对话中确认了某个家族成员的基本信息时，立刻调用此工具保存。' +
                 '不需要等到信息完全，有多少保存多少，后续可补充。',
    input_schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: '与用户的关系，如：本人、父亲、母亲、爷爷、奶奶、外公、外婆',
        },
        name: {
          type: 'string',
          description: '姓名，不知道时填对应 role 值',
        },
        birth_year: {
          type: 'integer',
          description: '出生年份，不确定时估算并在 note 中注明',
        },
        birth_place: {
          type: 'string',
          description: '出生地，尽量精确到县市',
        },
        generation: {
          type: 'integer',
          description: '代际：0=本人, 1=父辈, 2=祖辈, -1=子辈',
        },
        note: {
          type: 'string',
          description: '补充备注，如"年份为估算"',
        },
      },
      required: ['role', 'generation'],
    },
  },
  {
    name: 'mark_collection_complete',
    description: '当已收集到3代以上信息、主要迁徙节点基本完整时调用。' +
                 '调用后前端将触发地图生成流程。',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '简要概括收集到的家族信息（2-3句话）',
        },
        persons_count: {
          type: 'integer',
          description: '共收集到几位家族成员的信息',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: '信息完整度评估',
        },
      },
      required: ['summary', 'persons_count'],
    },
  },
];

// ── 模拟工具执行（验证阶段用 mock，不真实写 DB）──────────────
const mockDB = { persons: [] };

function executeTool(name, input) {
  if (name === 'save_person') {
    mockDB.persons.push(input);
    log.ok(`  [Tool] save_person 执行  role=${input.role}  generation=${input.generation}`);
    return { success: true, message: `已保存 ${input.role}（${input.name || '未知'}）` };
  }
  if (name === 'mark_collection_complete') {
    log.ok(`  [Tool] mark_complete 执行  persons=${input.persons_count}  confidence=${input.confidence}`);
    return { success: true, trigger: 'story_generation', message: '数据收集完成，触发故事生成' };
  }
  return { success: false, message: `未知工具: ${name}` };
}

// ══════════════════════════════════════════════════════════════
//  阶段 1：基础 Tool Calling（非流式）
//  验证：Qwen 能否通过 Anthropic SDK 正确调用 tools
// ══════════════════════════════════════════════════════════════
async function phase1_basicToolCall() {
  log.phase(1, 'Qwen Tool Calling 基础验证（非流式）');
  log.info(`模型: ${MODEL_HEAVY}`);

  const results = {
    apiConnected:    false,
    toolsParamAccepted: false,
    toolCallTriggered:  false,
    toolInputParsed:    false,
    stopReasonCorrect:  false,
  };

  try {
    log.info('发送请求（含 tools 参数）...');
    const t0 = Date.now();

    const response = await client.messages.create({
      model:      MODEL_HEAVY,
      max_tokens: 800,
      tools:      AGENT_TOOLS,
      system: '你是家族信息收集助手。用户告诉你家族信息后，立即用 save_person 工具保存。',
      messages: [
        {
          role: 'user',
          content: '我叫王明，1985年出生，老家是辽宁铁岭。我爸叫王国栋，1958年生，黑龙江双城人。',
        },
      ],
    });

    const elapsed = Date.now() - t0;
    results.apiConnected = true;
    log.ok(`API 连接成功  耗时 ${elapsed}ms`);

    // 检查 stop_reason
    log.info(`stop_reason: ${C.bold}${response.stop_reason}${C.reset}`);
    log.info(`usage: input=${response.usage?.input_tokens}  output=${response.usage?.output_tokens}`);

    results.toolsParamAccepted = true; // 没有报参数错误

    // 分析 content blocks
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const textBlocks    = response.content.filter(b => b.type === 'text');

    log.info(`content blocks: ${response.content.length} 个`);
    log.info(`  text blocks    : ${textBlocks.length}`);
    log.info(`  tool_use blocks: ${toolUseBlocks.length}`);

    if (toolUseBlocks.length > 0) {
      results.toolCallTriggered = true;
      results.stopReasonCorrect = response.stop_reason === 'tool_use';

      for (const block of toolUseBlocks) {
        log.info(`  工具调用: ${C.bold}${block.name}${C.reset}`);
        log.info(`  入参: ${JSON.stringify(block.input, null, 2)
          .split('\n').map(l => '         ' + l).join('\n').trim()}`);

        // 验证入参是否合理
        if (block.name === 'save_person' && block.input.role && block.input.generation !== undefined) {
          results.toolInputParsed = true;
        }
        if (block.name === 'mark_collection_complete' && block.input.summary) {
          results.toolInputParsed = true;
        }
      }
    } else {
      log.warn('LLM 没有调用任何工具，返回的是纯文本:');
      textBlocks.forEach(b => log.warn(' ', b.text.slice(0, 200)));
    }

  } catch (err) {
    log.error('请求失败:', err.message);
    if (err.status === 400) {
      log.error('→ 400 错误：tools 参数可能不被支持，或格式不对');
    }
    if (err.status === 401 || err.status === 403) {
      log.error('→ 认证错误，检查 DASHSCOPE_API_KEY');
    }
    log.error('详情:', JSON.stringify(err.error || err.message, null, 2));
  }

  // 输出结果汇总
  console.log('\n  ── 阶段 1 结果 ──────────────────────────────────');
  log.result('API 连接',            results.apiConnected);
  log.result('tools 参数被接受',    results.toolsParamAccepted);
  log.result('工具调用被触发',      results.toolCallTriggered);
  log.result('入参结构正确',        results.toolInputParsed);
  log.result('stop_reason=tool_use',results.stopReasonCorrect);

  return results;
}

// ══════════════════════════════════════════════════════════════
//  阶段 2：Streaming + Tool Use 同时开启
//  验证：流式输出时 tool_use block 能否正确解析
// ══════════════════════════════════════════════════════════════
async function phase2_streamingWithTools() {
  log.phase(2, 'Streaming + Tool Use 同时验证');
  log.info(`模型: ${MODEL_LIGHT}（轻量模型，响应更快）`);

  const results = {
    streamStarted:       false,
    textChunksReceived:  false,
    toolUseInStream:     false,
    toolInputComplete:   false,
    finalMessageCorrect: false,
  };

  let chunkCount       = 0;
  let collectedText    = '';
  let toolInputBuffer  = '';
  let detectedToolName = null;

  try {
    log.info('发起 stream 请求（含 tools 参数）...');

    const stream = client.messages.stream({
      model:      MODEL_LIGHT,
      max_tokens: 600,
      tools:      AGENT_TOOLS,
      system: '你是家族信息收集助手。用户告诉你家族信息后，立即用 save_person 工具保存，然后再和用户对话。',
      messages: [
        {
          role: 'user',
          content: '我叫李华，出生于1990年，现住北京。',
        },
      ],
    });

    // ── 监听原始 SSE 事件 ─────────────────────────────────────
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start') {
        if (event.content_block?.type === 'tool_use') {
          results.toolUseInStream = true;
          detectedToolName = event.content_block.name;
          log.info(`  [stream] tool_use block 开始: ${C.bold}${detectedToolName}${C.reset}`);
          process.stdout.write(C.yellow + '  [tool_input] ' + C.reset);
        }
        if (event.content_block?.type === 'text') {
          results.streamStarted = true;
          process.stdout.write(C.cyan + '  [text] ' + C.reset);
        }
      }

      if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'input_json_delta') {
          // tool 参数的流式片段
          toolInputBuffer += event.delta.partial_json || '';
          process.stdout.write(event.delta.partial_json || '');
        }
        if (event.delta?.type === 'text_delta') {
          collectedText += event.delta.text || '';
          chunkCount++;
          process.stdout.write(event.delta.text || '');
          if (chunkCount === 1) results.streamStarted = true;
          results.textChunksReceived = chunkCount > 0;
        }
      }

      if (event.type === 'content_block_stop') {
        process.stdout.write('\n');
      }
    });

    // ── finalMessage：完整消息 ────────────────────────────────
    const finalMsg = await stream.finalMessage();
    results.finalMessageCorrect = true;

    log.ok(`Stream 结束  chunks≈${chunkCount}  stop_reason=${finalMsg.stop_reason}`);
    log.info(`usage: input=${finalMsg.usage?.input_tokens}  output=${finalMsg.usage?.output_tokens}`);

    // 验证 tool input 是否可解析
    if (toolInputBuffer) {
      try {
        const parsed = JSON.parse(toolInputBuffer);
        results.toolInputComplete = true;
        log.ok(`  tool 入参解析成功: ${JSON.stringify(parsed)}`);
      } catch {
        log.warn(`  tool 入参 JSON 不完整: "${toolInputBuffer.slice(0, 100)}"`);
      }
    }

    // 也可以从 finalMsg.content 里拿完整 tool_use block
    const toolBlocks = finalMsg.content.filter(b => b.type === 'tool_use');
    if (toolBlocks.length > 0) {
      results.toolInputComplete = true;
      log.info('  finalMessage 中的工具调用:');
      toolBlocks.forEach(b => {
        log.info(`    ${b.name}: ${JSON.stringify(b.input)}`);
      });
    }

  } catch (err) {
    log.error('Stream 请求失败:', err.message);
    if (err.message?.includes('stream') || err.message?.includes('tool')) {
      log.error('→ streaming + tool_use 组合可能不被支持');
    }
    log.error('详情:', err.status, JSON.stringify(err.error || {}, null, 2));
  }

  console.log('\n  ── 阶段 2 结果 ──────────────────────────────────');
  log.result('Stream 启动',          results.streamStarted);
  log.result('Text chunks 收到',     results.textChunksReceived);
  log.result('Stream 中有 tool_use', results.toolUseInStream);
  log.result('Tool 入参完整可解析',  results.toolInputComplete);
  log.result('finalMessage 正常',    results.finalMessageCorrect);

  return results;
}

// ══════════════════════════════════════════════════════════════
//  阶段 3：完整 Agentic Loop（2 轮对话 + 工具执行）
//  验证：tool_result 反馈 → LLM 继续对话 是否正常
// ══════════════════════════════════════════════════════════════
async function phase3_agenticLoop() {
  log.phase(3, '完整 Agentic Loop（2轮 Tool Use）');
  log.info(`模型: ${MODEL_HEAVY}`);

  const results = {
    round1ToolCalled:    false,
    toolResultAccepted:  false,
    round2Continued:     false,
    loopTerminatedClean: false,
  };

  // 模拟用户的完整自述（足够触发2个人物）
  const messages = [
    {
      role: 'user',
      content: '我叫张伟，1988年生，出生在黑龙江哈尔滨。' +
               '我父亲张大明，1960年生，从黑龙江双城县迁到哈尔滨读大学，后来去了北京工作。' +
               '我爷爷张志远，1930年左右生，是双城县土生土长的人。',
    },
  ];

  let loopCount = 0;
  const MAX_LOOPS = 5; // 防止死循环

  try {
    while (loopCount < MAX_LOOPS) {
      loopCount++;
      log.info(`\n  ── Loop 第 ${loopCount} 轮 ───────────────────────────`);

      const response = await client.messages.create({
        model:      MODEL_HEAVY,
        max_tokens: 1000,
        tools:      AGENT_TOOLS,
        tool_choice: { type: 'auto' }, // LLM 自主决定是否调用工具
        system: `你是家族信息收集 Agent。每当用户提供家族成员信息，立刻用 save_person 保存。
当收集到3个或以上家族成员时，调用 mark_collection_complete 结束收集。
保存完成后，用温暖简短的语言告诉用户已记录。`,
        messages,
      });

      log.info(`  stop_reason: ${response.stop_reason}`);

      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const textBlocks    = response.content.filter(b => b.type === 'text');

      if (textBlocks.length > 0) {
        log.info(`  LLM 回复: "${textBlocks[0].text.slice(0, 100)}..."`);
      }

      // 没有工具调用 → 正常对话结束
      if (response.stop_reason === 'end_turn' && toolUseBlocks.length === 0) {
        results.round2Continued = loopCount > 1;
        results.loopTerminatedClean = true;
        log.ok('  Loop 以 end_turn 正常结束');
        break;
      }

      // 有工具调用 → 执行工具 + 构造 tool_result 反馈
      if (toolUseBlocks.length > 0) {
        if (loopCount === 1) results.round1ToolCalled = true;

        // 把 assistant 的这轮回复加入历史
        messages.push({ role: 'assistant', content: response.content });

        // 执行每个工具，收集结果
        const toolResults = toolUseBlocks.map(block => {
          const output = executeTool(block.name, block.input);
          log.ok(`  工具 [${block.name}] 执行完毕 → ${JSON.stringify(output)}`);
          return {
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify(output),
          };
        });

        // 把工具结果作为 user 消息追加（Anthropic 协议要求）
        messages.push({ role: 'user', content: toolResults });
        results.toolResultAccepted = true;

        // 如果调用了 mark_collection_complete → 终止 loop
        const hasComplete = toolUseBlocks.some(b => b.name === 'mark_collection_complete');
        if (hasComplete) {
          results.loopTerminatedClean = true;
          log.ok('  mark_collection_complete 触发，Loop 正常结束');
          break;
        }
      }
    }

    if (loopCount >= MAX_LOOPS) {
      log.warn(`  Loop 达到上限 ${MAX_LOOPS} 次，强制退出`);
    }

    results.round2Continued = loopCount >= 2 || results.loopTerminatedClean;

  } catch (err) {
    log.error('Agentic Loop 失败:', err.message);
    log.error('详情:', err.status, JSON.stringify(err.error || {}, null, 2));
  }

  console.log('\n  ── 阶段 3 结果 ──────────────────────────────────');
  log.result('第1轮工具被调用',      results.round1ToolCalled);
  log.result('tool_result 被接受',   results.toolResultAccepted);
  log.result('第2轮对话继续',        results.round2Continued);
  log.result('Loop 正常终止',        results.loopTerminatedClean);

  console.log('\n  Mock DB 写入结果:');
  mockDB.persons.forEach((p, i) => {
    console.log(`    [${i+1}] ${p.role}(gen=${p.generation})  birth=${p.birth_year || '?'}  place=${p.birth_place || '?'}`);
  });

  return results;
}

// ══════════════════════════════════════════════════════════════
//  入口
// ══════════════════════════════════════════════════════════════
async function main() {
  console.log(C.bold + C.cyan + `
╔══════════════════════════════════════════════════════╗
║     寻根 · Qwen Agent Tool Calling 验证脚本          ║
║     test-agent.js  (独立运行，不影响现有服务)         ║
╚══════════════════════════════════════════════════════╝` + C.reset);

  // 打印配置
  const key = process.env.DASHSCOPE_API_KEY;
  const url = process.env.ANTHROPIC_BASE_URL;
  console.log(`\n  DASHSCOPE_API_KEY : ${key ? key.slice(0,8)+'...' : C.red+'未设置'+C.reset}`);
  console.log(`  ANTHROPIC_BASE_URL: ${url || C.red+'未设置（将使用 Anthropic 官方）'+C.reset}`);
  console.log(`  MODEL_LIGHT       : ${MODEL_LIGHT}`);
  console.log(`  MODEL_HEAVY       : ${MODEL_HEAVY}`);

  if (!key) {
    log.error('DASHSCOPE_API_KEY 未设置，请检查 .env 文件');
    process.exit(1);
  }

  // 解析命令行参数
  const arg    = process.argv.find(a => a.startsWith('--phase='));
  const phase  = arg ? parseInt(arg.split('=')[1]) : 0; // 0 = 全部

  const summary = { phase1: null, phase2: null, phase3: null };

  if (phase === 0 || phase === 1) summary.phase1 = await phase1_basicToolCall();
  if (phase === 0 || phase === 2) summary.phase2 = await phase2_streamingWithTools();
  if (phase === 0 || phase === 3) summary.phase3 = await phase3_agenticLoop();

  // ── 最终总结 ──────────────────────────────────────────────
  console.log('\n' + C.bold + C.magenta +
    '═'.repeat(55) + '\n  总结 · 是否可以构建 Agent？\n' + '═'.repeat(55) + C.reset);

  // 判断能力支持情况
  const canToolCall   = summary.phase1?.toolCallTriggered;
  const canStream     = summary.phase2?.streamStarted;
  const canStreamTool = summary.phase2?.toolUseInStream;
  const canLoop       = summary.phase3?.loopTerminatedClean;

  log.result('Tool Calling 基础能力', canToolCall);
  log.result('Streaming 基础能力',    canStream);
  log.result('Streaming + Tool Use', canStreamTool);
  log.result('Agentic Loop',         canLoop);

  console.log('');
  if (canToolCall && canLoop) {
    if (canStreamTool) {
      log.ok('✅ 完整 Agent 方案可行（Streaming + Tool Use 均支持）');
      log.ok('   推荐：新建 /amapapi/agent 路由，使用 stream + tools 模式');
    } else if (canStream) {
      log.warn('⚠ 建议：用"分段流式"方案——对话回复用 stream，工具调用用非流式');
      log.warn('  前端：文字部分实时显示，工具执行时显示"分析中..."加载态');
    } else {
      log.warn('⚠ Streaming 不可用，Agent 使用非流式模式，用户体验会有延迟感');
    }
  } else {
    log.error('❌ Tool Calling 不可用，需要检查 DashScope 兼容层配置');
    log.error('   可能原因：');
    log.error('   1. ANTHROPIC_BASE_URL 未正确指向 DashScope 兼容端点');
    log.error('   2. 当前模型版本不支持 function calling');
    log.error('   3. tools 参数格式需要调整');
  }

  console.log('');
}

main().catch(err => {
  log.error('脚本异常退出:', err);
  process.exit(1);
});
