const express = require('express');
const router = express.Router();
const { createHash } = require('../utils/hash');
const { generateToken } = require('../utils/token');
const { db } = require('../db/connection');
const { validate } = require('../utils/ajv');

router.post('/', async (req, res) => {
  try {
    const valid = validate(req.body, {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['username', 'password'],
    });

    if (!valid) {
      res
        .status(400)
        .json({ code: 'INVALID_REQUEST', message: '请求参数错误' });
      return;
    }

    const { username, password } = req.body;

    const users = db.collection('users');

    const user = await users.findOne({
      username,
      password_hash: createHash(password),
    });

    if (!user) {
      res
        .status(401)
        .json({ code: 'UNAUTHORIZED', message: '用户名或密码错误' });
      return;
    }

    res.json({
      code: 'SUCCESS',
      message: '登录成功',
      data: {
        uid: user.uid,
        username: user.username,
        nickname: user.nickname,
      },
      token: generateToken({ uid: user.uid }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;
