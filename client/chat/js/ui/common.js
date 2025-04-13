import {
  uid,
  roomData,
  userDetailsMap,
  formatTime,
  escapeHtml,
  currentRoomId,
  switchRoom
} from '../core/core.js';

let elementCache = {};

export function $(selector, useCache = true) {
  if (useCache && elementCache[selector]) {
    return elementCache[selector];
  }

  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) {
    return null;
  }

  if (elements.length === 1 && selector.indexOf('.') === -1) {
    if (useCache) elementCache[selector] = elements[0];
    return elements[0];
  }

  if (useCache) elementCache[selector] = elements;

  return elements;
}

export function updateRoomList(rooms) {
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
      if (typeof closeSidebar === 'function') {
        closeSidebar();
      }
      switchRoom(room.rid);
    });

    $roomList.appendChild($room);
  });
}

export function createMessage(messageData) {
  const isMyMessage = messageData.sender === uid;

  const $message = document.createElement('div');
  $message.className = `message ${
    isMyMessage ? 'my-message' : 'other-message'
  }`;

  const senderInfo = roomData.members?.find(m => m.uid === messageData.sender);
  const displayName = senderInfo?.nickname || '未知用户';

  $message.innerHTML = `
    <div class="username">${escapeHtml(displayName)}</div>
    <div class="content">${escapeHtml(messageData.content)}</div>
    <div class="message-info">
      <span class="timestamp" data-timestamp="${
        messageData.timestamp
      }">${formatTime(messageData.timestamp)}</span>
      <span class="read-status" data-read-by='${JSON.stringify(
        messageData.read_by || []
      )}'>${messageData.read_by?.length || 1}人已读</span>
    </div>
  `;

  // 添加已读用户点击事件
  const $readStatus = $message.querySelector('.read-status');
  if ($readStatus) {
    $readStatus.addEventListener('click', () => {
      const readByIds = JSON.parse($readStatus.dataset.readBy);
      showReadUsersPopup(readByIds);
    });
  }

  return $message;
}

export function showError(message) {
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

export function showSystemMessage(message) {
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

export function showOverlay() {
  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.add('visible');
  }
}

export function hideOverlay() {
  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.remove('visible');
  }
}

export function showReadUsersPopup(readByIds) {
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

  const userList = sortedReadBy
    .map(user => {
      const isCurrentUser = user.uid === uid;
      return `
      <div class="read-user">
        <span class="user-avatar">${(user.nickname ||
          '?')[0].toUpperCase()}</span>
        <span class="user-name">${escapeHtml(user.nickname || '未知用户')}${
        isCurrentUser ? ' (我)' : ''
      }</span>
      </div>
    `;
    })
    .join('');

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

export function closeReadUsersPopup() {
  const $popup = $('.read-users-popup', false)[0];
  if ($popup) {
    $popup.remove();
  }

  hideOverlay();
}

export function openRoomInfo() {
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

export function closeRoomInfo() {
  const $roomInfoPanel = $('#room-info-panel');
  if ($roomInfoPanel) {
    $roomInfoPanel.classList.remove('open');
  }

  const $overlay = $('#overlay');
  if ($overlay) {
    $overlay.classList.remove('visible');
  }
}

export function updateRoomInfo() {
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

export function updateMembersList() {
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
    if (isCurrentUser || userDetailsMap[member.uid]?.online) {
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
        <div class="member-nickname">${escapeHtml(member.nickname)}${
      isCurrentUser ? ' (我)' : ''
    }</div>
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

export function updateAllMessageTimes() {
  const $timestamps = $('.timestamp', false);
  $timestamps.forEach(element => {
    const timestamp = parseInt(element.dataset.timestamp);
    if (timestamp) {
      element.textContent = formatTime(timestamp);
    }
  });
}

export function findMessageElementByTimestamp(timestamp) {
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

export function updateReadStatus($message, readByIds) {
  const $readStatus = $message.querySelector('.read-status');
  if ($readStatus) {
    $readStatus.textContent = `${readByIds.length}人已读`;
    $readStatus.dataset.readBy = JSON.stringify(readByIds);
  }
}

export function showEmptyStateInChat() {
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

export function clearChatMessages() {
  const $chatMessages = $('#chat-messages');
  if ($chatMessages) {
    $chatMessages.innerHTML = '';
  }
}

export function setRoomTitle(title) {
  const $roomTitle = $('.room-title')?.[0];
  if ($roomTitle) {
    $roomTitle.textContent = escapeHtml(title);
  }
}

export function appendChatMessage(messageElement) {
  const $chatMessages = $('#chat-messages');
  if ($chatMessages) {
    $chatMessages.appendChild(messageElement);
  }
}

export function scrollChatToBottom() {
  const $chatMessages = $('#chat-messages');
  if ($chatMessages) {
    $chatMessages.scrollTop = $chatMessages.scrollHeight;
  }
}

export function setActiveRoomUI(newRoomId) {
  // 移除旧的 active 类
  const $activeRoom = $('.room-item.active', false)?.[0];
  if ($activeRoom) {
    $activeRoom.classList.remove('active');
  }

  // 添加新的 active 类
  const $newActiveRoom = $(`.room-item[data-rid="${newRoomId}"]`, false)?.[0];
  if ($newActiveRoom) {
    $newActiveRoom.classList.add('active');
  }
}

export function getMessageInput() {
  return $('#message-input').value.trim();
}

export function clearMessageInput() {
  const $messageInput = $('#message-input');
  if ($messageInput) {
    $messageInput.value = '';
  }
}
