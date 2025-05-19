const WebSocket = require('ws');
const { db } = require('../../db/connection');
const { toObjectId } = require('../../utils/objectId');
const { getTimestamp } = require('../../utils/time');

const dbMessages = db.collection('messages');

async function handleRead(ws, data, users) {
  const reader = users.get(ws);
  if (!reader) {
    ws.send(JSON.stringify({ action: 'error', message: '请先加入房间' }));
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

    // 广播已读状态更新，只传输用户ID
    for (const [client, clientUser] of users.entries()) {
      if (
        clientUser.roomId === reader.roomId &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(
          JSON.stringify({
            action: 'updateRead',
            messages: readMessages,
          })
        );
      }
    }
  }
}

module.exports = handleRead;
