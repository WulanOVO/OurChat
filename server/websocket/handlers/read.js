const WebSocket = require('ws');

async function handleRead(ws, data, users, dbMessages) {
  const reader = users.get(ws);
  if (!reader) {
    ws.send(JSON.stringify({ type: 'error', message: '请先加入房间' }));
    return;
  }

  const updateResult = await dbMessages.updateMany(
    {
      room: reader.rid,
      timestamp: { $lte: new Date(data.timestamp) },
      read_by: { $ne: reader.uid }
    },
    {
      $addToSet: { read_by: reader.uid }
    }
  );

  if (updateResult.modifiedCount > 0) {
    // 获取更新后的消息
    const updatedMessages = await dbMessages.find({
      room: reader.rid,
      timestamp: { $lte: new Date(data.timestamp) }
    }).toArray();

    // 广播已读状态更新，只传输用户ID
    for (const [client, clientUser] of users.entries()) {
      if (clientUser.rid === reader.rid && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'read_status_update',
          messages: updatedMessages.map(msg => ({
            timestamp: msg.timestamp,
            read_by: msg.read_by // 只传输用户ID数组
          }))
        }));
      }
    }
  }
}

module.exports = handleRead;