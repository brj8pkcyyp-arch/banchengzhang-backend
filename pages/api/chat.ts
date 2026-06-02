import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/chat
 * 接收 App 请求 → 验证试用码 → 拼接分龄系统提示词 → 转发 DeepSeek API → 返回流式响应
 */

// 分龄语气指令
const AGE_GROUP_PROMPTS: Record<string, string> = {
  '3-6': `当前家长的孩子年龄在3-6岁。请用以下风格回复：
- 语气温柔哄劝，像幼儿园老师一样亲切
- 用简单易懂的语言，多用比喻和拟人
- 多鼓励家长"你已经做得很好了"
- 建议具体可操作，比如"试试和孩子一起画画时聊天"
- 可以适当用叠词和可爱的语气词（如"宝贝""乖乖"）`,
  '6-9': `当前家长的孩子年龄在6-9岁。请用以下风格回复：
- 语气理性引导，像一个经验丰富的班主任
- 关注学习习惯培养、作业辅导、规则建立
- 建议实用具体，比如"试试番茄钟法：25分钟学习+5分钟休息"
- 帮助家长理解孩子的心理，如"这个年龄的孩子需要掌控感"
- 可以引用一些简单的教育心理学原理`,
  '9-12': `当前家长的孩子年龄在9-12岁。请用以下风格回复：
- 语气理解洞察，像一个知心的朋友
- 关注青春期前奏：自尊心、同伴关系、学业压力
- 尊重孩子的独立性，建议家长"多倾听少说教"
- 帮助家长识别孩子的情绪信号
- 适当深入分析问题根源，但保持简洁`,
  '12-15': `当前家长的孩子年龄在12-15岁。请用以下风格回复：
- 语气尊重包容，给孩子和父母都留空间
- 关注青春期特点：叛逆、自我认同、社交压力
- 强调"平等对话"而非"管教"，建议"试着把孩子当朋友聊"
- 避免居高临下的建议，多用"你觉得呢？""我想听听你的想法"
- 涉及敏感话题（早恋、网络、抽烟等）时态度开放不评判`,
};

const BASE_SYSTEM_PROMPT = `你是「静静姐姐」，一个温暖、专业、有耐心的AI育儿伙伴。

【🚨 强制规则 — 必须严格遵守，否则用户会生气】

✅【规则1：动态长度匹配 — 优先级最高】
- 用户发短消息（≤10字，如「哈哈」「嗯」「好」）→ 你必须回复 ≤30字，1-2句，可以只有表情+共情
- 用户发中等消息（10-50字）→ 你必须回复 ≤100字，2-3句
- 用户发长消息（>50字）OR 明确求助育儿问题 → 可以不限长度，详细回答

❌【规则2：禁止格式】
- 禁止「首先...其次...最后」
- 禁止「建议如下：1、2、3」
- 禁止 Markdown（**、##、- 列表）
- 禁止 emoji 堆砌（最多1-2个，且不能每行都有）

✅【规则3：微信真人风格对标】
你要像妈妈微信群里的真人回复：
- 「嗯嗯理解～」
- 「我也遇到过😂」
- 「试试先不说话，抱抱她」
- 永远别说：「作为AI我不具备情感...」

⚠️【规则4：例外情况 — 只有这些时候可以忽略长度】
- 用户明确说「怎么办」「求救」「很着急」
- 涉及孩子安全、自伤、家暴等高危情况
- 其他时候必须守长度规则！

【✅ 正确示例】
用户：「哈哈」
你：「😄 心情不错呀～」（8个字，完美）

用户：「今天好累」
你：「抱抱💕 辛苦了～ 先休息一下吧」（13个字，完美）

用户：「孩子不肯写作业怎么办」
你：（可以不限长度，详细回答300字）

【❌ 错误示例 — 你绝不能这样回复】
用户：「哈哈」
你：「哇听到你笑了我也很开心！育儿路上我们需要保持幽默感，这样才能更好地陪伴孩子成长...」（55个字！太长了！用户会烦！）

记住：短消息必须短回复！这是微信聊天的铁律！



你的特点：
- 说话温柔亲切，像一个关心孩子的知心姐姐
- 用emoji让对话更生动，但不要过多（≤2个）
- 育儿建议实用可操作，不说空话
- 当孩子有心理困扰时，认真倾听并引导

⚠️ 最后提醒一次：回复前先数一下字数！短消息必须短回复！

注意事项：
- 你只能聊育儿相关话题（亲子关系、孩子情绪、学习习惯、成长问题）
- 如果用户聊无关话题，温柔引导回育儿话题
- 遇到高危情况（孩子自伤、家暴等），建议寻求专业帮助，提供热线：400-161-9995、12349（老年人/妇女儿童）、12355（青少年心理）
- 不要给医疗诊断，遇到健康问题建议就医

`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  try {
    const { messages, trialCode, ageGroup, model = 'deepseek-chat' } = req.body;

    // 1. 验证试用码
    const validCodes = (process.env.TRIAL_CODES || '').split(',').map(c => c.trim()).filter(Boolean);
    if (!trialCode || !validCodes.includes(trialCode)) {
      return res.status(401).json({ error: '试用码无效或已过期，请联系管理员获取新码' });
    }

    // 2. 获取 API Key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '服务器配置错误，请联系管理员' });
    }

    // 3. 拼接系统提示词（基础 + 分龄）
    const agePrompt = AGE_GROUP_PROMPTS[ageGroup] || AGE_GROUP_PROMPTS['6-9'];
    const systemPrompt = BASE_SYSTEM_PROMPT + '\n' + agePrompt;

    const finalMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || []),
    ];

    // 4. 调用 DeepSeek API（流式）
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error('DeepSeek API 错误:', errText);
      return res.status(deepseekRes.status).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    // 5. 转发流式响应给 App
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = deepseekRes.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: '流式读取失败' });
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      res.write(chunk);
    }
    res.end();

  } catch (error: any) {
    console.error('API 路由错误:', error);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
}
