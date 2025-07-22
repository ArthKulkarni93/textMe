import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ws } from "../Websocket"; // Import the shared WebSocket object

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeUsers, setActiveUsers] = useState(0); // For displaying user count

  useEffect(() => {
    // If the shared connection doesn't exist or is closed, create it.
    if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
      ws.current = new WebSocket("https://textme-fksj.onrender.com");
    }

    const socket = ws.current;

    // Define the event handlers for the connection
    socket.onopen = () => {
      console.log("WebSocket connected.");
      setError(""); // Clear any previous errors on successful connection
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
      if (data.type === 'active-users-count') {
        setActiveUsers(data.count);
      }
      if (data.type === "match-found") {
        setLoading(false);
        // Navigate to chat. The connection is carried over via the shared `ws` object.
        navigate(`/chat/${data.roomId}`);
      }
    };

    socket.onerror = () => {
      setError("WebSocket connection failed. Please refresh the page.");
      setLoading(false);
    };

    socket.onclose = () => {
      setLoading(false);
      // You could add logic here to inform the user they are disconnected.
    };

  }, [navigate]);

  const connectSocket = () => {
    // Make sure the socket is open before trying to send a message
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError("Connecting... Please try again in a moment.");
      return;
    }
    setError("");
    setLoading(true);
    ws.current.send(JSON.stringify({ type: "start-matching" }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0F0F0F] to-[#1C1C1C] p-6">
      <div className="bg-[#111] shadow-2xl rounded-2xl p-10 w-full max-w-sm text-center transition-transform hover:scale-105 duration-300 border border-gray-700">
        <h1 className="text-4xl font-extrabold mb-4 text-white tracking-wide">textMe</h1>
        <p className="text-sm text-gray-400 mb-6">Anonymous 1-on-1 chat — connect instantly</p>
        <button
          onClick={connectSocket}
          className="bg-white text-black px-6 py-2 rounded-full hover:shadow-lg transition duration-300 disabled:opacity-50 font-semibold"
          disabled={loading}
        >
          {loading ? 'Finding a match...' : 'Start Chatting'}
        </button>
        {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        {/* Feature: Display the number of currently active users */}
        <p className="text-gray-500 mt-6">
          🟢 {activeUsers} {activeUsers === 1 ? 'user' : 'users'} online
        </p>
      </div>
    </div>
  );
};

export default LandingPage;