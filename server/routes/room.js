const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/token');
const connect = require('../db/connection');
const { getNextSequence } = require('../db/counter');

router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
    }
    const { uid } = decoded;

    const db = await connect();
    const rooms = db.collection('rooms');

    const roomsList = await rooms.find({ 'members.uid': uid }).toArray();

    res.status(200).json({ code: 'SUCCESS', message: '获取房间列表成功', data: roomsList });
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
    }

    const { name, members } = req.body;
    if (!name || !members) {
      res.status(400).json({ code: 'MISSING_PARAMS', message: '缺少参数' });
      return;
    }

    const rid = await getNextSequence('room_id');

    const db = await connect();
    const rooms = db.collection('rooms');

    const result = await rooms.insertOne({
      rid,
      name,
      members,
    });

    const room = await rooms.findOne({ _id: result.insertedId });

    res.status(201).json({ code: 'SUCCESS', message: '创建房间成功', data: room });
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;