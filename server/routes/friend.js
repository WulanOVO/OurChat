const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/token');
const { generateFriendCode, verifyFriendCode } = require('../utils/friendCode');
const { getFriendList, addFriend, deleteFriend } = require('../db/friend');
const { validate } = require('../utils/ajv');

router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
      return;
    }

    const { uid } = decoded;
    const friendList = await getFriendList(uid);

    res.json({
      code: 'SUCCESS',
      message: '好友列表获取成功',
      data: { friendList },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

router.post('/generate_friend_code', (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
      return;
    }

    const { uid } = decoded;
    const friendCode = generateFriendCode(uid);

    res.json({
      code: 'SUCCESS',
      message: '好友码创建成功',
      data: { friendCode },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

router.post('/add_friend_by_code', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
      return;
    }

    const reqUid = decoded.uid;

    const valid = validate(req.body, {
      type: 'object',
      properties: {
        friendCode: { type: 'string' },
      },
      required: ['friendCode'],
    });

    if (!valid) {
      res
        .status(400)
        .json({ code: 'INVALID_REQUEST', message: '请求参数错误' });
      return;
    }

    const { friendCode } = req.body;

    const friendUid = verifyFriendCode(friendCode, reqUid);
    if (!friendUid) {
      res
        .status(400)
        .json({ code: 'INVALID_FRIEND_CODE', message: '无效的好友码' });
      return;
    }
    if (friendUid === reqUid) {
      res
        .status(400)
        .json({ code: 'CANNOT_ADD_SELF', message: '无法添加自己为好友' });
      return;
    }

    let result;
    try {
      result = await addFriend(reqUid, friendUid);
    } catch (err) {
      if (err.message === '已存在好友关系') {
        res
          .status(400)
          .json({ code: 'FRIEND_ALREADY_EXISTS', message: '好友已存在' });
        return;
      }
      throw err;
    }

    res.json({
      code: 'SUCCESS',
      message: '好友添加成功',
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

router.delete('/:uid', async (req, res) => {
  try {
    const token = req.headers.authorization;

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权的访问' });
      return;
    }

    const { uid } = decoded;
    const friendUid = parseInt(req.params.uid);

    try {
      await deleteFriend(uid, friendUid);
    } catch (err) {
      if (err.message === '好友关系不存在') {
        res
          .status(400)
          .json({ code: 'FRIEND_NOT_FOUND', message: '好友关系不存在' });
        return;
      }
      throw err;
    }

    res.json({
      code: 'SUCCESS',
      message: '好友删除成功',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: '服务器内部错误' });
  }
});

module.exports = router;
