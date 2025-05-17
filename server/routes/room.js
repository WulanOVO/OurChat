const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/token');
const { db } = require('../db/connection');
const { createRoom } = require('../db/room');
const { validate } = require('../utils/ajv');

router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token, res);
    const { uid } = decoded;

    const dbRooms = db.collection('rooms');
    const roomList = await dbRooms.find({ 'members.uid': uid }).toArray();

    roomList.forEach((room) => delete room._id);

    res.status(200).json({
      code: 'SUCCESS',
      message: '获取房间列表成功',
      data: { roomList },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
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
        name: { type: 'string', minLength: 3, maxLength: 30 },
        members: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              uid: { type: 'number' },
              role: { type: 'string', enum: ['leader', 'admin', 'member'] },
              nickname: { type: 'string', minLength: 3, maxLength: 30 },
            },
            required: ['uid', 'role', 'nickname'],
          },
        },
      },
      required: ['name', 'members'],
    });

    if (!valid) {
      res
        .status(400)
        .json({ code: 'INVALID_REQUEST', message: '请求参数错误' });
      return;
    }

    const { name, members } = req.body;

    const roomData = await createRoom(name, 'normal', members, true);

    res
      .status(201)
      .json({ code: 'SUCCESS', message: '创建房间成功', data: { roomData } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;
