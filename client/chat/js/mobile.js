'use strict';

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
  $overlay.addEventListener('click', (e) => {
    if (e.target === $overlay) {
      closeSidebar();
      closeRoomInfo();
      closeReadUsersPopup();
    }
  });

  // 处理输入框获取焦点时页面调整
  const $messageInput = $('#message-input');
  $messageInput.addEventListener('focus', () => {
    // 短暂延迟后滚动到底部，解决移动键盘弹出后的视图问题
    setTimeout(() => {
      const $chatMessages = $('#chat-messages');
      $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }, 300);
  });
}

document.addEventListener('DOMContentLoaded', initMobileUI);
