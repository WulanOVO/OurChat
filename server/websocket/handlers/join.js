const { verifyToken } = require('../../utils/token');

async function handleJoin(ws, data, dbRooms, dbMessages, users) {
  const { token, rid } = data;
  const decoded = verifyToken(token);

  if (!decoded) {
    ws.send(JSON.stringify({ action: 'error', message: '未授权的访问' }));
    ws.close();
    return null;
  }

  const room = await dbRooms.findOne({ rid });

  if (!room) {
    ws.send(JSON.stringify({ action: 'error', message: '房间不存在' }));
    ws.close();
    return null;
  }

  const userData = room.members.find(member => member.uid === decoded.uid);

  if (!userData) {
    ws.send(JSON.stringify({ action: 'error', message: '你没有权限进入该房间' }));
    ws.close();
    return null;
  }

  const userInfo = { rid, ...userData };
  users.set(ws, userInfo);

  const onlineUsers = new Set();
  for (const [_, user] of users.entries()) {
    if (user.rid === rid) {
      onlineUsers.add(user.uid);
    }
  }

  const membersWithOnlineStatus = room.members.map(member => ({
    ...member,
    online: onlineUsers.has(member.uid) || member.uid === userData.uid // 当前用户或已连接的用户标记为在线
  }));

  const roomData = {
    ...room,
    members: membersWithOnlineStatus
  };
  delete roomData._id;
  delete roomData.rid;

  ws.send(JSON.stringify({
    action: 'room',
    data: roomData
  }));

  const messages = await dbMessages.find({ room: rid })
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();
  messages.forEach(message => {
    delete message._id;
    delete message.room;
    message.timestamp = Math.floor(message.timestamp.getTime() / 1000);
  });
  messages.reverse();

  ws.send(JSON.stringify({
    action: 'history',
    data: messages
  }));
}

module.exports = handleJoin;