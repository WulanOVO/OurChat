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
      timestamp: new Date(),
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

// 获取群组历史消息
router.get('/:rid', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
    }

    const { uid } = decoded;
    const rid = parseInt(req.params.rid);
    const { before, limit = 50 } = req.query;

    const db = await connect();
    const rooms = db.collection('rooms');
    const messages = db.collection('messages');

    // 验证用户是否在群组中
    const room = await rooms.findOne({
      rid,
      'members.uid': uid
    });

    if (!room) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '您不在该群组中' });
    }

    // 查询条件 - 使用room字段
    const query = { room: rid };
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // 获取消息
    const messageList = await messages
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray();

    // 移除_id字段
    const messagesWithoutId = messageList.map(({ _id, ...rest }) => rest);

    res.json({
      code: 'SUCCESS',
      message: '获取消息成功',
      data: messagesWithoutId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

// 标记消息为已读
router.post('/:rid/read', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
    }

    const { uid } = decoded;
    const rid = parseInt(req.params.rid);
    const { timestamp } = req.body;

    if (!timestamp) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: '缺少时间戳参数' });
    }

    const db = await connect();
    const rooms = db.collection('rooms');
    const messages = db.collection('messages');

    // 验证用户是否在群组中
    const room = await rooms.findOne({
      rid,
      'members.uid': uid
    });

    if (!room) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '您不在该群组中' });
    }

    // 更新消息已读状态
    const result = await messages.updateMany(
      {
        room: rid,
        timestamp: { $lte: new Date(timestamp) },
        read_by: { $ne: uid }
      },
      {
        $addToSet: { read_by: uid }
      }
    );

    res.json({
      code: 'SUCCESS',
      message: '标记已读成功',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;
