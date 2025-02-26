const input = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');

const ws = new WebSocket('http://localhost:3000/ws');

function sendMessage() {
  const message = input.value.trim();

  if (message) {
    input.value = '';

    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);

    const data = {
      type: 'chat',
      room,
      username,
      content: message
    };

    ws.send(JSON.stringify(data));
  }
}

function createMessage(data) {
  const message = document.createElement('div');

  if (data.username === username) {
    message.className ='message my-message';
  } else {
    message.className ='message other-message';
  }

  message.innerHTML =
    `<div class="username">${data.username}</div>
     <div class="content">${data.content}</div>`;
  return message;
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'chat') {
    chatMessages.appendChild(createMessage(data));
  }
};


document.getElementById('message-input')
  .addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });