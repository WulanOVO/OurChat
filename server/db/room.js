const { db } = require('./connection');
const { getNextSequence } = require('./counter');

async function createRoom(name, type, members, allocateNumberRoomId) {
  const dbRooms = db.collection('rooms');

  const roomId = allocateNumberRoomId
    ? (await getNextSequence('room_id')).toString()
    : null;

  const result = await dbRooms.insertOne({
    rid: roomId,
    name,
    type,
    members,
  });

  if (!allocateNumberRoomId) {
    // 如果未分配rid，则rid设置为_id
    await dbRooms.updateOne(
      { _id: result.insertedId },
      { $set: { rid: result.insertedId } }
    );
  }

  const roomData = await dbRooms.findOne({ _id: result.insertedId });
  delete roomData._id;

  return roomData;
}

module.exports = { createRoom };
