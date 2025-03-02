const input = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');
const backButton = document.getElementById('back-button');
const roomDrawer = document.getElementById('room-drawer');
const overlay = document.getElementById('overlay');
const closeDrawerBtn = document.getElementById('close-drawer');

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

// 存储当前用户信息
let currentUser = null;
let currentRoom = null;

let timeUpdateInterval;

function initDrawer() {
  backButton.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
}

function openDrawer() {
  roomDrawer.classList.add('open');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden'; // 防止背景滚动
}

function closeDrawer() {
  roomDrawer.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
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
  input.focus();
}

function connectWebSocket() {
  ws = new WebSocket(`ws://${window.location.host}/ws`);

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

          // 更新房间名称
          document.querySelector('.room-title').textContent = currentRoom.name;
          document.querySelector('.room-name').textContent = currentRoom.name;

          input.disabled = false;
          sendButton.disabled = false;
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
    sendButton.disabled = true;

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

// 键盘高度调整（针对移动设备）
function handleKeyboard() {
  // 在iOS上，当键盘弹出时，视窗高度会变化
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    window.visualViewport.addEventListener('resize', () => {
      const messageBox = document.querySelector('.message-input-area');
      messageBox.style.bottom = `${window.innerHeight - window.visualViewport.height}px`;
    });
  }

  // 焦点切换时平滑滚动到底部
  input.addEventListener('focus', () => {
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 300);
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化抽屉菜单
  initDrawer();

  // 处理键盘适配
  handleKeyboard();

  // 绑定发送按钮事件
  sendButton.addEventListener('click', sendMessage);

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

// 监听设备方向变化，调整UI
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 300);
});