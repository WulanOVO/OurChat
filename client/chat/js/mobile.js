// 声明变量但不立即获取DOM元素
let input;
let chatMessages;
let sendButton;
let backButton;
let roomDrawer;
let overlay;
let closeDrawerBtn;
let nicknameElement;
let userAvatarElement;

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

// 存储当前用户信息
let currentUser = null;
let currentRoom = null;
let userDetailsMap = {}; // 添加用户详情映射表
let userRooms = []; // 存储用户的房间列表
let currentRoomId = null; // 当前选中的房间ID
let isConnecting = false; // 标记是否正在连接WebSocket

let timeUpdateInterval;

// 初始化DOM元素引用
function initDOMElements() {
  input = document.getElementById('message-input');
  chatMessages = document.getElementById('chat-messages');
  sendButton = document.getElementById('send-button');
  backButton = document.getElementById('back-button');
  roomDrawer = document.getElementById('room-drawer');
  overlay = document.getElementById('overlay');
  closeDrawerBtn = document.getElementById('close-drawer');
  nicknameElement = document.querySelector('.user-nickname');
  userAvatarElement = document.querySelector('.user-avatar');

  // 设置用户信息
  if (nicknameElement) {
    nicknameElement.textContent = localStorage.getItem('nickname');
  }

  if (userAvatarElement) {
    userAvatarElement.textContent = localStorage.getItem('nickname')[0];
  }
}

// 获取用户的房间列表
async function fetchRooms() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

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
      userRooms = result.data;

      // 如果有房间
      if (userRooms.length > 0) {
        // 尝试从localStorage获取上次选择的房间ID
        const savedRoomId = parseInt(localStorage.getItem('lastRoomId'));

        // 检查保存的房间ID是否仍然有效
        const roomExists = userRooms.some(room => room.rid === savedRoomId);

        if (roomExists) {
          currentRoomId = savedRoomId;
        } else {
          currentRoomId = userRooms[0].rid;
        }

        updateRoomList();
        connectWebSocket();
      } else {
        // 没有可用房间时，显示提示信息而不是报错
        updateRoomListWithEmptyState();
        showEmptyStateInChat();
      }
    } else {
      throw new Error(result.message || '获取房间列表失败');
    }
  } catch (error) {
    console.error('获取房间列表错误:', error);
    showError(error.message);
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

  // 更新房间标题
  const roomTitle = document.querySelector('.room-title');
  if (roomTitle) {
    roomTitle.textContent = '无可用房间';
  }
}

// 在聊天区域显示空状态提示
function showEmptyStateInChat() {
  if (!chatMessages) return;

  chatMessages.innerHTML = `
    <div class="empty-chat-state">
      <div class="empty-icon">💬</div>
      <div class="empty-text">没有可用的聊天房间</div>
      <div class="empty-subtext">请联系管理员创建房间</div>
    </div>
  `;

  // 禁用输入框和发送按钮
  if (input) {
    input.disabled = true;
    input.placeholder = '没有可用的聊天房间';
  }

  if (sendButton) {
    sendButton.disabled = true;
  }
}

function initDrawer() {
  if (backButton) {
    backButton.addEventListener('click', function(e) {
      e.preventDefault();
      openDrawer();
    });
  }

  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeDrawer);
  }

  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
  }
}

function openDrawer() {
  if (roomDrawer) {
    roomDrawer.classList.add('open');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
  }

  if (overlay) {
    overlay.classList.add('visible');
  }
}

function closeDrawer() {
  if (roomDrawer) {
    roomDrawer.classList.remove('open');
  }

  if (overlay) {
    overlay.classList.remove('visible');
  }

  document.body.style.overflow = ''; // 恢复背景滚动
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
  if (!input) return;

  const content = input.value.trim();
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
  chatMessages.appendChild(tempElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // 发送消息到服务器
  try {
    ws.send(JSON.stringify({
      type: 'message',
      content
    }));

    // 清空输入框
    input.value = '';
    input.focus();
  } catch (err) {
    console.error('发送消息失败:', err);
    showError('发送消息失败，请重试');

    // 移除临时消息
    tempElement.remove();
  }
}

function connectWebSocket() {
  // 如果已经在连接中，则不重复连接
  if (isConnecting || !chatMessages) return;
  isConnecting = true;

  // 清理之前的WebSocket连接
  if (ws) {
    // 关闭之前的连接前先移除事件监听器，防止重复触发事件
    const oldWs = ws;
    ws = null;

    if (input) input.disabled = true;
    if (sendButton) sendButton.disabled = true;

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
  chatMessages.innerHTML = '';

  // 添加连接中提示
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'system-message';
  loadingMessage.textContent = '正在连接到聊天服务器...';
  chatMessages.appendChild(loadingMessage);

  const wsPath = '/ws';  // 与服务器端配置保持一致
  ws = new WebSocket(`ws://${window.location.host}${wsPath}`);

  ws.onopen = () => {
    isConnecting = false;
    reconnectAttempts = 0;

    // 清除连接中提示
    chatMessages.innerHTML = '';

    // 保存当前选择的房间ID
    localStorage.setItem('lastRoomId', currentRoomId);

    ws.send(JSON.stringify({
      type: 'join',
      token,
      rid: currentRoomId
    }));

    // 启动时间更新
    startTimeUpdates();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'user':
          currentUser = data.user;
          currentRoom = data.roomData;
          userDetailsMap = data.userDetailsMap || {}; // 保存用户详情映射表

          // 更新房间名称
          const roomTitle = document.querySelector('.room-title');
          if (roomTitle) {
            roomTitle.textContent = currentRoom.name;
          }

          if (input) input.disabled = false;
          if (sendButton) sendButton.disabled = false;
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
          // 检查是否是自己发送的消息，如果是则移除临时消息
          if (data.sender === currentUser?.uid) {
            const tempMessages = chatMessages.querySelectorAll('.temp-message');
            tempMessages.forEach(el => el.remove());
          }

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
    if (input) input.disabled = true;
    if (sendButton) sendButton.disabled = true;
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
  if (!chatMessages) return null;

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
  if (!input || !chatMessages) return;

  // 在iOS上，当键盘弹出时，视窗高度会变化
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    window.visualViewport.addEventListener('resize', () => {
      const messageBox = document.querySelector('.message-input-area');
      if (messageBox) {
        messageBox.style.bottom = `${window.innerHeight - window.visualViewport.height}px`;
      }
    });
  }

  // 焦点切换时平滑滚动到底部
  input.addEventListener('focus', () => {
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 300);
  });
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

  const userList = readBy.map(user => `
    <div class="read-user">
      <span class="user-avatar">${(user.nickname || '?')[0].toUpperCase()}</span>
      <span class="user-name">${escapeHtml(user.nickname)}</span>
    </div>
  `).join('');

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
  closeButton.addEventListener('click', () => popup.remove());

  // 点击弹窗外部关闭
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  });

  document.body.appendChild(popup);
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

    // 关闭抽屉菜单
    closeDrawer();
  } else {
    // 如果点击当前房间，且连接正常，刷新消息
    if (ws && ws.readyState === WebSocket.OPEN && chatMessages) {
      chatMessages.innerHTML = '';
      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'system-message';
      loadingMessage.textContent = '正在刷新消息...';
      chatMessages.appendChild(loadingMessage);

      // 使用join消息类型重新加入房间，服务器会返回最新消息
      const token = localStorage.getItem('token');
      ws.send(JSON.stringify({
        type: 'join',
        token,
        rid: currentRoomId
      }));

      // 关闭抽屉菜单
      closeDrawer();
    }
  }
}

// 添加临时消息的样式
function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .temp-message {
      opacity: 0.7;
    }
    .temp-message::after {
      content: "发送中...";
      font-size: 12px;
      color: #999;
      display: block;
      text-align: right;
      margin-top: 4px;
    }

    /* 空状态样式 */
    .empty-room-state, .empty-chat-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      height: 100%;
      color: #666;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-text {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .empty-subtext {
      font-size: 14px;
      color: #999;
    }

    .empty-room-state {
      height: auto;
      min-height: 150px;
    }

    .empty-chat-state {
      min-height: 300px;
    }
  `;
  document.head.appendChild(style);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 首先初始化DOM元素引用
  initDOMElements();

  // 初始化抽屉菜单
  initDrawer();

  // 添加临时消息样式
  addStyles();

  // 绑定发送按钮事件
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }

  // 绑定输入框回车事件
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // 处理键盘弹出的问题
  handleKeyboard();

  // 先获取房间列表，然后连接WebSocket
  fetchRooms();
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
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }, 300);
});