const WebSocket = require('ws');
const { db } = require('../../db/connection');
const { toObjectId } = require('../../utils/objectId');
const { getTimestamp } = require('../../utils/time');
const broadcast = require('../utils/broadcast');
const dbMessages = db.collection('messages');

async function wsOnRead(ws, data, users) {
  const reader = users.get(ws);
  if (!reader) {
    ws.send(JSON.stringify({ event: 'error', message: '请先加入房间' }));
    return;
  }

  const updateResult = await dbMessages.updateMany(
    {
      roomId: toObjectId(reader.roomId),
      readBy: { $ne: reader.uid },
    },
    {
      $addToSet: { readBy: reader.uid },
    }
  );

  if (updateResult.modifiedCount > 0) {
    // 获取更新后的消息
    const updatedMessages = await dbMessages
      .find({
        roomId: toObjectId(reader.roomId),
      })
      .toArray();
    const readMessages = updatedMessages.map((message) => ({
      timestamp: getTimestamp(message.createdAt),
      readBy: message.readBy,
    }));

    broadcast('updateRead', readMessages, reader, users);
  }
}

module.exports = wsOnRead;
