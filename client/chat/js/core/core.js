import {
  setRoomTitle,
  createMessage,
  updateRoomList,
  getMessageInput,
  setActiveRoomUI,
  updateReadStatus,
  showNotification,
  appendChatMessage,
  clearChatMessages,
  clearMessageInput,
  updateMembersList,
  updateLastMessage,
  scrollChatToBottom,
  showEmptyStateInChat,
  updateAllMessageTimes,
  findMessageElementByTimestamp,
} from '../ui/common.js';

export const TOKEN = localStorage.getItem('token');
export const UID = parseInt(localStorage.getItem('uid'));
export const NICKNAME = localStorage.getItem('nickname');
export const LAST_ROOM_ID = localStorage.getItem('lastRoomId');

const reconnectDelay = 3000;
const maxReconnectAttempts = 5;

let ws = null;
let rooms = [];
let messages = [];
let normalClose = false;
let isConnecting = false;
let reconnectAttempts = 0;
let timeUpdateInterval = null;

export let roomInfo = {};
export let userDetailsMap = {};
export let currentRoomId = LAST_ROOM_ID;

export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  return unsafe
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;

  if (diff < 60 * 1000) {
    // 小于1分钟
    return '刚刚';
  } else if (diff < 3600 * 1000) {
    // 小于1小时
    return `${Math.floor(diff / 60 / 1000)}分钟前`;
  } else if (date.getDate() === now.getDate()) {
    // 同一天
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  } else if (now - date < 86400 * 7 * 1000) {
    // 一周内
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${days[date.getDay()]} ${date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } else if (date.getFullYear() === now.getFullYear()) {
    // 同一年
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } else {
    // 其他情况
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }
}

async function fetchRooms() {
  const response = await fetch('/api/room', {
    headers: {
      Authorization: TOKEN,
    },
  });

  const data = await response.json();

  if (data.code === 'SUCCESS') {
    return data.data.roomList;
  } else if (data.code === 'UNAUTHORIZED') {
    window.location.href = '/login';
  } else {
    throw new Error(data.message);
  }
}

export function connectWebSocket() {
  if (isConnecting) return;
  isConnecting = true;

  closeWebSocket();
  ws = new WebSocket(`ws://${window.location.host}/ws`);

  ws.onopen = wsOnOpen;
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.event) {
      case 'room':
        wsOnRoom(data);
        break;
      case 'history':
        wsOnHistory(data);
        break;
      case 'message':
        wsOnMessage(data);
        break;
      case 'updateRead':
        wsOnUpdateRead(data);
        break;
      case 'userJoin':
        wsOnUserJoin(data);
        break;
      case 'userLeave':
        wsOnUserLeave(data);
        break;
      case 'error':
        showNotification(data.message, 'error');
        break;
    }
  };
  ws.onerror = wsOnError;
  ws.onclose = wsOnClose;
}

function closeWebSocket(isNormalClose = true) {
  if (ws) {
    normalClose = isNormalClose;
    ws.close();
    ws = null;
  }
}

function wsOnOpen() {
  isConnecting = false;
  reconnectAttempts = 0;

  clearChatMessages();

  ws.send(
    JSON.stringify({
      event: 'join',
      token: TOKEN,
      rid: currentRoomId,
    })
  );

  startTimeUpdates();
}

function wsOnRoom(data) {
  roomInfo = data.data;

  roomInfo.members.forEach((member) => {
    const { uid, ...rest } = member;
    userDetailsMap[uid] = rest;
  });

  setRoomTitle(roomInfo.name);

  updateMembersList();
}

function wsOnHistory(data) {
  messages = data.data;

  clearChatMessages();

  messages.forEach((messageData) => {
    appendChatMessage(createMessage(messageData));
  });

  scrollChatToBottom(false);

  // 发送已读回执
  if (messages.length > 0) {
    ws.send(
      JSON.stringify({
        event: 'read',
      })
    );
  }
}

function wsOnMessage(data) {
  const messageData = data.data;

  appendChatMessage(createMessage(messageData));
  updateLastMessage(currentRoomId, messageData);
  scrollChatToBottom();

  if (document.visibilityState === 'visible') {
    ws.send(
      JSON.stringify({
        event: 'read',
      })
    );
  }
}

function wsOnUpdateRead(data) {
  const messageData = data.data;

  messageData.forEach((message) => {
    const messageElement = findMessageElementByTimestamp(message.timestamp);
    if (messageElement) {
      updateReadStatus(messageElement, message.readBy);
    }
  });
}

function wsOnUserJoin(data) {
  const { uid } = data.data;

  userDetailsMap[uid].online = true;

  if (uid !== UID) {
    showNotification(`${userDetailsMap[uid].nickname}加入了房间`, 'info');
  }

  updateMembersList();
}

function wsOnUserLeave(data) {
  const { uid } = data.data;

  userDetailsMap[uid].online = false;
  if (uid !== UID) {
    showNotification(`${userDetailsMap[uid].nickname}离开了房间`, 'info');
  }

  updateMembersList();
}

function wsOnError(error) {
  console.error('WebSocket错误:', error);
  isConnecting = false;
}

function wsOnClose() {
  isConnecting = false;

  stopTimeUpdates();

  // 只有在非正常关闭且未达到最大重连次数时才重连
  if (!normalClose && reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    setTimeout(connectWebSocket, reconnectDelay);
  } else if (reconnectAttempts >= maxReconnectAttempts) {
    showNotification('连接已断开，请刷新页面重试', 'error');
  }

  // 重置正常关闭标记
  normalClose = false;
}

export function switchRoom(roomId) {
  if (isConnecting || roomId === currentRoomId) return;

  currentRoomId = roomId;
  localStorage.setItem('lastRoomId', currentRoomId);

  setActiveRoomUI(currentRoomId);
  clearChatMessages();
  closeWebSocket();

  // 重置重连计数器
  reconnectAttempts = 0;

  connectWebSocket();
}

export function sendMessage() {
  const message = getMessageInput();
  if (!message || !isConnected()) return;

  if (message.length > 1000) {
    showNotification('消息长度不能超过1000字符', 'error');
    return;
  }

  ws.send(
    JSON.stringify({
      event: 'message',
      type: 'text',
      content: message,
    })
  );

  clearMessageInput();
}

function startTimeUpdates() {
  stopTimeUpdates();
  timeUpdateInterval = setInterval(updateAllMessageTimes, 10000);
}

function stopTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}

// 处理页面可见性变化
export function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    closeWebSocket();
  } else if (document.visibilityState === 'visible') {
    connectWebSocket();
  }
}

export async function initCore() {
  try {
    rooms = await fetchRooms();

    if (rooms.length === 0) {
      showEmptyStateInChat();
    } else {
      if (!currentRoomId) {
        currentRoomId = rooms[0].rid;
      }

      updateRoomList(rooms);
      connectWebSocket();

      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// 在unload函数中移除事件监听
export function unload() {
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  stopTimeUpdates();
  closeWebSocket();
}
