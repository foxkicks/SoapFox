const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve the static files.
app.use(express.static(__dirname));

// Hold rooms here.
const rooms = {};

// For making new 6-digit room codes.
function generateRoomCode() {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return code;
}

io.on('connection', (socket) => {

    // When the create button is clicked.
    socket.on(`create_room`, (username) => {
        let roomCode = generateRoomCode();

        while (rooms[roomCode]) {
            roomCode = generateRoomCode();
        }

        rooms[roomCode] = {
            host: socket.id,
            players: [{
                id: socket.id,
                name: username
            }],
            questions: [],
            status: 'lobby'
        };

        socket.join(roomCode);

        socket.emit(`room_created`, roomCode);

        io.to(roomCode).emit('player_joined', rooms[roomCode].players);

        console.log(`Room created: ${roomCode}`);
    });

    console.log(`A user connected ${socket.id}`);

    // Listen for players joining.
    socket.on('join_room', (data) => {

        const { username, roomCode} = data;

        if (!rooms[roomCode]) {
            return;
        }

        // Players use room codes to join.
        socket.join(roomCode);

        // Initialize the room in memory if it doesn't exist.
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                players: [],
                status: 'lobby',
                questions: []
            };
        }


        // Add new player to the room.
        rooms[roomCode].players.push({
            id: socket.id,
            name: username
        });

        console.log(`${username} joined room:  ${roomCode}`);
        
        socket.emit('join_success', roomCode);

        // Let the people know.
        io.to(roomCode).emit('player_joined', rooms[roomCode].players);
    });

    // Disconnecting from a room.
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });

    socket.on('start_game', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.length >= 2) {
            rooms[roomCode].status = 'writing';
            io.to(roomCode).emit('start_writing');
            console.log(`Room ${roomCode} has started the writing phase.`);
        }
    });

    socket.on('submit_question', (data) => {
        const { roomCode, question } = data;
        const room = rooms[roomCode];

        if (room) {
            const author = room.players.find(p => p.id === socket.id);

            room.questions.push({
                text: question,
                authorId: socket.id,
                authorName: author.name,
                answers: []
            });
        
            console.log(`${author.name} submmitted a question in ${roomCode}. Total: ${room.questions.length}/${room.players.length}`);

            if (room.questions.length === room.players.length) {
                console.log(`All questions received for room ${roomCode}`)
                room.status = 'assigning';

                let ring = [...room.players];
                for (let i = ring.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [ring[i], ring[j]] = [ring[j], ring[i]];
                }

                const P = ring.length;

                ring.forEach((player, index) => {
                    const author1 = ring[(index + 1) % P];
                    const author2 = ring[(index + 2) % P];

                    const question1 = room.questions.find(q => q.authorId === author1.id);
                    const question2 = room.questions.find(q => q.authorId === author2.id);

                    io.to(player.id).emit('start_answering', {
                        q1: question1,
                        q2: question2
                    });
                });
            }
        }

    });

    socket.on('submit_answers', (data) => {
        const { roomCode, answers } = data;
        const room = rooms[roomCode];
        if (room) {
            answers.forEach(ans => {
                const question = room.questions.find(q => q.authorId === ans.questionAuthorId);
                if (question) {
                    question.answers.push({
                        authorId: socket.id,
                        text: ans.text,
                        votes: 0
                    });
                }
            });
            room.playersAnswered = (room.playersAnswered || 0) + 1;
            console.log(`Answers received from ${roomCode}.`);

            if (room.playersAnswered === room.players.length) {
                room.status = 'voting';
                room.currentVoteIndex = 0;

                startNextVote(roomCode);
            }
        }
    });

    socket.on(`submit_vote`, (data) => {
        const { roomCode, voteIndex } = data;
        const room = rooms[roomCode];

        if (room) {
            const currentQuestion = room.questions[room.currentVoteIndex];
            currentQuestion.answers[voteIndex].votes += 1;
            room.currentQuestionVotes += 1;

            if (room.currentQuestionVotes === room.players.length) {
                room.currentVoteIndex += 1;
                io.to(roomCode).emit(`update_votes`, (currentQuestion.answers));
                sleep(5000).then(() => {startNextVote(roomCode); });
            }
        }
    });

    socket.on('play_again', roomCode => {
        const room = rooms[roomCode];

        if (room) {
            console.log(`Resetting room ${roomCode}.`);
            room.questions = [];
            room.status = 'lobby';
            room.playersAnswered = 0;
            room.currentVoteIndex = 0;
            room.currentQuestionVotes = 0;

            io.to(roomCode).emit('return_to_lobby', room.players);
        }
    });
});

function startNextVote(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.currentVoteIndex < room.questions.length) {
        const currentQuestion = room.questions[room.currentVoteIndex];
        room.currentQuestionVotes = 0;
        console.log(`Starting vote for question: "${currentQuestion.text}"`);
        io.to(roomCode).emit('start_vote', {
            question: currentQuestion.text,
            answer1: currentQuestion.answers[0].text,
            answer2: currentQuestion.answers[1].text
        });
    }  else {
        console.log(`Voting complete for room ${roomCode}. Loading scores.`);
        const scores = {};
        room.players.forEach(p => {
            scores[p.id] = { name: p.name, score: 0 };
        });

        room.questions.forEach(q => {
            q.answers.forEach(a => {
                if (scores[a.authorId]) {
                    scores[a.authorId].score += a.votes;
                }
            });
        })
        const leaderboard = Object.values(scores).sort((a, b) => b.score - a.score);
        io.to(roomCode).emit(`show_scores`, leaderboard);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SoapFox server is running on http://localhost:${PORT}`);
});