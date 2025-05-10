const expireTime = 10 * 60 * 1000;
let availableFriendCodes = {};

function generateFriendCode(uid) {
  // 检查是否已经创建过好友码
  for (const code of Object.keys(availableFriendCodes)) {
    if (availableFriendCodes[code].uid === uid) {
      return code;
    }
  }

  let code = '';

  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (
    // 排除包含1、I、0、O的组合，防止混淆
    code.includes('1') ||
    code.includes('I') ||
    code.includes('0') ||
    code.includes('O')
  );

  availableFriendCodes[code] = {
    uid,
    createdAt: Date.now()
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
  verifyFriendCode
};
