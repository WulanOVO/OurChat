function getPrivateRoomName(roomInfo, uid) {
  let name = '未知好友';
  const members = roomInfo.members;
  members.forEach((member) => {
    if (member.uid !== uid) {
      name = member.nickname || '未知好友';
    }
  });
  return name;
}

module.exports = { getPrivateRoomName };
