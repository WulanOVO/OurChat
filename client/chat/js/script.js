const input = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const userNameElement = document.querySelector('.user-name');
const userAvatarElement = document.querySelector('.user-avatar');

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

// 存储当前用户信息
let currentUser = null;
let currentRoom = null;

let timeUpdateInterval;

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

// 全局函数，用于创建消息元素
function createMessage(message) {
  console.log('创建消息元素:', message);
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
      <span class="read-status">${message.read_by?.length || 1}人已读</span>
    </div>
  `;

  return messageDiv;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) { // 小于1分钟
    return '刚刚';
  } else if (diff < 3600000) { // 小于1小时
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (date.getDate() === now.getDate()) { // 同一天
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } else if (now - date < 86400000 * 7) { // 一周内
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${days[date.getDay()]} ${date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}`;
  } else if (date.getFullYear() === now.getFullYear()) { // 同一年
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } else { // 其他情况
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
  const content = input.value.trim();
  if (!content || !currentUser) return;

  ws.send(JSON.stringify({
    type: 'message',
    content
  }));

  input.value = '';
}

function connectWebSocket() {
  const wsPath = '/ws';  // 与服务器端配置保持一致
  ws = new WebSocket(`ws://${window.location.host}${wsPath}`);

  ws.onopen = () => {
    console.log('WebSocket连接已建立');
    reconnectAttempts = 0;

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    ws.send(JSON.stringify({
      type: 'join',
      token,
      rid: 1
    }));

    // 启动时间更新
    startTimeUpdates();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('收到消息:', data.type, data);

      switch (data.type) {
        case 'user':
          currentUser = data.user;
          currentRoom = data.roomData;

          // 更新用户信息
          userNameElement.textContent = currentUser.nickname || '未知用户';
          userAvatarElement.textContent = (currentUser.nickname || '?')[0].toUpperCase();

          // 更新房间名称
          const roomNameElements = document.querySelectorAll('.room-name');
          roomNameElements.forEach(el => {
            el.textContent = currentRoom.name;
          });

          input.disabled = false;
          break;

        case 'history':
          chatMessages.innerHTML = '';
          data.messages.forEach((message) => {
            chatMessages.appendChild(createMessage(message));
          });
          chatMessages.scrollTop = chatMessages.scrollHeight;

          // 发送已读回执
          if (data.messages.length > 0) {
            ws.send(JSON.stringify({
              type: 'read',
              timestamp: data.messages[data.messages.length - 1].timestamp
            }));
          }
          break;

        case 'chat':
          console.log('收到聊天消息:', data);
          const messageElement = createMessage(data);
          chatMessages.appendChild(messageElement);
          chatMessages.scrollTop = chatMessages.scrollHeight;

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
          break;

        default:
          console.log('未知的消息类型:', data.type);
      }
    } catch (err) {
      console.error('处理消息错误:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket连接已断开');
    input.disabled = true;

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

function updateReadStatus(messageElement, readBy) {
  const readStatusElement = messageElement.querySelector('.read-status');
  if (readStatusElement) {
    readStatusElement.textContent = `${readBy.length}人已读`;
  }
}

function findMessageElementByTimestamp(timestamp) {
  const messages = chatMessages.getElementsByClassName('message');
  for (const message of messages) {
    const timestampElement = message.querySelector('.timestamp');
    if (timestampElement && timestampElement.dataset.timestamp === timestamp) {
      return message;
    }
  }
  return null;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 绑定发送按钮事件
  document.querySelector('button').addEventListener('click', sendMessage);

  // 绑定输入框回车事件
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 启动WebSocket连接
  connectWebSocket();
});

// 页面卸载时清理定时器
window.addEventListener('unload', () => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});