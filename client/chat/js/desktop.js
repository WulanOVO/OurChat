import { nickname, initCore, unload, sendMessage } from './core/core.js';
import {
  $,
  openRoomInfo,
  closeRoomInfo,
  closeReadUsersPopup
} from './ui/common.js';

function initDesktopUI() {
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

  $('#overlay').addEventListener('click', e => {
    if (e.target === $('#overlay')) {
      closeRoomInfo();
      closeReadUsersPopup();
    }
  });
}

initCore();
document.addEventListener('DOMContentLoaded', initDesktopUI);
window.addEventListener('unload', unload);
