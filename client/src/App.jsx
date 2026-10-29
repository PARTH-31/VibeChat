
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import ChatWindow from "./ChatWindow";
import "./App.css";

const API = "http://localhost:5000/api/auth";
const SERVER_URL = "http://localhost:5000";

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vibechat_user"));
    } catch {
      return null;
    }
  });

  const [isLogin, setIsLogin] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Load registered users
  useEffect(() => {
    async function fetchUsers() {
      if (!user) {
        setUsers([]);
        return;
      }

      setUsersLoading(true);

      try {
        const token = localStorage.getItem("vibechat_token");

        const response = await axios.get(
          `${SERVER_URL}/api/users`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setUsers(response.data);
      } catch (error) {
        console.error(
          "Unable to load users:",
          error.response?.data?.message || error.message
        );
      } finally {
        setUsersLoading(false);
      }
    }

    fetchUsers();
  }, [user]);

  // Real-time online status
  useEffect(() => {
    const token = localStorage.getItem("vibechat_token");

    if (!user || !token) {
      setOnlineUsers([]);
      return;
    }

    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on("online-users", (ids) => {
      setOnlineUsers(ids.map(String));
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/login" : "/register";

      const response = await axios.post(`${API}${endpoint}`, {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      localStorage.setItem("vibechat_token", response.data.token);
      localStorage.setItem(
        "vibechat_user",
        JSON.stringify(response.data.user)
      );

      setUser(response.data.user);
      setPassword("");
      setMessage("");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to connect. Please check the server."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("vibechat_token");
    localStorage.removeItem("vibechat_user");

    setUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setIsLogin(true);
    setMessage("");
    setUsers([]);
    setOnlineUsers([]);
    setSelectedPerson(null);
  }

  if (user) {
    return (
      <main className="dashboard-page">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">V</span>
            <span>VibeChat</span>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <section className="dashboard-content">
          <div className="welcome-card">
            <div className="avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>

            <p className="eyebrow">YOUR PERSONAL SPACE</p>
            <h1>Welcome, {user.name}!</h1>
            <p className="welcome-description">
              You're signed in and ready to connect.
            </p>
          </div>

          <div className="chat-panel">
            {selectedPerson ? (
              <ChatWindow
                key={selectedPerson._id}
                person={selectedPerson}
                currentUser={user}
                onBack={() => setSelectedPerson(null)}
              />
            ) : (
              <>
                <div>
                  <h2>People on VibeChat</h2>
                  <p className="panel-description">
                    Select a person to open your chat.
                  </p>
                </div>

                <div className="users-list">
                  {usersLoading ? (
                    <p className="users-message">Loading users...</p>
                  ) : users.length === 0 ? (
                    <p className="users-message">
                      No other users registered yet. Create another test
                      account to see it here.
                    </p>
                  ) : (
                    users.map((person) => {
                      const isOnline = onlineUsers.includes(
                        String(person._id)
                      );

                      return (
                        <button
                          type="button"
                          className="user-row user-row-button"
                          key={person._id}
                          onClick={() => setSelectedPerson(person)}
                        >
                          <div className="user-avatar">
                            {person.name?.charAt(0).toUpperCase()}
                          </div>

                          <div className="user-details">
                            <h3>{person.name}</h3>
                            <p>{person.email}</p>
                          </div>

                          <span
                            className={
                              isOnline
                                ? "online-status"
                                : "offline-status"
                            }
                          >
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="auth-card">
        <div className="logo">V</div>
        <h1>VibeChat</h1>

        <p className="subtitle">
          {isLogin
            ? "Welcome back! Sign in to continue."
            : "Connect instantly. Chat freely."}
        </p>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isLogin
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <p className="switch-text">
          {isLogin ? "New to VibeChat?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="switch-button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage("");
            }}
          >
            {isLogin ? "Create account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}

export default App;
