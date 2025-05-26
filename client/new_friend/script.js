// 获取DOM元素
const friendCodeElement = document.getElementById('friend-code');
const expireTimeElement = document.getElementById('expire-time');
const refreshCodeButton = document.getElementById('refresh-code');
const addFriendForm = document.getElementById('add-friend-form');

let expireAt = 0;
// 存储倒计时定时器
let countdownTimer = null;

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}

// 获取好友码
async function getFriendCode(createNew = false) {
  try {
    const res = await fetch(`/api/friend/code?create_new=${createNew}`, {
      method: 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    if (res.ok) {
      friendCodeElement.textContent = data.data.friendCode;
      expireAt = data.data.expireAt;

      // 启动倒计时
      startCountdown();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('获取好友码失败:', error);
    friendCodeElement.textContent = '获取失败';
  }
}

// 启动倒计时
function startCountdown() {
  // 清除之前的定时器
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  // 更新倒计时显示
  function updateCountdown() {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = expireAt - now;

    if (timeLeft <= 0) {
      expireTimeElement.textContent = '已过期';
      clearInterval(countdownTimer);
      // 自动刷新好友码
      getFriendCode();
      return;
    }

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    expireTimeElement.textContent = `${minutes}分${seconds}秒后过期`;
  }

  // 立即更新一次
  updateCountdown();

  // 每秒更新一次
  countdownTimer = setInterval(updateCountdown, 1000);
}

// 添加好友
async function addFriend(friendCode) {
  try {
    const res = await fetch('/api/friend/add_friend_by_code', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ friendCode }),
    });

    const data = await res.json();

    if (res.ok) {
      alert('好友添加成功!');
      window.location.href = '/chat';
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('添加好友失败:', error);
    alert('添加好友失败，请稍后再试');
  }
}

// 事件监听
refreshCodeButton.addEventListener('click', () => getFriendCode(true));

addFriendForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(addFriendForm);
  const friendCode = formData.get('friendCode');

  if (!friendCode) {
    alert('请输入好友码');
    return;
  }

  await addFriend(friendCode);
});

// 页面加载时获取好友码
document.addEventListener('DOMContentLoaded', getFriendCode);
