const appContainer = document.querySelector('.app-container');
const inputElement = document.getElementById('message-input');
const messagesElement = document.getElementById('chat-messages');
const nicknameElement = document.querySelector('.user-nickname');
const userAvatarElement = document.querySelector('.user-avatar');
const roomInfoButton = document.getElementById('room-info-button');
const roomInfoPanel = document.getElementById('room-info-panel');
const closeRoomInfoButton = document.getElementById('close-room-info');
const overlayElement = document.getElementById('overlay');
const roomNameDisplay = document.querySelector('.room-name-display');
const memberCountElement = document.querySelector('.member-count');
const roomMembersList = document.querySelector('.room-members-list');
const sendButton = document.querySelector('button');

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}

const savedRoomId = parseInt(localStorage.getItem('lastRoomId'));

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

let currentUser = null;
let currentRoom = null;
let userDetailsMap = {};
let userRooms = [];
let currentRoomId = null;
let isConnecting = false;

let timeUpdateInterval;

// 打开群组详情页
function openRoomInfo() {
  if (!currentRoom) return;

  updateRoomInfo();

  if (roomInfoPanel) {
    roomInfoPanel.classList.add('open');
  }

  if (overlayElement) {
    overlayElement.classList.add('visible');
  }
}

// 关闭群组详情页
function closeRoomInfo() {
  if (roomInfoPanel) {
    roomInfoPanel.classList.remove('open');
  }

  if (overlayElement) {
    overlayElement.classList.remove('visible');
  }
}

// 更新群组详情
function updateRoomInfo() {
  if (!currentRoom) return;

  // 更新群组名称和头像
  if (roomNameDisplay) {
    roomNameDisplay.textContent = currentRoom.name;
  }

  const roomAvatar = roomInfoPanel.querySelector('.room-avatar.large');
  if (roomAvatar) {
    roomAvatar.textContent = currentRoom.name[0];
  }

  // 更新成员数量
  if (memberCountElement) {
    memberCountElement.textContent = currentRoom.members.length;
  }

  // 更新成员列表
  updateMembersList();
}

// 更新成员列表
function updateMembersList() {
  if (!roomMembersList || !currentRoom) return;

  roomMembersList.innerHTML = '';

  // 记录在线用户数量
  let onlineCount = 0;

  // 先对成员进行排序：当前用户在最前面，然后是在线用户，最后是离线用户
  const sortedMembers = [...currentRoom.members].sort((a, b) => {
    // 当前用户始终排在最前面
    if (a.uid === currentUser?.uid) return -1;
    if (b.uid === currentUser?.uid) return 1;

    // 在线用户排在离线用户前面
    const aOnline = userDetailsMap[a.uid]?.online || false;
    const bOnline = userDetailsMap[b.uid]?.online || false;

    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    // 按昵称字母顺序排序
    return a.nickname.localeCompare(b.nickname);
  });

  sortedMembers.forEach(member => {
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';

    // 判断是否为当前用户，当前用户始终显示为在线
    const isCurrentUser = member.uid === currentUser?.uid;
    // 其他用户根据userDetailsMap中的状态判断
    const isOnline = isCurrentUser ? true : userDetailsMap[member.uid]?.online || false;

    if (isOnline) {
      onlineCount++;
    }

    const statusText = isOnline ? '在线' : '离线';
    const statusClass = isOnline ? 'online' : 'offline';

    memberItem.innerHTML = `
      <div class="member-avatar">${member.nickname[0]}</div>
      <div class="member-info">
        <div class="member-nickname">${escapeHtml(member.nickname)}${isCurrentUser ? ' (我)' : ''}</div>
        <div class="member-status ${statusClass}">${statusText}</div>
      </div>
    `;

    roomMembersList.appendChild(memberItem);
  });

  // 更新在线人数显示
  const memberCountHeader = roomInfoPanel.querySelector('.room-members-section h4');
  if (memberCountHeader) {
    memberCountHeader.textContent = `群组成员 (${onlineCount}/${currentRoom.members.length} 在线)`;
  }
}

// 获取用户的房间列表
async function fetchRooms() {
  const response = await fetch('/api/room', {
    headers: {
      'Authorization': token
    }
  });

  if (!response.ok) {
    throw new Error('获取房间列表失败');
  }

  const result = await response.json();
  if (result.code === 'SUCCESS') {
    return result.data;
  } else {
    throw new Error(result.message || '获取房间列表失败');
  }
}

// 更新房间列表UI
function updateRoomList() {
  const roomListElement = document.querySelector('.room-list');
  if (!roomListElement) return;

  roomListElement.innerHTML = '';

  userRooms.forEach(room => {
    const roomElement = document.createElement('div');
    roomElement.className = `room-item ${room.rid === currentRoomId ? 'active' : ''}`;
    roomElement.dataset.rid = room.rid;

    roomElement.innerHTML = `
      <div class="room-avatar">${room.name[0]}</div>
      <div class="room-info">
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-last-message">点击进入聊天</div>
      </div>
    `;

    roomElement.addEventListener('click', () => {
      switchRoom(room.rid);
    });

    roomListElement.appendChild(roomElement);
  });
}

// 在房间列表中显示空状态提示
function updateRoomListWithEmptyState() {
  const roomListElement = document.querySelector('.room-list');
  if (!roomListElement) return;

  roomListElement.innerHTML = `
    <div class="empty-room-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">没有可用的聊天房间</div>
      <div class="empty-subtext">请联系管理员创建房间</div>
    </div>
  `;
}

// 在聊天区域显示空状态提示
function showEmptyStateInChat() {
  if (!messagesElement) return;

  messagesElement.innerHTML = `
    <div class="empty-chat-state">
      <div class="empty-icon">💬</div>
      <div class="empty-text">没有可用的聊天房间</div>
      <div class="empty-subtext">请联系管理员创建房间</div>
    </div>
  `;

  // 禁用输入框
  if (inputElement) {
    inputElement.disabled = true;
    inputElement.placeholder = '没有可用的聊天房间';
  }
}

function updateAllMessageTimes() {
  const timestamps = document.querySelectorAll('.timestamp');
  timestamps.forEach(element => {
    const timestamp = element.dataset.timestamp;
    if (timestamp) {
      element.textContent = formatTime(timestamp);
    }
  });
}

function startTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  timeUpdateInterval = setInterval(updateAllMessageTimes, 10000);
}

function createMessage(message) {
  const messageDiv = document.createElement('div');

  // 确保消息数据格式正确
  if (!message || !message.sender) {
    console.error('消息数据格式不正确:', message);
    return messageDiv;
  }

  const isMyMessage = message.sender === currentUser?.uid;
  messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

  const senderInfo = currentRoom?.members.find(m => m.uid === message.sender);
  const displayName = senderInfo?.nickname || '未知用户';

  messageDiv.innerHTML = `
    <div class="username">${escapeHtml(displayName)}</div>
    <div class="content">${escapeHtml(message.content)}</div>
    <div class="message-info">
      <span class="timestamp" data-timestamp="${message.timestamp}">${formatTime(message.timestamp)}</span>
      <span class="read-status" data-read-by='${JSON.stringify(message.read_by || [])}'>${message.read_by?.length || 1}人已读</span>
    </div>
  `;

  // 添加点击事件监听器
  const readStatusElement = messageDiv.querySelector('.read-status');
  if (readStatusElement) {
    readStatusElement.addEventListener('click', () => {
      const readByIds = JSON.parse(readStatusElement.dataset.readBy);
      // 使用用户详情映射表转换ID为用户详情
      const readByDetails = readByIds.map(uid => userDetailsMap[uid] || { uid, nickname: '未知用户' });
      showReadUsers(readByDetails);
    });
  }

  return messageDiv;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    // 小于1分钟
    return '刚刚';
  }
  else if (diff < 3600000) {
    // 小于1小时
    return `${Math.floor(diff / 60000)}分钟前`;
  }
  else if (date.getDate() === now.getDate()) {
    // 同一天
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }
  else if (now - date < 86400000 * 7) {
    // 一周内
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${days[date.getDay()]} ${date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}`;
  }
  else if (date.getFullYear() === now.getFullYear()) {
    // 同一年
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  else {
    // 其他情况
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 3000);
}

function sendMessage() {
  if (!inputElement) return;

  const content = inputElement.value.trim();
  if (!content || !currentUser || !ws || ws.readyState !== WebSocket.OPEN) {
    if (!content) {
      console.log('消息内容为空，不发送');
    } else if (!currentUser) {
      console.log('用户未登录，不发送');
      showError('请先登录');
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket未连接，不发送');
      showError('连接已断开，请刷新页面');
    }
    return;
  }

  // 创建一个临时消息，立即显示在界面上
  const tempMessage = {
    sender: currentUser.uid,
    content: content,
    content_type: 'text',
    timestamp: new Date(),
    read_by: [currentUser.uid],
    isTemp: true // 标记为临时消息
  };

  // 添加临时消息到界面
  const tempElement = createMessage(tempMessage);
  tempElement.classList.add('temp-message');
  messagesElement.appendChild(tempElement);
  messagesElement.scrollTop = messagesElement.scrollHeight;

  // 发送消息到服务器
  try {
    ws.send(JSON.stringify({
      type: 'message',
      content
    }));

    // 清空输入框
    inputElement.value = '';
  } catch (err) {
    console.error('发送消息失败:', err);
    showError('发送消息失败，请重试');

    // 移除临时消息
    tempElement.remove();
  }
}

function connectWebSocket() {
  // 如果已经在连接中，则不重复连接
  if (isConnecting || !messagesElement) return;
  isConnecting = true;

  // 清理之前的WebSocket连接
  if (ws) {
    // 关闭之前的连接前先移除事件监听器，防止重复触发事件
    const oldWs = ws;
    ws = null;

    if (inputElement) {
      inputElement.disabled = true;
    }

    try {
      oldWs.onclose = null; // 移除onclose监听器，防止自动重连
      oldWs.onmessage = null; // 移除onmessage监听器
      oldWs.onerror = null; // 移除onerror监听器
      oldWs.close();
    } catch (err) {
      console.error('关闭旧连接失败:', err);
    }
  }

  // 在连接新WebSocket前清空消息区域
  messagesElement.innerHTML = '';

  // 添加连接中提示
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'system-message';
  loadingMessage.textContent = '正在连接到聊天服务器...';
  messagesElement.appendChild(loadingMessage);

  const wsPath = '/ws';
  ws = new WebSocket(`ws://${window.location.host}${wsPath}`);

  ws.onopen = () => {
    isConnecting = false;
    reconnectAttempts = 0;

    // 清除连接中提示
    messagesElement.innerHTML = '';

    // 保存当前选择的房间ID
    localStorage.setItem('lastRoomId', currentRoomId);

    ws.send(JSON.stringify({
      type: 'join',
      token,
      rid: currentRoomId
    }));

    startTimeUpdates();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('收到消息类型:', data.type, data);

      switch (data.type) {
        case 'user':
          currentUser = data.user;
          currentRoom = data.roomData;
          userDetailsMap = data.userDetailsMap || {}; // 保存用户详情映射表

          // 确保当前用户在userDetailsMap中标记为在线
          if (currentUser && !userDetailsMap[currentUser.uid]) {
            userDetailsMap[currentUser.uid] = { online: true };
          } else if (currentUser) {
            userDetailsMap[currentUser.uid].online = true;
          }

          // 更新房间名称
          const roomNameElements = document.querySelectorAll('.room-name');
          roomNameElements.forEach(el => {
            if (el.closest('.room-item')?.dataset.rid == currentRoomId) {
              el.textContent = currentRoom.name;
            }
          });

          // 更新房间标题
          const roomTitle = document.querySelector('.room-title');
          if (roomTitle) {
            roomTitle.textContent = currentRoom.name;
          }

          if (inputElement) {
            inputElement.disabled = false;
          }

          // 更新群组详情
          updateRoomInfo();
          break;

        case 'user_status':
          // 处理用户在线状态更新
          if (data.users && Array.isArray(data.users)) {
            data.users.forEach(user => {
              if (!userDetailsMap[user.uid]) {
                userDetailsMap[user.uid] = { online: user.online };
              } else {
                userDetailsMap[user.uid].online = user.online;
              }
            });

            // 如果当前正在显示群组详情，则更新成员列表
            if (roomInfoPanel && roomInfoPanel.classList.contains('open')) {
              updateMembersList();
            }
          }
          break;

        case 'history':
          messagesElement.innerHTML = '';
          data.messages.forEach((message) => {
            messagesElement.appendChild(createMessage(message));
          });
          messagesElement.scrollTop = messagesElement.scrollHeight;

          // 发送已读回执
          if (data.messages.length > 0) {
            ws.send(JSON.stringify({
              type: 'read',
              timestamp: data.messages[data.messages.length - 1].timestamp
            }));
          }
          break;

        case 'chat':
          // 检查是否是自己发送的消息，如果是则移除临时消息
          if (data.sender === currentUser?.uid) {
            const tempMessages = messagesElement.querySelectorAll('.temp-message');
            tempMessages.forEach(el => el.remove());
          }

          const messageElement = createMessage(data);
          messagesElement.appendChild(messageElement);
          messagesElement.scrollTop = messagesElement.scrollHeight;

          // 发送已读回执
          ws.send(JSON.stringify({
            type: 'read',
            timestamp: data.timestamp
          }));
          break;

        case 'read_status_update':
          data.messages.forEach(msg => {
            const messageElement = findMessageElementByTimestamp(msg.timestamp);
            if (messageElement) {
              updateReadStatus(messageElement, msg.read_by);
            }
          });
          break;

        case 'error':
          console.error('错误:', data.message);
          showError(data.message);
          isConnecting = false;
          break;

        default:
          console.log('未知的消息类型:', data.type);
      }
    } catch (err) {
      console.error('处理消息错误:', err, event.data);
      showError('处理消息错误');
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
    isConnecting = false;
  };

  ws.onclose = () => {
    if (inputElement) {
      inputElement.disabled = true;
    }
    isConnecting = false;

    // 清除时间更新定时器
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
    }

    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, reconnectDelay);
    } else {
      showError('连接已断开，请刷新页面重试');
    }
  };
}

function updateReadStatus(messageElement, readByIds) {
  const readStatusElement = messageElement.querySelector('.read-status');
  if (readStatusElement) {
    readStatusElement.textContent = `${readByIds.length}人已读`;
    readStatusElement.dataset.readBy = JSON.stringify(readByIds);
  }
}

function findMessageElementByTimestamp(timestamp) {
  if (!messagesElement) return null;

  const messages = messagesElement.getElementsByClassName('message');
  for (const message of messages) {
    const timestampElement = message.querySelector('.timestamp');
    if (timestampElement && timestampElement.dataset.timestamp === timestamp) {
      return message;
    }
  }

  return null;
}

// 添加显示已读用户列表的函数
function showReadUsers(readBy) {
  // 移除已存在的弹窗
  const existingPopup = document.querySelector('.read-users-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // 创建弹窗
  const popup = document.createElement('div');
  popup.className = 'read-users-popup';

  // 确保有用户信息
  if (!readBy || readBy.length === 0) {
    readBy = [{ uid: currentUser?.uid, nickname: currentUser?.nickname || '未知用户' }];
  }

  // 按昵称字母顺序排序用户列表
  const sortedReadBy = [...readBy].sort((a, b) => {
    // 当前用户始终排在最前面
    if (a.uid === currentUser?.uid) return -1;
    if (b.uid === currentUser?.uid) return 1;

    // 按昵称字母顺序排序
    return (a.nickname || '').localeCompare(b.nickname || '');
  });

  const userList = sortedReadBy.map(user => {
    const isCurrentUser = user.uid === currentUser?.uid;
    return `
      <div class="read-user">
        <span class="user-avatar">${(user.nickname || '?')[0].toUpperCase()}</span>
        <span class="user-name">${escapeHtml(user.nickname || '未知用户')}${isCurrentUser ? ' (我)' : ''}</span>
      </div>
    `;
  }).join('');

  popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <h3>已读用户 (${readBy.length})</h3>
        <button class="close-popup">&times;</button>
      </div>
      <div class="popup-body">
        ${userList}
      </div>
    </div>
  `;

  // 添加关闭按钮事件
  const closeButton = popup.querySelector('.close-popup');
  closeButton.addEventListener('click', () => closeReadUsersPopup());

  appContainer.appendChild(popup);

  // 显示遮罩层
  if (overlayElement) {
    overlayElement.classList.add('visible');
    overlayElement.addEventListener('click', closeReadUsersPopup, { once: true });
  }
}

// 关闭已读用户弹窗
function closeReadUsersPopup() {
  const popup = document.querySelector('.read-users-popup');
  if (popup) {
    popup.remove();
  }

  // 隐藏遮罩层（如果群组详情面板没有打开）
  if (overlayElement && !roomInfoPanel.classList.contains('open')) {
    overlayElement.classList.remove('visible');
  }
}

// 切换房间
function switchRoom(roomId) {
  if (isConnecting) return; // 如果正在连接中，忽略切换请求

  if (currentRoomId !== roomId) {
    currentRoomId = roomId;
    updateRoomList();

    // 保存当前选择的房间ID
    localStorage.setItem('lastRoomId', currentRoomId);

    // 断开并重新连接WebSocket
    connectWebSocket();
  } else {
    // 如果点击当前房间，且连接正常，刷新消息
    if (ws && ws.readyState === WebSocket.OPEN && messagesElement) {
      messagesElement.innerHTML = '';
      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'system-message';
      loadingMessage.textContent = '正在刷新消息...';
      messagesElement.appendChild(loadingMessage);

      // 使用join消息类型重新加入房间，服务器会返回最新消息
      const token = localStorage.getItem('token');
      ws.send(JSON.stringify({
        type: 'join',
        token,
        rid: currentRoomId
      }));
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  nicknameElement.textContent = localStorage.getItem('nickname');
  userAvatarElement.textContent = localStorage.getItem('nickname')[0];

  roomInfoButton.addEventListener('click', openRoomInfo);
  closeRoomInfoButton.addEventListener('click', closeRoomInfo);
  overlayElement.addEventListener('click', closeRoomInfo);
  sendButton.addEventListener('click', sendMessage);
  inputElement.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});

// 页面卸载时清理定时器
window.addEventListener('unload', () => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});