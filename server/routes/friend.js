const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/token');
const { generateFriendCode, verifyFriendCode } = require('../utils/friendCode');
const { addFriend } = require('../utils/friend');
const { validate } = require('../utils/ajv');

router.post('/generate_friend_code', (req, res) => {
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
});

router.post('/add_friend_by_code', async (req, res) => {
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
    res.status(400).json({ code: 'INVALID_REQUEST', message: '请求参数错误' });
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

  const friend = await addFriend(reqUid, friendUid);

  res.json({ code: 'SUCCESS', message: '好友添加成功', data: friend });
});

module.exports = router;
