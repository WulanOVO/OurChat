const { db } = require('./connection');
const { getNextSequence } = require('./counter');
const { getPrivateRoomName } = require('../utils/room');

async function getRoomByRoomId(roomId) {
  const dbRooms = db.collection('rooms');
  const roomData = await dbRooms.findOne({ rid: roomId });

  if (!roomData) {
    return null;
  }
  delete roomData._id;

  return roomData;
}

async function getRoomsByUid(uid) {
  const dbRooms = db.collection('rooms');
  const roomList = await dbRooms.find({ 'members.uid': uid }).toArray();

  roomList.forEach((room) => {
    delete room._id;
    if (room.type === 'private') {
      room.name = getPrivateRoomName(room, uid);
    }
    if (typeof room.rid === 'object') {
      room.rid = `#${room.rid.toString()}`;
    }
  });

  return roomList;
}

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

module.exports = { getRoomByRoomId, getRoomsByUid, createRoom };
