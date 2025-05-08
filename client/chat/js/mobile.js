import { nickname, initCore, unload, sendMessage } from './core/core.js';
import {
  $,
  openRoomInfo,
  closeRoomInfo,
  scrollChatToBottom,
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
  $('#toggle-sidebar-btn').addEventListener('click', () => {
    openSidebar();
  });

  $('#close-sidebar-btn').addEventListener('click', () => {
    closeSidebar();
  });

  $('#message-input').addEventListener('focus', () => {
    scrollChatToBottom();
  });

  $('#user-info > div.user-avatar')[0].textContent = nickname[0];
  $('#user-info > div.user-nickname')[0].textContent = nickname;

  $('#send-message-btn').addEventListener('click', sendMessage);
  $('#message-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $('#room-info-button').addEventListener('click', openRoomInfo);
  $('#close-room-info').addEventListener('click', closeRoomInfo);

  $('#overlay').addEventListener('click', e => {
    if (e.target === $('#overlay')) {
      closeSidebar();
      closeReadUsersPopup();
    }
  });
}

initCore();
document.addEventListener('DOMContentLoaded', initMobileUI);
window.addEventListener('unload', unload);
