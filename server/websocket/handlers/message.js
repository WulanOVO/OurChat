const WebSocket = require('ws');

async function handleMessage(ws, data, users, dbMessages) {
  const user = users.get(ws);
  if (!user) {
    ws.send(JSON.stringify({ type: 'error', message: '请先加入房间' }));
    return;
  }

  // 消息格式验证
  if (!data.content || typeof data.content !== 'string') {
    ws.send(JSON.stringify({ type: 'error', message: '消息格式不正确' }));
    return;
  }

  if (data.content.length > 1000) {
    ws.send(JSON.stringify({ type: 'error', message: '消息长度不能超过1000字符' }));
    return;
  }

  const newMessage = {
    room: user.rid,
    sender: user.uid,
    content: data.content.trim(),
    content_type: 'text',
    timestamp: new Date(),
    read_by: [user.uid]
  };

  const result = await dbMessages.insertOne(newMessage);

  if (!result.acknowledged) {
    ws.send(JSON.stringify({ type: 'error', message: '消息发送失败' }));
    return;
  }

  // 广播消息给同一房间的所有用户
  const { _id, ...messageWithoutId } = newMessage;
  for (const [client, clientUser] of users.entries()) {
    if (clientUser.rid === user.rid && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          type: 'chat',
          ...messageWithoutId
        }));
      } catch (err) {
        console.error('发送消息失败:', err);
      }
    }
  }
}

module.exports = handleMessage;