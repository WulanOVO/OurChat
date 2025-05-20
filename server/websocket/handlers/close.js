const broadcast = require('../utils/broadcast');

function wsOnClose(ws, users) {
  const user = users.get(ws);
  if (!user) {
    return;
  }

  users.delete(ws);

  broadcast('userLeave', { uid: user.uid }, user, users);
}

module.exports = wsOnClose;
