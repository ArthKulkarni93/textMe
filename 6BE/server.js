
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const prisma = new PrismaClient();

// Connect to the database
prisma.$connect()
    .then(() => {
        console.log('Database connected');
    })
    .catch((error) => {
        console.error('Error connecting to the database:', error);
    });

// In-memory state management, similar to your original style
let users = new Map(); // Maps WebSocket to its state { roomId }
let rooms = new Map(); // Maps roomId to a Set of two WebSockets
let waitingQueue = []; // An array of WebSockets waiting for a match

// --- Helper Functions ---

const broadcastActiveUsers = () => {
    const payload = JSON.stringify({
        type: 'active-users-count',
        count: wss.clients.size,
    });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(payload);
            } catch (err) {
                console.error('Error sending active-users-count:', err);
            }
        }
    });
};

const findMatch = () => {
    // Remove any closed sockets from the waitingQueue
    waitingQueue = waitingQueue.filter(ws => ws.readyState === WebSocket.OPEN);

    // If there are at least two users waiting, create a match
    if (waitingQueue.length >= 2) {
        console.log("Matchmaking in progress...");
        const ws1 = waitingQueue.shift();
        const ws2 = waitingQueue.shift();

        if (!ws1 || !ws2) return;

        if (ws1.readyState !== WebSocket.OPEN || ws2.readyState !== WebSocket.OPEN) {
            // If either socket is closed, skip matching
            return;
        }

        const roomId = randomUUID();

        rooms.set(roomId, new Set([ws1, ws2]));

        users.set(ws1, { roomId });
        users.set(ws2, { roomId });

        const payload = JSON.stringify({ type: "match-found", roomId });
        try {
            ws1.send(payload);
        } catch (err) {
            console.error('Error sending match-found to ws1:', err);
        }
        try {
            ws2.send(payload);
        } catch (err) {
            console.error('Error sending match-found to ws2:', err);
        }

        console.log(`Match found! Room: ${roomId}`);

        prisma.chatSession.create({ data: { id: roomId } })
            .catch(err => console.error("Prisma create error:", err));
    }
};

const handleLeaveChat = async(ws) => {
    const userState = users.get(ws);
    if (!userState || !userState.roomId) return;

    const roomId = userState.roomId;
    const room = rooms.get(roomId);

    if (room) {
        room.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify({ type: "partner-left" }));
                } catch (err) {
                    console.error('Error sending partner-left:', err);
                }
                const partnerState = users.get(client);
                if (partnerState) {
                    partnerState.roomId = null;
                }
            }
        });

        rooms.delete(roomId);
        console.log(`Room ${roomId} has been closed.`);

        try {
            await prisma.chatSession.update({
                where: { id: roomId },
                data: { endTime: new Date() },
            });
        } catch (err) {
            console.error("Prisma update error:", err);
        }
    }

    userState.roomId = null;
};

// --- WebSocket Connection Logic ---

wss.on('connection', (ws) => {
    console.log(`New client connected.`);
    users.set(ws, { roomId: null });
    broadcastActiveUsers();

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (err) {
            console.error('Invalid JSON received:', message);
            return;
        }
        console.log("Received message:", data);

        const userState = users.get(ws);
        const roomId = userState ? userState.roomId : null;

        if (data.type === "start-matching") {
            // Prevent duplicate entries in waitingQueue
            if (!waitingQueue.includes(ws) && ws.readyState === WebSocket.OPEN) {
                waitingQueue.push(ws);
                findMatch();
            }
        }

        if (data.type === "message") {
            if (roomId && rooms.has(roomId)) {
                rooms.get(roomId).forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        try {
                            client.send(JSON.stringify({ type: "message", msg: data.msg }));
                        } catch (err) {
                            console.error('Error sending message:', err);
                        }
                    }
                });
            }
        }

        if (data.type === "leave-chat") {
            handleLeaveChat(ws);
        }

        if (data.type === "typing" || data.type === "stop-typing") {
            if (roomId && rooms.has(roomId)) {
                rooms.get(roomId).forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        try {
                            client.send(JSON.stringify({ type: data.type }));
                        } catch (err) {
                            console.error('Error sending typing event:', err);
                        }
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected.`);
        handleLeaveChat(ws);
        waitingQueue = waitingQueue.filter(client => client !== ws);
        users.delete(ws);
        broadcastActiveUsers();
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
});
