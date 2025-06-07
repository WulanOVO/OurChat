const { db } = require('../../db/connection');
const { toObjectId } = require('../../utils/objectId');
const { toTimestamp } = require('../../utils/time');
const broadcast = require('../utils/broadcast');

const dbMessages = db.collection('messages');

async function wsOnRead(ws, data, users) {
  const reader = users.get(ws);
  if (!reader) {
    ws.send(JSON.stringify({ event: 'error', message: '请先加入房间' }));
    return;
  }

  // 先找出需要更新的消息ID
  const messagesToUpdate = await dbMessages
    .find({
      roomId: toObjectId(reader.roomId),
      readBy: { $ne: reader.uid },
    })
    .toArray();

  // 如果有需要更新的消息
  if (messagesToUpdate.length > 0) {
    // 获取这些消息的ID
    const messageIds = messagesToUpdate.map((msg) => msg._id);

    // 更新这些消息的已读状态
    await dbMessages.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { readBy: reader.uid } }
    );

    // 只获取刚刚被更新的消息
    const updatedMessages = await dbMessages
      .find({ _id: { $in: messageIds } })
      .toArray();

    const readMessages = updatedMessages.map((message) => ({
      timestamp: toTimestamp(message.createdAt),
      readBy: message.readBy,
    }));

    broadcast('updateRead', readMessages, reader, users);
  }
}

module.exports = wsOnRead;
