const socket = io();

// Login elements
const homeScreen = document.getElementById("homeScreen");
const nameInput = document.getElementById("nameInput");
const codeInput = document.getElementById("codeInput");
const createButton = document.getElementById("createBtn");
const joinButton = document.getElementById("joinBtn");
const loginForm = document.getElementById("loginForm");

// Lobby elements
const lobbyScreen = document.getElementById("lobbyScreen");
const playerList = document.getElementById("playerList");
const displayRoomCode = document.getElementById("displayRoomCode");
const startGameButton = document.getElementById("startGameBtn");

// Question elements
const questionScreen = document.getElementById("questionsScreen");
const questionButton = document.getElementById("questionBtn");
const questionInput = document.getElementById("questionInput");

// Waiting elements
const waitingScreen = document.getElementById("waitingScreen");


// Answer elements
const answersScreen = document.getElementById("answersScreen");
const assignedQuestion1 = document.getElementById("assignedQuestion1");
const assignedQuestion2 = document.getElementById("assignedQuestion2");
const answer1 = document.getElementById("answer1");
const answer2 = document.getElementById("answer2");
const answersButton = document.getElementById("answerBtn");

// Vote elements
const voteScreen = document.getElementById("voteScreen");
const currentQuestion = document.getElementById("currentQuestion");
const voteLeft = document.getElementById("voteLeft");
const voteRight = document.getElementById("voteRight");

// Score elements
const scoreScreen = document.getElementById("scoreScreen");
const leaderboardList = document.getElementById("leaderboardList");
const againButton = document.getElementById("againBtn");

// Global variables.
let userName = "";
let roomCode = "";
let currentQ1 = "";
let currentQ2 = "";

createButton.addEventListener("click", () => {
    const userName = nameInput.value.trim();
    if (userName !== "") {
        socket.emit("create_room", userName);
    }
});

socket.on("room_created", (code) => {
    homeScreen.style.display = "none";
    lobbyScreen.style.display = "block";
    displayRoomCode.innerText = code;

    startGameButton.style.display = "inline-block";
});

socket.on("start_answering", (data) => {

    currentQ1 = data.q1;
    currentQ2 = data.q2;

    assignedQuestion1.innerText = "Q1: " + currentQ1.text;
    assignedQuestion2.innerText = "Q2: " + currentQ2.text;

    waitingScreen.style.display = "none";
    answersScreen.style.display = "block";
});

if (answersButton) {
    answersButton.addEventListener("click", () => {
        const ans1Text = answer1.value.trim();
        const ans2Text = answer2.value.trim();
        const currentRoom = displayRoomCode.innerText;

        if (ans1Text !== "" && ans2Text !== "") {
            socket.emit("submit_answers", {
                roomCode: currentRoom,
                answers: [
                    { questionAuthorId: currentQ1.authorId, text: ans1Text },
                    { questionAuthorId: currentQ2.authorId, text: ans2Text }
                ]
            });

            answersScreen.style.display = "none";
            waitingScreen.style.display = "block";
        }
    });
}

if (questionButton) {
    questionButton.addEventListener("click", () => {
        const questionText = questionInput.value.trim();
        const currentRoom = displayRoomCode.innerText;

        if (questionText !== '') {
            socket.emit("submit_question", {
                roomCode: currentRoom,
                question: questionText
            });

            questionScreen.style.display = "none";
            waitingScreen.style.display = "block";
        }
    });
}

// Join Button
if (joinButton)  {
    joinButton.addEventListener("click", () => {
        const userName = nameInput.value.trim();
        const roomCode = codeInput.value.trim().toUpperCase();
        if (userName !== "" || roomCode !== "") {
            socket.emit('join_room', { username: userName, roomCode: roomCode });
            homeScreen.style.display = "none";
            lobbyScreen.style.display = "block";
            displayRoomCode.innerText = roomCode;
        }
    });
}

if (startGameButton) {
    startGameButton.addEventListener("click", () => {
        const currentRoom = displayRoomCode.innerText;
        socket.emit("start_game", currentRoom);
    });
}

socket.on('start_writing', () => {
    lobbyScreen.style.display = "none";
    questionScreen.style.display = "block";
});

socket.on('player_joined', (players) => {
    playerList.innerHTML = "";

    players.forEach(player => {
        const li = document.createElement("li");
        li.innerText = player.name;
        playerList.appendChild(li);
    });
    console.log("Current players in room:", players);
});

socket.on('start_vote', (data) => {
    currentQuestion.innerText = data.question;
    voteLeft.innerText = data.answer1;
    voteRight.innerText = data.answer2;
    waitingScreen.style.display = "none";
    answersScreen.style.display = "none";
    voteScreen.style.display = "block";
    voteLeft.disabled = false;
    voteRight.disabled = false;
});


function submitVote(voteIndex) {
    const currentRoom = displayRoomCode.innerText;

    socket.emit("submit_vote", { 
        roomCode: currentRoom, 
        voteIndex: voteIndex 
    });
    
    voteLeft.disabled = true;
    voteRight.disabled = true;
    voteLeft.innerText = "Waiting...";
    voteRight.innerText = "Waiting...";
}

if (voteLeft) {
    voteLeft.addEventListener("click", () => submitVote(0));
}
if (voteRight) {
    voteRight.addEventListener("click", () => submitVote(1));
}

socket.on(`show_scores`, (leaderboard) => {
    voteScreen.style.display = "none";
    waitingScreen.style.display = "none";

    scoreScreen.style.display = "block";

    leaderboardList.innerHTML = "";

    leaderboard.forEach(player => {
        const li = document.createElement("li");
        li.innerText = `${player.name}: ${player.score}`;
        leaderboardList.appendChild(li);
    });
});