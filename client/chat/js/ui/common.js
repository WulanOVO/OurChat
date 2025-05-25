import {
  UID,
  roomInfo,
  formatTime,
  escapeHtml,
  switchRoom,
  currentRoomId,
  userDetailsMap,
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
  const $roomList = $('#room-list');
  $roomList.innerHTML = '';

  if (rooms.length === 0) {
    showEmptyStateInChat();
    return;
  }

  rooms.forEach((roomInfo) => {
    const $room = document.createElement('div');
    $room.className = `room-item ${
      roomInfo.rid === currentRoomId ? 'active' : ''
    }`;
    $room.dataset.rid = roomInfo.rid;

    // 处理最后一条消息显示
    let lastMessageText = '点击进入聊天';
    if (roomInfo.lastMessage) {
      const { content, type, senderId } = roomInfo.lastMessage;
      lastMessageText = senderId === UID ? `我: ${content}` : content;

      // 限制显示长度
      if (lastMessageText.length > 20) {
        lastMessageText = lastMessageText.substring(0, 20) + '...';
      }
    }

    $room.innerHTML = `
      <div class="room-avatar">${roomInfo.name[0]}</div>
      <div class="room-info">
        <div class="room-name">${escapeHtml(roomInfo.name)}</div>
        <div class="room-last-message">${escapeHtml(lastMessageText)}</div>
      </div>
    `;

    $room.addEventListener('click', () => {
      switchRoom(roomInfo.rid);
    });

    $roomList.appendChild($room);
  });
}

export function createMessage(messageData) {
  const isMyMessage = messageData.senderId === UID;

  const $message = document.createElement('div');
  $message.className = `message ${
    isMyMessage ? 'my-message' : 'other-message'
  }`;

  const senderInfo = roomInfo.members?.find(
    (m) => m.uid === messageData.senderId
  );
  const displayName = senderInfo?.nickname || '未知用户';

  $message.innerHTML = `
    <div class="username">${escapeHtml(displayName)}</div>
    <div class="content">${escapeHtml(messageData.content)}</div>
    <div class="message-info">
      <span class="timestamp" data-timestamp="${
        messageData.createdAt
      }">${formatTime(messageData.createdAt)}</span>
      <span class="read-status" data-read-by='${JSON.stringify(
        messageData.readBy || []
      )}'>${messageData.readBy?.length || 1}人已读</span>
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

export function showNotification(message, type) {
  const $notificationsContainer = $('#notifications-container');

  const $notification = document.createElement('div');
  $notification.className = `notification ${type || 'info'}`;
  $notification.innerHTML = `<div class="notification-content">${escapeHtml(
    message
  )}</div>`;

  $notificationsContainer.appendChild($notification);

  // 给DOM更新的时间，然后添加'show'类触发动画
  setTimeout(() => {
    $notification.classList.add('show');
  }, 10);

  // 3秒后自动移除
  setTimeout(() => {
    $notification.classList.remove('show');
    $notification.classList.add('hide');

    // 动画完成后从DOM中移除
    setTimeout(() => {
      $notification.remove();
    }, 500); // 动画持续时间
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
  closeReadUsersPopup();

  const $popup = document.createElement('div');
  $popup.id = 'read-users-popup';

  // 确保有用户信息
  if (!readByIds || readByIds.length === 0) {
    readByIds = [UID];
  }

  // 根据用户ID获取用户信息
  const readByUsers = readByIds.map((id) => {
    const member = roomInfo.members?.find((m) => m.uid === id);
    return {
      uid: id,
      nickname: member?.nickname || '未知用户',
    };
  });

  // 按昵称字母顺序排序用户列表
  const sortedReadBy = [...readByUsers].sort((a, b) => {
    // 当前用户始终排在最前面
    if (a.uid === UID) return -1;
    if (b.uid === UID) return 1;

    // 按昵称字母顺序排序
    return (a.nickname || '').localeCompare(b.nickname || '');
  });

  const userList = sortedReadBy
    .map((user) => {
      const isCurrentUser = user.uid === UID;
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
    <div id="popup-content">
      <div id="popup-header">
        <h3>已读用户 (${readByIds.length})</h3>
        <button class="btn close-btn">&times;</button>
      </div>
      <div id="popup-body">
        ${userList}
      </div>
    </div>
  `;

  // 添加关闭按钮事件
  const closeButton = $popup.querySelector('.close-btn');
  closeButton.addEventListener('click', () => closeReadUsersPopup());

  $('#app-container').appendChild($popup);

  showOverlay();
}

export function closeReadUsersPopup() {
  const $popup = $('#read-users-popup', false);
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
  const $roomNameDisplay = $('#room-name-display');
  if ($roomNameDisplay) {
    $roomNameDisplay.textContent = roomInfo.name;
  }

  const $roomAvatar = $('#room-info-avatar .room-avatar.large')[0];
  if ($roomAvatar) {
    $roomAvatar.textContent = roomInfo.name[0];
  }

  const $memberCount = $('.member-count')[0];
  if ($memberCount) {
    $memberCount.textContent = roomInfo.members.length;
  }

  updateMembersList();
}

export function updateMembersList() {
  const $roomMembersList = $('#room-members-list');
  if (!$roomMembersList) return;

  $roomMembersList.innerHTML = '';

  // 记录在线用户数量
  let onlineCount = 0;

  // 按当前用户在最前面，然后是在线用户，最后是离线用户排序
  const sortedMembers = [...roomInfo.members].sort((a, b) => {
    // 当前用户始终排在最前面
    if (a.uid === UID) return -1;
    if (b.uid === UID) return 1;

    // 在线用户排在离线用户前面
    const aOnline = userDetailsMap[a.uid]?.online || false;
    const bOnline = userDetailsMap[b.uid]?.online || false;

    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    // 按昵称字母顺序排序
    return a.nickname.localeCompare(b.nickname);
  });

  sortedMembers.forEach((member) => {
    const $memberItem = document.createElement('div');
    $memberItem.className = 'member-item';

    // 判断是否为当前用户，当前用户始终显示为在线
    const isCurrentUser = member.uid === UID;
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
      <div class="user-avatar">${member.nickname[0]}</div>
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
    $memberCount.textContent = `${onlineCount}/${roomInfo.members.length}`;
  }
}

export function updateAllMessageTimes() {
  const $timestamps = $('.timestamp', false);
  if (!$timestamps) return;

  $timestamps.forEach((element) => {
    const timestamp = parseInt(element.dataset.timestamp);
    if (timestamp) {
      element.textContent = formatTime(timestamp);
    }
  });
}

export function findMessageElementByTimestamp(timestamp) {
  const $chatMessages = $('#chat-messages');

  const $messages = $chatMessages.getElementsByClassName('message');
  const $message = Array.from($messages).find(($msg) => {
    const messageTimestamp = parseInt(
      $msg.querySelector('.timestamp').dataset.timestamp
    );
    return messageTimestamp === timestamp;
  });

  if ($message) {
    return $message;
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
    <div id="empty-chat-state">
      <div id="empty-icon">💬</div>
      <div id="empty-text">没有可用的聊天房间</div>
      <div id="empty-subtext">请联系管理员创建房间</div>
    </div>
  `;

  $('#room-list').innerHTML = '';
  $('#room-title').innerHTML = '没有可用的聊天房间';

  const $roomInfoButton = $('#room-info-button');
  $roomInfoButton.style.visibility = 'hidden';

  const $toggleSidebarBtn = $('#toggle-sidebar-btn');
  if ($toggleSidebarBtn) {
    $toggleSidebarBtn.disabled = true;
  }

  const $messageInput = $('#message-input');
  $messageInput.disabled = true;
  $messageInput.placeholder = '没有可用的聊天房间';

  $('#send-message-btn').disabled = true;
}

export function clearChatMessages() {
  const $chatMessages = $('#chat-messages');
  if ($chatMessages) {
    $chatMessages.innerHTML = '';
  }
}

export function setRoomTitle(title) {
  const $roomTitle = $('#room-title');
  $roomTitle.textContent = escapeHtml(title);
}

export function appendChatMessage(messageElement) {
  const $chatMessages = $('#chat-messages');
  if ($chatMessages) {
    $chatMessages.appendChild(messageElement);
  }
}

export function scrollChatToBottom(useAnimation = true) {
  const $chatMessages = $('#chat-messages');
  if (useAnimation) {
    $chatMessages.scrollTo({
      top: $chatMessages.scrollHeight,
      behavior: 'smooth',
    });
  } else {
    $chatMessages.scrollTop = $chatMessages.scrollHeight;
  }
}

export function setActiveRoomUI(newRoomId) {
  const $activeRoom = $('.room-item.active', false)?.[0];
  if ($activeRoom) {
    $activeRoom.classList.remove('active');
  }

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
