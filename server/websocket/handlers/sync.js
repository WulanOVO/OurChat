const { db } = require('../../db/connection');
const { toObjectId } = require('../../utils/objectId');
const { getMessages } = require('../utils/getMessages');

const dbMessages = db.collection('messages');

async function wsOnSync(ws, data, users) {
  const user = users.get(ws);
  if (!user) {
    ws.send(JSON.stringify({ event: 'error', message: '请先加入房间' }));
    return;
  }
  const roomId = user.roomId;

  const messages = await getMessages(roomId);

  ws.send(
    JSON.stringify({
      event: 'sync',
      data: messages,
    })
  );

  // 标记消息为已读
  await dbMessages.updateMany(
    {
      roomId: toObjectId(roomId),
      readBy: { $ne: user.uid },
    },
    {
      $addToSet: { readBy: user.uid },
    }
  );
}

module.exports = wsOnSync;