// test-tool-call.js  放在项目根目录跑：node test-tool-call.js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey:  process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

async function test() {
  console.log('BASE_URL:', process.env.ANTHROPIC_BASE_URL);
  console.log('MODEL:', process.env.QWEN_MODEL);
  console.log('---');

  try {
    const response = await client.messages.create({
      model:      process.env.QWEN_MODEL,
      max_tokens: 200,
      tools: [{
        name: "save_person",
        description: "保存一个人物信息到数据库",
        input_schema: {
          type: "object",
          properties: {
            role:       { type: "string", description: "角色：本人|父亲|母亲|爷爷|奶奶" },
            birth_place:{ type: "string", description: "出生地" },
            generation: { type: "integer",description: "0=本人,1=父辈,2=祖辈" }
          },
          required: ["role", "generation"]
        }
      }],
      messages: [{
        role:    "user",
        content: "我叫王明，出生在北京，请帮我保存。"
      }]
    });

    console.log('✅ 调用成功！stop_reason:', response.stop_reason);
    console.log('content types:', response.content.map(b => b.type));

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (toolUse) {
      console.log('✅ Tool calling 正常！tool_name:', toolUse.name);
      console.log('   input:', JSON.stringify(toolUse.input, null, 2));
    } else {
      console.log('⚠️  没有 tool_use，模型直接回复文本：');
      console.log('  ', response.content[0]?.text?.slice(0, 100));
    }

  } catch (err) {
    console.error('❌ 调用失败！');
    console.error('   status:', err.status);
    console.error('   message:', err.message);
    console.error('   body:', JSON.stringify(err.error, null, 2));
  }
}

test();
