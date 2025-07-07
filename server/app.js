require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api/user', require('./routes/user'));
app.use('/api/login', require('./routes/login'));
app.use('/api/room', require('./routes/room'));
app.use('/api/friend', require('./routes/friend'));
// app.use('/api/ai', require('./routes/ai'));

app.get('/', (req, res) => {
  res.redirect('/chat');
});

const server = http.createServer(app);
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`HTTP 服务器已启动在端口 ${PORT}`);
});

require('./websocket/socket')(server);
