import {
  $,
  updateAllMessageTimes,
  updateReadStatus,
  createMessage,
  findMessageElementByTimestamp,
  updateMembersList,
  showError,
  showSystemMessage,
  showEmptyStateInChat,
  updateRoomList
} from '../ui/common.js';

export const userInfo = {
  token     : localStorage.getItem('token'),
  uid       : parseInt(localStorage.getItem('uid')),
  nickname  : localStorage.getItem('nickname'),
  lastRoomId: parseInt(localStorage.getItem('lastRoomId')),
}

const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

let ws = null;
let rooms = [];
let messages = [];
let isConnecting = false;
let reconnectAttempts = 0;
let timeUpdateInterval = null;

export let roomData = {};
export let userDetailsMap = {};
export let currentRoomId = userInfo.lastRoomId;

export function escapeHtml(unsafe) {
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

export function formatTime(timestamp) {
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

export async function fetchRooms() {
  const response = await fetch('/api/room', {
    headers: {
      'Authorization': userInfo.token
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

export function connectWebSocket() {
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
    token: userInfo.token,
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

export function switchRoom(rid) {
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

export function sendMessage() {
  const $messageInput = $('#message-input');
  const message = $messageInput.value.trim();
  if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;

  // 发送消息
  ws.send(JSON.stringify({
    type: 'message',
    token: userInfo.token,
    rid: currentRoomId,
    content: message
  }));

  $messageInput.value = '';
}

function startTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
  timeUpdateInterval = setInterval(updateAllMessageTimes, 10000);
}

export function unload() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  // 正常关闭WebSocket连接
  normalClose = true;
  if (ws) {
    ws.close();
  }
}

export async function initCore() {
  // try {
    rooms = await fetchRooms();

    if (rooms.length === 0) {
      showEmptyStateInChat();
    } else {
      if (!currentRoomId) {
        currentRoomId = rooms[0].rid;
      }
      updateRoomList(rooms);
      connectWebSocket();
    }
  // } catch (error) {
  //   showError(error.message);
  // }
}