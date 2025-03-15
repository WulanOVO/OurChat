const { verifyToken } = require('../../utils/token');

async function handleJoin(ws, data, dbRooms, dbMessages, users) {
  const { token, rid } = data;
  const decoded = verifyToken(token);

  if (!decoded) {
    ws.send(JSON.stringify({ type: 'error', message: '未授权的访问' }));
    ws.close();
    return;
  }

  const room = await dbRooms.findOne({ rid });

  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
    ws.close();
    return;
  }

  const userData = room.members.find(member => member.uid === decoded.uid);

  if (!userData) {
    ws.send(JSON.stringify({ type: 'error', message: '你没有权限进入该房间' }));
    ws.close();
    return;
  }

  users.set(ws, { rid, ...userData });

  // 创建一个包含所有用户详细信息的映射表
  const userDetailsMap = {};
  room.members.forEach(member => {
    userDetailsMap[member.uid] = {
      uid: member.uid,
      nickname: member.nickname || '未知用户'
    };
  });

  // 发送用户信息和房间信息，包含用户详细信息映射表
  ws.send(JSON.stringify({
    type: 'user',
    user: userData,
    roomData: {
      rid: room.rid,
      name: room.name,
      members: room.members
    },
    userDetailsMap: userDetailsMap
  }));

  const messages = await dbMessages.find({ room: rid })
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();

  ws.send(JSON.stringify({
    type: 'history',
    messages: messages.map(({ _id, ...rest }) => rest).reverse()
  }));
}

module.exports = handleJoin;