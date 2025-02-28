const express = require('express');
const router = express.Router();
const { createHash } = require('../utils/hash');
const connect = require('../db/connection');
const { getNextSequence } = require('../db/counter');

router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ code: 'EMPTY_FIELDS', message: '用户名或密码不能为空' });
      return;
    }
    if (username.length > 30) {
      res.status(400).json({ code: 'TOO_LONG_FIELDS', message: '用户名长度不能超过30个字符' });
      return;
    }
    if (password.length > 100) {
      res.status(400).json({ code: 'TOO_LONG_FIELDS', message: '密码长度不能超过100个字符' });
      return;
    }

    const db = await connect();
    const users = db.collection('users');

    const existingUser = await users.findOne({ username });
    if (existingUser) {
      res.status(400).json({ code: 'USERNAME_EXISTS', message: '用户名已存在' });
      return;
    }

    await users.insertOne({
      uid: await getNextSequence('user_id'),
      username,
      nickname: username,
      password_hash: createHash(password),
      created_at: new Date()
    });

    res.json({ code: 'SUCCESS', message: '注册成功' });
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;