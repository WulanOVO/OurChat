const express = require('express');
const router = express.Router();
const { createHash } = require('../utils/hash');
const { db } = require('../db/connection');
const { getNextSequence } = require('../db/counter');
const { validate } = require('../utils/ajv');

router.post('/', async (req, res) => {
  try {
    const valid = validate(req.body, {
      type: 'object',
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 30 },
        password: { type: 'string', minLength: 6, maxLength: 100 },
        inviteCode: { type: 'string' },
      },
      required: ['username', 'password', 'inviteCode'],
    });

    if (!valid) {
      res.status(400).json({ code: 'INVALID_REQUEST', message: '请求参数错误' });
      return;
    }

    const { username, password, inviteCode } = req.body;

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
    const valid = validate(req.body, {
      type: 'object',
      properties: {
        oldPassword: { type: 'string' },
        newPassword: { type: 'string' },
      },
      required: ['oldPassword', 'newPassword'],
    });

    if (!valid) {
      res.status(400).json({ code: 'INVALID_REQUEST', message: '请求参数错误' });
      return;
    }

    const { uid } = req.params;
    const { oldPassword, newPassword } = req.body;

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