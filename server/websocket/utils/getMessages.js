const { db } = require('../../db/connection');
const { toObjectId } = require('../../utils/objectId');
const { toTimestamp: getTimestamp } = require('../../utils/time');

const dbMessages = db.collection('messages');

async function getMessages(roomId, limit = 50) {
  // 获取最近的消息
  const messages = await dbMessages
    .find({ roomId: toObjectId(roomId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  // 格式化消息
  const formattedMessages = messages
    .map((message) => {
      const formatted = {
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        createdAt: getTimestamp(message.createdAt),
        readBy: message.readBy || [],
      };
      return formatted;
    })
    .reverse();

  return formattedMessages;
}

module.exports = {
  getMessages,
};