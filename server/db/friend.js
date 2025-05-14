const { db } = require('./connection');
const { createRoom } = require('./room');

async function getFriendList(uid) {
  const dbFriendships = db.collection('friendships');

  const friendList = await dbFriendships
    .find({
      $or: [
        { user1: { uid }, user2: { uid } },
        { user1: { uid: uid }, user2: { uid: uid } },
      ],
    })
    .toArray();

  return friendList.map(friendPair => {
    delete friendPair._id;
    return friendPair;
  });
}

async function addFriend(uid1, uid2) {
  // 调整顺序，保证 uid1 小于 uid2
  if (uid1 > uid2) {
    [uid1, uid2] = [uid2, uid1];
  }

  const dbFriendships = db.collection('friendships');

  const friendship = await dbFriendships.findOne({
    user1: { uid: uid1 },
    user2: { uid: uid2 },
    status: 'accepted',
  });

  if (friendship) {
    throw new Error('已存在好友关系');
  } else {
    const result = await dbFriendships.insertOne({
      user1: { uid: uid1 },
      user2: { uid: uid2 },
      status: 'accepted',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const roomData = await createRoom(
      `${uid1}和${uid2}的对话`,
      'private',
      [
        { uid: uid1, role: 'admin', nickname: uid1.toString() },
        { uid: uid2, role: 'admin', nickname: uid2.toString() },
      ],
      false
    );

    await dbFriendships.updateOne(
      { _id: result.insertedId },
      { $set: { room: roomData.rid } }
    );

    const newFriendship = await dbFriendships.findOne({
      _id: result.insertedId,
    });
    delete newFriendship._id;

    return { friendship: newFriendship, room: roomData };
  }
}

module.exports = {
  getFriendList,
  addFriend,
};
