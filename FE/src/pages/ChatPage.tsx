import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ws } from "../Websocket"; // Import the same shared WebSocket object

function ChatPage() {
  // const { roomId } = useParams();
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const navigate = useNavigate();
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const socket = ws.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      alert("Connection lost. Please start a new chat.");
      navigate("/");
      return;
    }

    // Handle messages from the server
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages((prev) => [...prev, { from: "them", text: data.msg }]);
      } else if (data.type === "typing") {
        setPartnerTyping(true);
      } else if (data.type === "stop-typing") {
        setPartnerTyping(false);
      } else if (data.type === "partner-left") {
        alert("Partner left the chat.");
        navigate("/");
      }
    };

    // Handle the user closing the browser tab
    const handleTabClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "leave-chat" }));
      }
    };

    window.addEventListener("beforeunload", handleTabClose);

    // This cleanup function now ONLY removes listeners.
    // It NO LONGER sends the "leave-chat" message, fixing the Strict Mode bug.
    return () => {
      window.removeEventListener("beforeunload", handleTabClose);
      if (socket) {
        socket.onmessage = null;
      }
    };
  }, [navigate]);

  const sendMessage = () => {
    if (!input.trim() || !ws.current) return;
    ws.current.send(JSON.stringify({ type: "message", msg: input }));
    setMessages((prev) => [...prev, { from: "me", text: input }]);
    setInput("");
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    ws.current.send(JSON.stringify({ type: "stop-typing" }));
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    if (!typingTimeout.current) {
      ws.current.send(JSON.stringify({ type: "typing" }));
    } else {
      clearTimeout(typingTimeout.current);
    }
    
    typingTimeout.current = setTimeout(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: "stop-typing" }));
      }
      typingTimeout.current = null;
    }, 1500);
  };
  
  // The "Leave" button now explicitly sends the message before navigating
  const leaveChat = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "leave-chat" }));
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#111] text-white p-4">
      <h2 className="text-center text-2xl font-bold mb-4">🗨️ Chat Room</h2>
      <div className="flex-1 overflow-y-auto mb-4 border border-gray-700 rounded-xl p-4 bg-[#1C1C1C]">
        {messages.map((msg, idx) => (
          <p key={idx} className={msg.from === "me" ? "text-right text-green-400" : "text-left text-blue-400"}>
            <b>{msg.from === "me" ? "You" : "Stranger"}:</b> {msg.text}
          </p>
        ))}
        {partnerTyping && <p className="text-gray-500 mt-2 italic">Stranger is typing...</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={handleTyping}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          className="flex-1 p-2 rounded-lg border border-gray-700 bg-black text-white"
          placeholder="Type your message..."
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-white text-black rounded-lg font-semibold hover:shadow-lg"
        >Send</button>
        <button
          onClick={leaveChat}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >Leave</button>
      </div>
    </div>
  );
}

export default ChatPage;