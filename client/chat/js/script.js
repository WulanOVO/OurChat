'use strict';

let elementCache = {};

function $(selector, useCache = true) {
  if (useCache && elementCache[selector]) {
    return elementCache[selector];
  }

  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) {
    return null;
  }

  if (
    elements.length === 1 &&
    selector.indexOf('.') === -1
  ) {
    if (useCache) elementCache[selector] = elements[0];
    return elements[0];
  }

  if (useCache) elementCache[selector] = elements;

  return elements;
}

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}
const uid = parseInt(localStorage.getItem('uid'));
const nickname = localStorage.getItem('nickname');
const lastRoomId = parseInt(localStorage.getItem('lastRoomId'));
let currentRoomId = lastRoomId;

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

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;

  if (diff < 60 * 1000) {
    // 小于1分钟
    return '刚刚';
  }
  else if (diff < 3600 * 1000) {
    // 小于1小时
    return `${Math.floor(diff / 60 / 1000)}分钟前`;
  }
  else if (date.getDate() === now.getDate()) {
    // 同一天
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }
  else if (now - date < 86400 * 7 * 1000) {
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

async function fetchRooms() {
  const response = await fetch('/api/room', {
    headers: {
      'Authorization': token
    }
  });

  const data = await response.json();
  if (data.code === 'SUCCESS') {
    return data.data;
  } else if (data.code === 'UNAUTHORIZED') {
    window.location.href = '/login';
  } else {
    throw new Error(data.message);
  }
}

function updateRoomList(rooms) {
  const $roomList = $('.room-list')[0];
  $roomList.innerHTML = '';

  if (rooms.length === 0) {
    showEmptyStateInChat();
    return;
  }

  rooms.forEach(room => {
    const $room = document.createElement('div');
    $room.className = `room-item ${room.rid === currentRoomId ? 'active' : ''}`;
    $room.dataset.rid = room.rid;

    $room.innerHTML = `
      <div class="room-avatar">${room.name[0]}</div>
      <div class="room-info">
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-last-message">点击进入聊天</div>
      </div>
    `;

    $room.addEventListener('click', () => {
      switchRoom(room.rid);
    });

    $roomList.appendChild($room);
  });
}

function createMessage(messageData) {
  const isMyMessage = messageData.sender === uid;

  const $message = document.createElement('div');
  $message.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

  const senderInfo = roomData.members?.find(m => m.uid === messageData.sender);
  const displayName = senderInfo?.nickname || '未知用户';

  $message.innerHTML = `
    <div class="username">${escapeHtml(displayName)}</div>
    <div class="content">${escapeHtml(messageData.content)}</div>
    <div class="message-info">
      <span class="timestamp" data-timestamp="${messageData.timestamp}">${formatTime(messageData.timestamp)}</span>
      <span class="read-status" data-read-by='${JSON.stringify(messageData.read_by || [])}'>${messageData.read_by?.length || 1}人已读</span>
    </div>
  `;

  // 添加已读用户点击事件
  const $readStatus = $message.querySelector('.read-status');
  if ($readStatus) {
    $readStatus.addEventListener('click', () => {
      const readByIds = JSON.parse($readStatus.dataset.readBy);
      showReadUsers(readByIds);
    });
  }

  return $message;
}

function showError(message) {
  const $notifications = $('.notifications-container')[0];

  const $error = document.createElement('div');
  $error.className = 'notification error';
  $error.textContent = message;

  // 将新消息插入到容器的开头，实现消息从上到下排列
  if ($notifications.firstChild) {
    $notifications.insertBefore($error, $notifications.firstChild);
  } else {
    $notifications.appendChild($error);
  }

  // 3秒后自动移除
  setTimeout(() => {
    if ($error && $error.parentNode) {
      $error.remove();
    }
  }, 3000);
}

function showSystemMessage(message) {
  const $notifications = $('.notifications-container')[0];

  const $systemMessage = document.createElement('div');
  $systemMessage.className = 'notification system';
  $systemMessage.textContent = message;

  // 将新消息插入到容器的开头，实现消息从上到下排列
  if ($notifications.firstChild) {
    $notifications.insertBefore($systemMessage, $notifications.firstChild);
  } else {
    $notifications.appendChild($systemMessage);
  }

  // 3秒后自动移除系统消息
  setTimeout(() => {
    if ($systemMessage && $systemMessage.parentNode) {
      $systemMessage.remove();
    }
  }, 3000);
}

function showOverlay() {
  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.add('visible');
  }
}

function hideOverlay() {
  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.remove('visible');
  }
}

function showReadUsers(readByIds) {
  const $existingPopup = document.querySelector('.read-users-popup');
  if ($existingPopup) {
    $existingPopup.remove();
  }

  const $popup = document.createElement('div');
  $popup.className = 'read-users-popup';

  // 确保有用户信息
  if (!readByIds || readByIds.length === 0) {
    readByIds = [uid];
  }

  // 根据用户ID获取用户信息
  const readByUsers = readByIds.map(id => {
    const member = roomData.members?.find(m => m.uid === id);
    return {
      uid: id,
      nickname: member?.nickname || '未知用户'
    };
  });

  // 按昵称字母顺序排序用户列表
  const sortedReadBy = [...readByUsers].sort((a, b) => {
    // 当前用户始终排在最前面
    if (a.uid === uid) return -1;
    if (b.uid === uid) return 1;

    // 按昵称字母顺序排序
    return (a.nickname || '').localeCompare(b.nickname || '');
  });

  const userList = sortedReadBy.map(user => {
    const isCurrentUser = user.uid === uid;
    return `
      <div class="read-user">
        <span class="user-avatar">${(user.nickname || '?')[0].toUpperCase()}</span>
        <span class="user-name">${escapeHtml(user.nickname || '未知用户')}${isCurrentUser ? ' (我)' : ''}</span>
      </div>
    `;
  }).join('');

  $popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <h3>已读用户 (${readByIds.length})</h3>
        <button class="close-popup">&times;</button>
      </div>
      <div class="popup-body">
        ${userList}
      </div>
    </div>
  `;

  // 添加关闭按钮事件
  const closeButton = $popup.querySelector('.close-popup');
  closeButton.addEventListener('click', () => closeReadUsersPopup());

  $('.app-container')[0].appendChild($popup);

  showOverlay();
}

function closeReadUsersPopup() {
  const $popup = $('.read-users-popup')[0];
  if ($popup) {
    $popup.remove();
  }

  hideOverlay();
}

function openRoomInfo() {
  updateRoomInfo();

  const $roomInfoPanel = $('#room-info-panel');
  if ($roomInfoPanel) {
    $roomInfoPanel.classList.add('open');
  }

  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.add('visible');
  }
}

function closeRoomInfo() {
  const $roomInfoPanel = $('#room-info-panel');
  if ($roomInfoPanel) {
    $roomInfoPanel.classList.remove('open');
  }

  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.remove('visible');
  }
}

function updateRoomInfo() {
  const $roomNameDisplay = $('.room-name-display')[0];
  if ($roomNameDisplay) {
    $roomNameDisplay.textContent = roomData.name;
  }

  const $roomAvatar = $('#room-info-panel .room-avatar.large')[0];
  if ($roomAvatar) {
    $roomAvatar.textContent = roomData.name[0];
  }

  const $memberCount = $('.member-count')[0];
  if ($memberCount) {
    $memberCount.textContent = roomData.members.length;
  }

  updateMembersList();
}

function updateMembersList() {
  const $roomMembersList = $('.room-members-list')[0];
  if (!$roomMembersList) return;

  $roomMembersList.innerHTML = '';

  // 记录在线用户数量
  let onlineCount = 0;

  // 按当前用户在最前面，然后是在线用户，最后是离线用户排序
  const sortedMembers = [...roomData.members].sort((a, b) => {
    // 当前用户始终排在最前面
    if (a.uid === uid) return -1;
    if (b.uid === uid) return 1;

    // 在线用户排在离线用户前面
    const aOnline = userDetailsMap[a.uid]?.online || false;
    const bOnline = userDetailsMap[b.uid]?.online || false;

    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    // 按昵称字母顺序排序
    return a.nickname.localeCompare(b.nickname);
  });

  sortedMembers.forEach(member => {
    const $memberItem = document.createElement('div');
    $memberItem.className = 'member-item';

    // 判断是否为当前用户，当前用户始终显示为在线
    const isCurrentUser = member.uid === uid;
    let isOnline = false;
    if (
      isCurrentUser ||
      userDetailsMap[member.uid]?.online
    ) {
      isOnline = true;
    }

    if (isOnline) {
      onlineCount++;
    }

    const statusText = isOnline ? '在线' : '离线';
    const statusClass = isOnline ? 'online' : 'offline';

    $memberItem.innerHTML = `
      <div class="member-avatar">${member.nickname[0]}</div>
      <div class="member-info">
        <div class="member-nickname">${escapeHtml(member.nickname)}${isCurrentUser ? ' (我)' : ''}</div>
        <div class="member-status ${statusClass}">${statusText}</div>
      </div>
    `;

    $roomMembersList.appendChild($memberItem);
  });

  // 更新在线人数显示
  const $memberCount = $('.member-count')[0];
  if ($memberCount) {
    $memberCount.textContent = `${onlineCount}/${roomData.members.length}`;
  }
}

// 更新所有消息时间
function updateAllMessageTimes() {
  const $timestamps = $('.timestamp', false);
  $timestamps.forEach(element => {
    const timestamp = parseInt(element.dataset.timestamp);
    if (timestamp) {
      element.textContent = formatTime(timestamp);
    }
  });
}

let timeUpdateInterval;
function startTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
  timeUpdateInterval = setInterval(updateAllMessageTimes, 10000);
}

// 查找消息元素
function findMessageElementByTimestamp(timestamp) {
  const $chatMessages = $('#chat-messages');
  if (!$chatMessages) return null;

  const $messages = $chatMessages.getElementsByClassName('message');
  for (const $message of $messages) {
    const $timestamp = $message.querySelector('.timestamp');
    if ($timestamp && $timestamp.dataset.timestamp === timestamp) {
      return $message;
    }
  }

  return null;
}

// 更新已读状态
function updateReadStatus($message, readByIds) {
  const $readStatus = $message.querySelector('.read-status');
  if ($readStatus) {
    $readStatus.textContent = `${readByIds.length}人已读`;
    $readStatus.dataset.readBy = JSON.stringify(readByIds);
  }
}

function showEmptyStateInChat() {
  const $chatMessages = $('#chat-messages');
  if (!$chatMessages) return;

  $chatMessages.innerHTML = `
    <div class="empty-chat-state">
      <div class="empty-icon">💬</div>
      <div class="empty-text">没有可用的聊天房间</div>
      <div class="empty-subtext">请联系管理员创建房间</div>
    </div>
  `;

  // 禁用输入框
  const $messageInput = $('#message-input');
  if ($messageInput) {
    $messageInput.disabled = true;
    $messageInput.placeholder = '没有可用的聊天房间';
  }
}

// #region WebSocket

let ws = null;
let messages = [];
let roomData = {};
let userDetailsMap = {};
let isConnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

function connectWebSocket() {
  if (isConnecting) return;
  isConnecting = true;

  if (ws) ws.close();
  ws = null;

  const $chatMessages = $('#chat-messages');
  $chatMessages.innerHTML = '';

  ws = new WebSocket(`ws://${window.location.host}/ws`);

  ws.onopen = wsOnOpen;
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'room': wsOnRoom(data); break;
      case 'history': wsOnHistory(data); break;
      case 'chat': wsOnChat(data); break;
      case 'updateRead': wsOnUpdateRead(data); break;
      case 'userStatus': wsOnUserStatus(data); break;
      case 'error': showError(data.message); break;
    }
  };
  ws.onerror = wsOnError;
  ws.onclose = wsOnClose;
}

function wsOnOpen(event) {
  console.log('wsOnOpen', event);
  isConnecting = false;
  reconnectAttempts = 0;

  const $chatMessages = $('#chat-messages');
  $chatMessages.innerHTML = '';

  ws.send(JSON.stringify({
    type: 'join',
    token,
    rid: currentRoomId
  }));

  startTimeUpdates();
}

function wsOnRoom(data) {
  console.log('wsOnRoom', data);
  roomData = data.data;

  roomData.members.forEach(member => {
    const { uid, ...rest } = member;
    userDetailsMap[uid] = rest;
  });

  $('.room-title')[0].textContent = roomData.name;

  updateMembersList();
}

function wsOnHistory(data) {
  console.log('wsOnHistory', data);
  messages = data.data;

  const $chatMessages = $('#chat-messages');
  $chatMessages.innerHTML = '';

  messages.forEach(messageData => {
    const $message = createMessage(messageData);
    $chatMessages.appendChild($message);
  });

  $chatMessages.scrollTop = $chatMessages.scrollHeight;

  // 发送已读回执
  if (messages.length > 0) {
    ws.send(JSON.stringify({
      type: 'read',
      timestamp: new Date().getTime()
    }));
  }
}

function wsOnChat(data) {
  console.log('wsOnChat', data);
  const messageData = data.data;

  const $message = createMessage(messageData);
  const $chatMessages = $('#chat-messages');
  $chatMessages.appendChild($message);
  $chatMessages.scrollTop = $chatMessages.scrollHeight;

  ws.send(JSON.stringify({
    type: 'read',
    timestamp: new Date().getTime()
  }));
}

function wsOnUpdateRead(data) {
  data.messages.forEach(msg => {
    const messageElement = findMessageElementByTimestamp(msg.timestamp);
    if (messageElement) {
      updateReadStatus(messageElement, msg.read_by);
    }
  });
}

// 处理用户状态更新
function wsOnUserStatus(data) {
  console.log('wsOnUserStatus', data);
  const { uid, online } = data.data;

  // 更新用户状态映射
  if (!userDetailsMap[uid]) {
    userDetailsMap[uid] = {};
  }
  userDetailsMap[uid].online = online;

  // 更新UI显示
  updateMembersList();

  // 显示系统通知
  if (roomData.members) {
    const member = roomData.members.find(m => m.uid === uid);
    if (member) {
      const statusText = online ? '上线了' : '离线了';
      showSystemMessage(`${member.nickname} ${statusText}`);
    }
  }
}

function wsOnError(error) {
  console.error('WebSocket错误:', error);
  isConnecting = false;
}

// 保存最后一次正常关闭的标记
let normalClose = false;
function wsOnClose(event) {
  console.log('wsOnClose', event);
  isConnecting = false;

  // 清除时间更新定时器
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  // 只有在非正常关闭且未达到最大重连次数时才重连
  if (!normalClose && reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    setTimeout(connectWebSocket, reconnectDelay);
  } else if (reconnectAttempts >= maxReconnectAttempts) {
    showError('连接已断开，请刷新页面重试');
  }

  // 重置正常关闭标记
  normalClose = false;
}

function switchRoom(rid) {
  if (isConnecting || rid === currentRoomId) return;

  currentRoomId = rid;
  localStorage.setItem('lastRoomId', currentRoomId);

  const $activeRoom = $('.room-item.active', false)?.[0];
  if ($activeRoom) {
    $activeRoom.classList.remove('active');
  }

  const $newActiveRoom = $(`.room-item[data-rid="${currentRoomId}"]`, false)[0];
  if ($newActiveRoom) {
    $newActiveRoom.classList.add('active');
  }

  $('#chat-messages').innerHTML = '';

  // 正常关闭旧连接然后重新连接
  normalClose = true;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  // 重置重连计数器
  reconnectAttempts = 0;
  connectWebSocket();
}

function sendMessage() {
  const $messageInput = $('#message-input');
  const message = $messageInput.value.trim();
  if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;

  // 发送消息
  ws.send(JSON.stringify({
    type: 'message',
    token,
    rid: currentRoomId,
    content: message
  }));

  $messageInput.value = '';
}

// #endregion

function initDOM() {
  $('.user-nickname')[0].textContent = nickname;
  $('.user-avatar')[0].textContent = nickname[0];

  $('#send-message-btn').addEventListener('click', sendMessage);
  $('#message-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $('#room-info-button').addEventListener('click', openRoomInfo);
  $('#close-room-info').addEventListener('click', closeRoomInfo);

  $('#overlay').addEventListener('click', (e) => {
    if (e.target === $('#overlay')) {
      closeRoomInfo();
      closeReadUsersPopup();
    }
  });
}

function unload() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  // 正常关闭WebSocket连接
  normalClose = true;
  if (ws) {
    ws.close();
  }
}

let rooms = [];

(async () => {
  try {
    rooms = await fetchRooms();

    if (rooms.length === 0) {
      showEmptyStateInChat();
    } else {
      updateRoomList(rooms);
      connectWebSocket();
    }
  } catch (error) {
    showError(error.message);
  }
})();

document.addEventListener('DOMContentLoaded', initDOM);
window.addEventListener('unload', unload);