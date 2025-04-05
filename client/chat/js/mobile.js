'use strict';

document.addEventListener('DOMContentLoaded', initMobileUI);

function initMobileUI() {
  // 获取DOM元素
  const $sidebar = $('#sidebar');
  const $toggleSidebar = $('#toggle-sidebar');
  const $closeSidebar = $('#close-sidebar');
  const $overlay = $('#overlay');

  // 绑定侧边栏切换事件
  $toggleSidebar.addEventListener('click', () => {
    $sidebar.classList.add('active');
    $overlay.classList.add('visible');
  });

  // 绑定侧边栏关闭事件
  $closeSidebar.addEventListener('click', () => {
    $sidebar.classList.remove('active');
    $overlay.classList.remove('visible');
  });

  // 点击遮罩层关闭所有面板
  $overlay.addEventListener('click', (e) => {
    if (e.target === $overlay) {
      $sidebar.classList.remove('active');
      closeRoomInfo();
      closeReadUsersPopup();
    }
  });

  // 重写房间点击事件，额外添加侧边栏关闭逻辑
  const $roomItems = $('.room-item', false);
  $roomItems.forEach(item => {
    const originalClickEvent = item.onclick;
    item.onclick = null;

    item.addEventListener('click', (e) => {
      const rid = parseInt(item.dataset.rid);
      switchRoom(rid);
      $sidebar.classList.remove('active');
      $overlay.classList.remove('visible');
    });
  });

  // 更多移动优化：双击顶部滚动到最新消息
  const $chatHeader = $('.chat-header')[0];
  $chatHeader.addEventListener('dblclick', () => {
    const $chatMessages = $('#chat-messages');
    $chatMessages.scrollTop = $chatMessages.scrollHeight;
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

  // 添加触摸支持：下拉刷新聊天记录
  const $chatMessages = $('#chat-messages');
  let touchStartY = 0;
  let touchEndY = 0;
  const refreshTriggerDistance = 80; // 触发刷新的下拉距离

  $chatMessages.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  $chatMessages.addEventListener('touchmove', (e) => {
    touchEndY = e.touches[0].clientY;
  }, { passive: true });

  $chatMessages.addEventListener('touchend', (e) => {
    if ($chatMessages.scrollTop === 0 && touchEndY - touchStartY > refreshTriggerDistance) {
      // 用户在顶部下拉超过指定距离，刷新聊天记录
      showSystemMessage('正在刷新聊天记录...');

      // 如果有WebSocket连接，重新加载历史记录
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'history',
          rid: currentRoomId
        }));
      }
    }

    // 重置触摸位置
    touchStartY = 0;
    touchEndY = 0;
  }, { passive: true });

  // 拦截长触事件用于消息操作（未来可扩展）
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.message')) {
      e.preventDefault(); // 阻止默认上下文菜单
      // 未来可以在这里添加长按操作，如复制、删除等
    }
  });

  // 动态调整输入框高度
  autoAdjustInputHeight();

  // 修复已读用户弹窗
  fixReadUsersPopup();
}

// 自动调整输入框高度的功能
function autoAdjustInputHeight() {
  const $messageInput = $('#message-input');

  $messageInput.addEventListener('input', function() {
    const maxHeight = 100; // 输入框最大高度

    // 重置高度以获取正确的scrollHeight
    this.style.height = 'auto';

    // 限制最大高度
    if (this.scrollHeight <= maxHeight) {
      this.style.height = this.scrollHeight + 'px';
    } else {
      this.style.height = maxHeight + 'px';
    }
  });
}

// 修复移动端已读用户弹窗
function fixReadUsersPopup() {
  // 拦截原始的showReadUsers函数
  const originalShowReadUsers = window.showReadUsers;

  if (originalShowReadUsers) {
    window.showReadUsers = function(readByIds) {
      // 先移除任何已有弹窗
      const $existingPopup = document.querySelector('.read-users-popup');
      if ($existingPopup) {
        $existingPopup.remove();
      }

      // 调用原始函数创建弹窗
      originalShowReadUsers(readByIds);

      // 添加移动端特定处理
      const $popup = document.querySelector('.read-users-popup');
      if ($popup) {
        // 确保弹窗有正确的移动端类名
        if (document.body.classList.contains('mobile')) {
          $popup.classList.add('mobile');
        }

        // 重新绑定关闭按钮事件，确保在移动端正确关闭
        const $closeBtn = $popup.querySelector('.close-popup');
        if ($closeBtn) {
          $closeBtn.onclick = null;
          $closeBtn.addEventListener('click', (e) => {
            closeReadUsersPopup();
            e.stopPropagation();
          });
        }

        // 点击弹窗外部区域关闭
        $popup.addEventListener('click', (e) => {
          if (e.target === $popup) {
            closeReadUsersPopup();
          }
        });
      }
    };
  }

  // 拦截原始的closeReadUsersPopup函数
  const originalCloseReadUsersPopup = window.closeReadUsersPopup;

  if (originalCloseReadUsersPopup) {
    window.closeReadUsersPopup = function() {
      // 调用原始函数
      originalCloseReadUsersPopup();

      // 还原滚动和焦点
      document.body.style.overflow = '';
    };
  }
}