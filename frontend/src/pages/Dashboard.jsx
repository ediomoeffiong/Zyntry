import { useNavigate } from 'react-router-dom';
import { removeToken, getToken, getUser } from '../services/authService';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const Dashboard = () => {
  const navigate = useNavigate();
  const token = getToken();
  const user = getUser();
  
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup Socket Connection
  useEffect(() => {
    if (token) {
      const newSocket = io('http://localhost:5000');
      setSocket(newSocket);

      newSocket.on('receive_message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      return () => newSocket.disconnect();
    }
  }, [token]);

  // Fetch Channels
  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      const fetchChannels = async () => {
        try {
          const res = await axios.get('http://localhost:5000/api/channels', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setChannels(res.data);
        } catch (err) {
          console.error('Error fetching channels:', err);
        }
      };
      fetchChannels();
    }
  }, [token, navigate]);

  // Fetch Messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      const fetchMessages = async () => {
        try {
          const res = await axios.get(`http://localhost:5000/api/messages/${selectedChannel}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMessages(res.data);
        } catch (err) {
          console.error('Error fetching messages:', err);
        }
      };
      fetchMessages();
    }
  }, [selectedChannel, token]);

  const onLogout = () => {
    removeToken();
    localStorage.removeItem('user');
    navigate('/login');
  };

  const joinChannel = (channelId) => {
    if (socket) {
      setSelectedChannel(channelId);
      socket.emit('join_channel', channelId);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (socket && newMessage.trim() && selectedChannel) {
      socket.emit('send_message', {
        channelId: selectedChannel,
        text: newMessage,
        senderId: user.id
      });
      setNewMessage('');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', backgroundColor: '#2c3e50', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2>Zyntry</h2>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '0.8em', color: '#bdc3c7' }}>Logged in as: <strong>{user?.username}</strong></p>
        </div>
        <h3>Channels</h3>
        <ul style={{ listStyle: 'none', padding: 0, flex: 1, overflowY: 'auto' }}>
          {channels.map(ch => (
            <li 
              key={ch._id} 
              onClick={() => joinChannel(ch._id)}
              style={{ 
                padding: '10px', 
                cursor: 'pointer', 
                backgroundColor: selectedChannel === ch._id ? '#34495e' : 'transparent',
                borderRadius: '4px',
                marginBottom: '5px'
              }}
            >
              # {ch.name}
            </li>
          ))}
        </ul>
        <button 
          onClick={onLogout}
          style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#e74c3c', border: 'none', color: 'white', borderRadius: '4px' }}
        >
          Logout
        </button>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ecf0f1' }}>
        {selectedChannel ? (
          <>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #ddd', backgroundColor: 'white' }}>
              <h2># {channels.find(c => c._id === selectedChannel)?.name}</h2>
            </div>
            
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {messages.map((msg) => (
                <div key={msg._id} style={{ alignSelf: msg.sender?._id === user?.id ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                  <div style={{ fontSize: '0.7em', color: '#7f8c8d', marginBottom: '2px', textAlign: msg.sender?._id === user?.id ? 'right' : 'left' }}>
                    {msg.sender?.username} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ 
                    padding: '10px 15px', 
                    borderRadius: '15px', 
                    backgroundColor: msg.sender?._id === user?.id ? '#3498db' : 'white',
                    color: msg.sender?._id === user?.id ? 'white' : 'black',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid #ddd', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '12px', borderRadius: '4px', border: '1px solid #ddd', outline: 'none' }}
              />
              <button 
                type="submit"
                style={{ padding: '10px 20px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95a5a6' }}>
            <h2>Select a channel to start chatting</h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
