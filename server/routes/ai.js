const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/token');
const { OpenAI } = require('openai');
const { validate } = require('../utils/ajv');

const openai = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
});

router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
      return;
    }

    const valid = validate(req.body, {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
      },
      required: ['messages'],
    });

    if (!valid) {
      res.status(400).json({ code: 'BAD_REQUEST', message: '请求参数错误' });
      return;
    }

    const { messages } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.chat.completions.create({
      model: process.env.AI_MODEL,
      messages,
      stream: true,
    });

    let assistantMessage = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        assistantMessage += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(
      `data: ${JSON.stringify({ done: true, content: assistantMessage })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error(error);

    // 如果已经开始发送流式响应，发送错误事件
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: '服务器内部错误' })}\n\n`);
      res.end();
    } else {
      res
        .status(500)
        .json({ code: 'INTERNAL_SERVER_ERROR', message: '服务器内部错误' });
    }
  }
});

module.exports = router;
