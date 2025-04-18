const WebSocket = require('ws');

async function handleMessage(ws, data, users, dbMessages) {
  const user = users.get(ws);
  if (!user) {
    ws.send(JSON.stringify({ action: 'error', message: '请先加入房间' }));
    return;
  }

  if (!data.content || typeof data.content !== 'string') {
    ws.send(JSON.stringify({ action: 'error', message: '消息格式不正确' }));
    return;
  }

  if (data.content.length > 1000) {
    ws.send(JSON.stringify({ action: 'error', message: '消息长度不能超过1000字符' }));
    return;
  }

  const newMessage = {
    room: user.rid,
    sender: user.uid,
    content: data.content.trim(),
    type: 'text',
    timestamp: new Date(),
    read_by: [user.uid]
  };

  const result = await dbMessages.insertOne(newMessage);

  if (!result.acknowledged) {
    ws.send(JSON.stringify({ action: 'error', message: '消息发送失败' }));
    return;
  }

  const messageData = {
    ...newMessage,
    timestamp: Math.floor(newMessage.timestamp.getTime() / 1000)
  };
  delete messageData._id;
  delete messageData.room;

  for (const [client, clientUser] of users.entries()) {
    if (clientUser.rid === user.rid && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          action: 'chat',
          data: messageData
        }));
      } catch (err) {
        console.error('发送消息失败:', err);
      }
    }
  }
}

module.exports = handleMessage;