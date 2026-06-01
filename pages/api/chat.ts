import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/chat
 * 接收 App 请求 → 验证试用码 → 转发 DeepSeek API → 返回流式响应
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  try {
    const { messages, trialCode, model = 'deepseek-chat' } = req.body;

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

    // 3. 调用 DeepSeek API（流式）
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error('DeepSeek API 错误:', errText);
      return res.status(deepseekRes.status).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    // 4. 转发流式响应给 App
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
