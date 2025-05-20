const { verifyToken } = require('../../utils/token');
const { db } = require('../../db/connection');
const { getPrivateRoomName } = require('../../utils/room');
const { toObjectId } = require('../../utils/objectId');
const { getTimestamp } = require('../../utils/time');
const broadcast = require('../utils/broadcast');

const dbRooms = db.collection('rooms');
const dbMessages = db.collection('messages');

async function wsOnJoin(ws, data, users) {
  const { token } = data;
  let { rid: roomId } = data;

  const decoded = verifyToken(token);
  if (!decoded) {
    ws.send(JSON.stringify({ event: 'error', message: '未授权的访问' }));
    ws.close();
    return null;
  }

  const { uid } = decoded;

  const room = await dbRooms.findOne({ rid: toObjectId(roomId) });

  if (!room) {
    ws.send(JSON.stringify({ event: 'error', message: '房间不存在' }));
    ws.close();
    return null;
  }

  const userInfo = room.members.find((member) => member.uid === uid);

  if (!userInfo) {
    ws.send(
      JSON.stringify({ event: 'error', message: '你没有权限进入该房间' })
    );
    ws.close();
    return null;
  }

  const user = { roomId, ...userInfo };
  users.set(ws, user);

  const onlineUsers = new Set();
  users.forEach((user) => {
    if (user.roomId === roomId) {
      onlineUsers.add(user.uid);
    }
  });

  const membersWithOnlineStatus = room.members.map((member) => ({
    ...member,
    online: onlineUsers.has(member.uid) || member.uid === userInfo.uid, // 当前用户或已连接的用户标记为在线
  }));

  const roomInfo = {
    ...room,
    members: membersWithOnlineStatus,
  };

  if (roomInfo.type === 'private') {
    roomInfo.name = getPrivateRoomName(roomInfo, uid);
  }
  delete roomInfo._id;
  delete roomInfo.rid;

  ws.send(
    JSON.stringify({
      event: 'room',
      data: roomInfo,
    })
  );

  const messages = await dbMessages
    .find({ roomId: toObjectId(roomId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  messages.forEach((message) => {
    delete message._id;
    delete message.roomId;
    message.createdAt = getTimestamp(message.createdAt);
  });
  messages.reverse();

  ws.send(
    JSON.stringify({
      event: 'history',
      data: messages,
    })
  );

  broadcast('userJoin', { uid }, user, users);
}

module.exports = wsOnJoin;
