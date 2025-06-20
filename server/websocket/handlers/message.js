const { db } = require('../../db/connection');
const { validate } = require('../../utils/ajv');
const { toObjectId } = require('../../utils/objectId');
const { toTimestamp } = require('../../utils/time');
const broadcast = require('../utils/broadcast');

const dbMessages = db.collection('messages');
const dbRooms = db.collection('rooms');

async function wsOnMessage(ws, data, users) {
  const user = users.get(ws);
  if (!user) {
    ws.send(JSON.stringify({ event: 'error', message: '请先加入房间' }));
    return;
  }

  const valid = validate(data, {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['text', 'file', 'image', 'video'] },
      content: { type: 'string', maxLength: 1000 },
    },
    required: ['type', 'content'],
  });

  if (!valid) {
    ws.send(JSON.stringify({ event: 'error', message: '消息格式不正确' }));
    return;
  }

  const { type, content } = data;

  const newMessage = {
    roomId: user.roomId,
    senderId: user.uid,
    content: content.trim(),
    type,
    createdAt: new Date(),
    readBy: [user.uid],
  };

  const result = await dbMessages.insertOne({
    ...newMessage,
    roomId: toObjectId(newMessage.roomId),
  });

  if (!result.acknowledged) {
    ws.send(JSON.stringify({ event: 'error', message: '消息发送失败' }));
    return;
  }

  // 更新房间的lastMessage信息
  await dbRooms.updateOne(
    { rid: toObjectId(user.roomId) },
    {
      $set: {
        lastMessage: {
          content: content.trim(),
          type,
          senderId: user.uid,
          createdAt: newMessage.createdAt
        }
      }
    }
  );

  const messageData = {
    ...newMessage,
    createdAt: toTimestamp(newMessage.createdAt),
  };
  delete messageData._id;
  delete messageData.roomId;

  broadcast('message', messageData, user, users);
}

module.exports = wsOnMessage;
