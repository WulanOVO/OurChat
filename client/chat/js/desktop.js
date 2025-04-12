import {
  initCore,
  unload,
  userInfo,
  sendMessage
} from './core/core.js';
import {
  $,
  openRoomInfo,
  closeRoomInfo,
  closeReadUsersPopup
} from './ui/common.js';

function initDOM() {
  $('.user-nickname')[0].textContent = userInfo.nickname;
  $('.user-avatar')[0].textContent = userInfo.nickname[0];

  $('#send-message-btn').addEventListener('click', sendMessage);
  $('#message-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $('#room-info-button').addEventListener('click', openRoomInfo);
  $('#close-room-info').addEventListener('click', closeRoomInfo);

  $('#overlay').addEventListener('click', (e) => {
    if (e.target === $('#overlay')) {
      closeRoomInfo();
      closeReadUsersPopup();
    }
  });
}

initCore();
document.addEventListener('DOMContentLoaded', initDOM);
window.addEventListener('unload', unload);