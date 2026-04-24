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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ 
        width: isSidebarOpen ? '300px' : '0', 
        backgroundColor: 'var(--bg-card)', 
        borderRight: '1px solid var(--glass-border)',
        display: 'flex', 
        flexDirection: 'column',
        transition: 'var(--transition)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{ padding: '30px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px' }}>Zyntry</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Premium Messaging</p>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '16px' }}>Channels</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {channels.map(ch => (
              <li 
                key={ch._id} 
                onClick={() => joinChannel(ch._id)}
                style={{ 
                  padding: '12px 16px', 
                  cursor: 'pointer', 
                  backgroundColor: selectedChannel === ch._id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  color: selectedChannel === ch._id ? 'var(--primary-color)' : 'var(--text-primary)',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  fontWeight: selectedChannel === ch._id ? '600' : '400',
                  transition: 'var(--transition)',
                  border: selectedChannel === ch._id ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent'
                }}
                onMouseOver={(e) => {
                  if (selectedChannel !== ch._id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                }}
                onMouseOut={(e) => {
                  if (selectedChannel !== ch._id) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ marginRight: '8px', opacity: 0.5 }}>#</span>
                {ch.name}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontWeight: '600', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
          </div>
          <button 
            onClick={onLogout}
            title="Logout"
            style={{ padding: '8px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: '8px', transition: 'var(--transition)' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {selectedChannel ? (
          <>
            <header style={{ padding: '20px 30px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                <span style={{ color: 'var(--primary-color)', marginRight: '8px' }}>#</span>
                {channels.find(c => c._id === selectedChannel)?.name}
              </h2>
            </header>
            
            <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.map((msg) => (
                <div key={msg._id} style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: msg.sender?._id === user?.id ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: msg.sender?._id === user?.id ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                      {msg.sender?._id === user?.id ? 'You' : msg.sender?.username}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ 
                    padding: '12px 18px', 
                    borderRadius: '16px', 
                    borderTopRightRadius: msg.sender?._id === user?.id ? '2px' : '16px',
                    borderTopLeftRadius: msg.sender?._id === user?.id ? '16px' : '2px',
                    backgroundColor: msg.sender?._id === user?.id ? 'var(--primary-color)' : 'var(--bg-card)',
                    color: 'white',
                    maxWidth: '80%',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: msg.sender?._id === user?.id ? 'none' : '1px solid var(--glass-border)'
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} style={{ padding: '30px', backgroundColor: 'transparent' }}>
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                background: 'var(--bg-card)', 
                padding: '8px', 
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
              }}>
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message #${channels.find(c => c._id === selectedChannel)?.name}`}
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px', 
                    backgroundColor: 'transparent', 
                    border: 'none', 
                    color: 'white', 
                    outline: 'none',
                    fontSize: '0.95rem'
                  }}
                />
                <button 
                  type="submit"
                  style={{ 
                    padding: '10px 20px', 
                    backgroundColor: 'var(--primary-color)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    fontWeight: '600',
                    transition: 'var(--transition)'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = 'var(--primary-hover)'}
                  onMouseOut={(e) => e.target.style.backgroundColor = 'var(--primary-color)'}
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Welcome to Zyntry</h2>
            <p style={{ maxWidth: '400px', lineHeight: '1.6' }}>Select a channel from the sidebar to join the conversation and start messaging in real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
