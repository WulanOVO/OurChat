const express = require('express');
const http = require('http');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/user', require('./routes/user'));
app.use('/api/login', require('./routes/login'));
app.use('/api/room', require('./routes/room'));
app.use('/api/message', require('./routes/message'));

app.use('/', express.static('./client'));

const server = http.createServer(app);
server.listen(80, () => {
  console.log('HTTP 服务器已启动');
});

// 初始化WebSocket服务
require('./websocket/socket')(server);