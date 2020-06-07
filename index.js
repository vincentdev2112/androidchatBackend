// Setup basic express server
// var promisify = require("util").promisify;
// var redis = require("redis");
var path = require("path");
var express = require("express");

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
// var store = redis.createClient(process.env.REDIS_URL);

// var Crypto = require('crypto-js');
var sha256 = require('crypto-js/sha256');

var pepper = process.env.PEPPER;

// const getAsync = promisify(store.get).bind(store);
// const setAsync = promisify(store.set).bind(store);


var port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;

// store.on("error", error => {
//     console.error(error);
// });

var byName = {};
var byUid = {};

const add = (socket) => {
    byName[socket.username] = socket;
    byUid[socket.userid] = socket;
};

const remove = (socket) => {
    delete byName[socket.username];
    delete byUid[socket.userid];
};

io.on('connection', (socket) => {
    var addedUser = false;
    // when the client emits 'new message', this listens and executes
    socket.on('new message', async (data) => {
        console.log(data);
        // we tell the client to execute 'new message'
        socket.broadcast.emit('new message', {
            username: socket.username,
            userid: socket.userid,
            message: data
        });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', async (username) => {
        if (addedUser) return;

        // we store the username in the socket session for this client
        let id = -1;
        let avatar = null;

        if (typeof username == 'string') {
            try {
                var details = JSON.parse(username);
                username = details.username;
                avatar = details.avatar;
                id = sha256(pepper + details.userid).toString();
            } catch (err) {}
        } else if (typeof username == 'object') {
            var details = username;
            username = details.username;
            avatar = details.avatar;
            id = sha256(pepper + details.userid).toString();
        }

        socket.username = username;
        socket.userid = id;
        socket.logtime = new Date();
        socket.avatar = avatar;

        ++numUsers;
        addedUser = true;

        // echo to client
        socket.emit('login', {
            numUsers: numUsers,
            users: Object.values(byUid).map(x => ({
                username: x.username,
                userid: x.userid,
                avatar: x.avatar,
                logtime: socket.logtime.getTime()
            }))
        });

        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
            username: socket.username,
            userid: socket.userid,
            avatar: socket.avatar,
            numUsers: numUsers
        });

        add(socket);

        // Object.keys(byUid).forEach(key => console.log(key));
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', () => {
        socket.broadcast.emit('typing', {
            username: socket.username,
            userid: socket.userid
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing', {
            username: socket.username,
            userid: socket.userid
        });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', () => {
        if (addedUser) {
            --numUsers;

            // echo globally that this client has left
            socket.broadcast.emit('user left', {
                username: socket.username,
                userid: socket.userid,
                numUsers: numUsers
            });

            remove(socket);
        }
    });
});
