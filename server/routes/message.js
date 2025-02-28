// 为了方便测试，提供通过http处理消息的接口
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/token');
const connect = require('../db/connection');

router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
      return;
    }

    const { room, type, content } = req.body;
    if (!type || !content || !room) {
      res.status(400).json({ code: 'MISSING_PARAMS', message: '缺少参数' });
      return;
    }

    const db = await connect();
    const messages = db.collection('messages');

    const result = await messages.insertOne({
      room,
      sender: decoded.uid,
      type,
      content,
      created_at: new Date(),
      read_by: []
    });

    const message = await messages.findOne({ _id: result.insertedId });

    res.status(201).json({ code: 'SUCCESS', message: '发送成功', data: message });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;
