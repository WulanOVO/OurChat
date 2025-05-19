const { verifyToken } = require('../../utils/token');
const { db } = require('../../db/connection');
const { getPrivateRoomName } = require('../../utils/room');
const { toObjectId } = require('../../utils/objectId');
const { getTimestamp } = require('../../utils/time');

const dbRooms = db.collection('rooms');
const dbMessages = db.collection('messages');

async function handleJoin(ws, data, users) {
  const { token } = data;
  let { rid: roomId } = data;

  const decoded = verifyToken(token);
  if (!decoded) {
    ws.send(JSON.stringify({ action: 'error', message: '未授权的访问' }));
    ws.close();
    return null;
  }

  const { uid } = decoded;

  const room = await dbRooms.findOne({ rid: toObjectId(roomId) });

  if (!room) {
    ws.send(JSON.stringify({ action: 'error', message: '房间不存在' }));
    ws.close();
    return null;
  }

  const userInfo = room.members.find((member) => member.uid === uid);

  if (!userInfo) {
    ws.send(
      JSON.stringify({ action: 'error', message: '你没有权限进入该房间' })
    );
    ws.close();
    return null;
  }

  const userInfoWithRoomId = { roomId, ...userInfo };
  users.set(ws, userInfoWithRoomId);

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
      action: 'room',
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
      action: 'history',
      data: messages,
    })
  );
}

module.exports = handleJoin;
