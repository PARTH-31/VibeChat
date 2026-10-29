
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./ChatWindow.css";

const SERVER_URL = "http://localhost:5000";

function ChatWindow({ person, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const personId = String(person?._id || person?.id || "");

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("vibechat_token");

    if (!token || !personId) {
      setError("Unable to connect to this chat.");
      setLoading(false);
      return;
    }

    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-chat", personId);
    });

    socket.on("new-message", (newMessage) => {
      if (!active || !newMessage) return;

      setMessages((previous) => {
        const newId = newMessage._id ? String(newMessage._id) : null;

        if (
          newId &&
          previous.some((msg) => String(msg._id) === newId)
        ) {
          return previous;
        }

        return [...previous, newMessage];
      });
    });

    socket.on("connect_error", (err) => {
      console.error("Chat socket error:", err.message);
    });

    async function loadMessages() {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get(
          `${SERVER_URL}/api/chats/${personId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (active) {
          setMessages(response.data.messages || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message || "Unable to load messages."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMessages();

    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [personId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();

    const messageText = text.trim();

    if (!messageText || sending || loading) return;

    setSending(true);
    setError("");

    try {
      const token = localStorage.getItem("vibechat_token");

      const response = await axios.post(
        `${SERVER_URL}/api/chats/${personId}`,
        { text: messageText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const savedMessages = response.data.messages || [];
      const savedMessage = savedMessages[savedMessages.length - 1];

      setMessages((previous) => {
        if (
          savedMessage?._id &&
          previous.some(
            (msg) => String(msg._id) === String(savedMessage._id)
          )
        ) {
          return previous;
        }

        return savedMessage ? [...previous, savedMessage] : savedMessages;
      });

      setText("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-window">
      <header className="chat-header">
        <button
          type="button"
          className="chat-back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <div className="chat-person-avatar">
          {person.name?.charAt(0).toUpperCase()}
        </div>

        <div className="chat-person-info">
          <h2>{person.name}</h2>
          <p>{person.email}</p>
        </div>
      </header>

      <div className="chat-messages">
        {loading ? (
          <p className="chat-info">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="chat-info">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg, index) => {
            const senderId =
              typeof msg.sender === "object"
                ? msg.sender?._id || msg.sender?.id
                : msg.sender;

            const isMine =
              currentUserId &&
              senderId &&
              String(senderId) === currentUserId;

            return (
              <div
                key={msg._id || `${msg.sentAt}-${index}`}
                className={`message-row ${
                  isMine ? "my-message-row" : ""
                }`}
              >
                <div
                  className={`message-bubble ${
                    isMine ? "my-message" : "their-message"
                  }`}
                >
                  <p>{msg.text}</p>
                  <span>
                    {msg.sentAt
                      ? new Date(msg.sentAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          disabled={loading || sending}
        />

        <button
          type="submit"
          disabled={loading || sending || !text.trim()}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}

export default ChatWindow;
