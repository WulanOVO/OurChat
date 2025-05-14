const expireTime = 10 * 60 * 1000;
let availableFriendCodes = {
  '1145': {
    uid: 1,
    createdAt: Date.now(),
  },
};

function generateFriendCode(uid) {
  // 检查是否已经创建过好友码
  for (const code of Object.keys(availableFriendCodes)) {
    if (availableFriendCodes[code].uid === uid) {
      return code;
    }
  }

  let code = '';

  do {
    // 根据当前好友码数量决定生成4位或6位随机数字符串
    const codeLength = Object.keys(availableFriendCodes).length > 50 ? 6 : 4;
    const maxNum = codeLength === 6 ? 1000000 : 10000;

    // 生成随机数字符串
    code = Math.floor(Math.random() * maxNum)
      .toString()
      .padStart(codeLength, '0');
  } while (availableFriendCodes[code]);

  availableFriendCodes[code] = {
    uid,
    createdAt: Date.now(),
  };

  return code;
}

function verifyFriendCode(code, reqUid) {
  cleanExpiredFriendCodes();

  if (!availableFriendCodes[code]) {
    return null;
  }

  const friendUid = availableFriendCodes[code].uid;
  if (friendUid !== reqUid) {
    delete availableFriendCodes[code];
  }

  return friendUid;
}

function cleanExpiredFriendCodes() {
  const currentTime = Date.now();

  Object.keys(availableFriendCodes).forEach(code => {
    if (currentTime - availableFriendCodes[code].createdAt > expireTime) {
      delete availableFriendCodes[code];
    }
  });
}

setInterval(() => {
  cleanExpiredFriendCodes();
}, 10 * 60 * 1000);

module.exports = {
  generateFriendCode,
  verifyFriendCode,
};
