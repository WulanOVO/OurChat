import { nickname, initCore, unload, sendMessage } from './core/core.js';
import {
  $,
  openRoomInfo,
  closeRoomInfo,
  closeReadUsersPopup,
} from './ui/common.js';

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#overlay').classList.add('visible');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('visible');
}

function initMobileUI() {
  const $toggleSidebar = $('#toggle-sidebar');
  const $closeSidebar = $('#close-sidebar');
  const $overlay = $('#overlay');

  $toggleSidebar.addEventListener('click', () => {
    openSidebar();
  });

  $closeSidebar.addEventListener('click', () => {
    closeSidebar();
  });

  // 点击遮罩层关闭所有面板
  $overlay.addEventListener('click', e => {
    if (e.target === $overlay) {
      closeSidebar();
      closeRoomInfo();
      closeReadUsersPopup();
    }
  });

  const $messageInput = $('#message-input');
  $messageInput.addEventListener('focus', () => {
    // 短暂延迟后滚动到底部，解决移动键盘弹出后的视图问题
    setTimeout(() => {
      const $chatMessages = $('#chat-messages');
      $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }, 300);
  });

  $('.user-nickname')[0].textContent = nickname;
  $('.user-avatar')[0].textContent = nickname[0];

  $('#send-message-btn').addEventListener('click', sendMessage);
  $('#message-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $('#room-info-button').addEventListener('click', openRoomInfo);
  $('#close-room-info').addEventListener('click', closeRoomInfo);
}

initCore();
document.addEventListener('DOMContentLoaded', initMobileUI);
window.addEventListener('unload', unload);
