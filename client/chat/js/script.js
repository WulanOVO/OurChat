const input = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

// 存储当前用户信息
let currentUser = null;
let currentRoom = null;

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
      rid: 1  // 这里可以根据实际需求修改
    }));
  };

  function createMessage(message) {
    const messageDiv = document.createElement('div');
    const isMyMessage = message.sender === currentUser?.uid;

    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

    const senderInfo = currentRoom?.members.find(m => m.uid === message.sender);
    const displayName = senderInfo?.nickname || '未知用户';

    messageDiv.innerHTML = `
      <div class="username">${escapeHtml(displayName)}</div>
      <div class="content">${escapeHtml(message.content)}</div>
      <div class="message-info">
        <span class="timestamp">${formatTime(message.timestamp)}</span>
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
    } else { // 其他情况
      return date.toLocaleString('zh-CN', { hour12: false });
    }
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'user':
        currentUser = data.user;
        currentRoom = data.roomData;

        document.querySelector('.room-name').textContent = currentRoom.name;
        input.disabled = false;

        // 更新在线成员列表
        updateMembersList(currentRoom.members);
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
        const messageElement = createMessage(data);
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 发送已读回执
        ws.send(JSON.stringify({
          type: 'read',
          timestamp: data.timestamp
        }));
        break;

      case 'user_joined':
        showSystemMessage(`${data.user.nickname} 加入了聊天室`);
        break;

      case 'user_left':
        const leftUser = currentRoom.members.find(m => m.uid === data.uid);
        if (leftUser) {
          showSystemMessage(`${leftUser.nickname} 离开了聊天室`);
        }
        break;

      case 'error':
        console.error('错误:', data.message);
        showError(data.message);
        break;

      default:
        console.log('未知的消息类型:', data.type);
    }
  };

  function showSystemMessage(message) {
    const div = document.createElement('div');
    div.className = 'message system-message';
    div.innerHTML = `<div class="content">${escapeHtml(message)}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }

  function updateMembersList(members) {
    const membersList = document.querySelector('.members-list');
    if (membersList) {
      membersList.innerHTML = members.map(member => `
        <div class="member-item">
          <div class="member-avatar"></div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(member.nickname)}</div>
            <div class="member-role">${member.role}</div>
          </div>
        </div>
      `).join('');
    }
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

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.querySelector('button').addEventListener('click', sendMessage);

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket连接已断开');
    input.disabled = true;

    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, reconnectDelay);
    } else {
      showError('连接已断开，请刷新页面重试');
    }
  };
}

// 启动WebSocket连接
connectWebSocket();