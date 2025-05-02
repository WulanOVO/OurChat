const express = require('express');
const router = express.Router();
const { createHash } = require('../utils/hash');
const connect = require('../db/connection');
const { getNextSequence } = require('../db/counter');

router.post('/', async (req, res) => {
  try {
    const { username, password, inviteCode } = req.body;

    if (!username || !password || !inviteCode) {
      res.status(400).json({ code: 'EMPTY_FIELDS', message: '用户名、密码或邀请码不能为空' });
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
    const inviteCodes = db.collection('invite_codes');

    // 验证邀请码
    const code = await inviteCodes.findOne({ code: inviteCode });
    if (!code) {
      res.status(400).json({ code: 'INVALID_INVITE_CODE', message: '无效的邀请码' });
      return;
    }

    const existingUser = await users.findOne({ username });
    if (existingUser) {
      res.status(400).json({ code: 'USERNAME_EXISTS', message: '用户名已存在' });
      return;
    }

    // 创建用户
    await users.insertOne({
      uid: await getNextSequence('user_id'),
      username,
      nickname: username,
      password_hash: createHash(password),
      created_at: new Date()
    });

    // 删除已使用的邀请码
    await inviteCodes.deleteOne({ code: inviteCode });

    res.json({ code: 'SUCCESS', message: '注册成功' });
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

router.put('/:uid/password', async (req, res) => {
  try {
    const { uid } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ code: 'EMPTY_FIELDS', message: '旧密码和新密码不能为空' });
      return;
    }

    const db = await connect();
    const users = db.collection('users');
    const user = await users.findOne({ uid: parseInt(uid) });

    if (!user) {
      res.status(404).json({ code: 'USER_NOT_FOUND', message: '用户不存在' });
      return;
    }
    if (user.password_hash !== createHash(oldPassword)) {
      res.status(400).json({ code: 'INCORRECT_PASSWORD', message: '旧密码错误' });
      return;
    }

    await users.updateOne({ uid: parseInt(uid) }, { $set: { password_hash: createHash(newPassword) } });
    res.json({ code: 'SUCCESS', message: '密码修改成功' });
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
})

module.exports = router;