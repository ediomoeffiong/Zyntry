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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [isCreatingDM, setIsCreatingDM] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isBrowsingChannels, setIsBrowsingChannels] = useState(false);
  const [publicChannels, setPublicChannels] = useState([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isJoiningWorkspace, setIsJoiningWorkspace] = useState(false);
  const [publicWorkspaces, setPublicWorkspaces] = useState([]);
  const [isLoadingPublicWorkspaces, setIsLoadingPublicWorkspaces] = useState(false);
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedChannelRef = useRef(null);

  // Sync ref with state so socket listener can access current value
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Stable socket management
  useEffect(() => {
    if (token && !socketRef.current) {
      const socketUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : 'https://zyntry.onrender.com';
      
      const newSocket = io(socketUrl, {
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        // Rejoin active channel if one is selected
        if (selectedChannelRef.current) {
          newSocket.emit('join_channel', selectedChannelRef.current);
        }
      });

      newSocket.on('receive_message', (message) => {
        // ONLY append if it's for the currently active channel AND not a duplicate
        if (message.channelId === selectedChannelRef.current) {
          setMessages((prev) => {
            const exists = prev.some(m => m._id === message._id);
            if (exists) return prev;
            return [...prev, message];
          });
        }
        setIsSending(false);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket Auth Error:', err.message);
        if (err.message.includes('Authentication error')) {
          onLogout();
        }
      });

      newSocket.on('error', (err) => {
        setError(err.message || 'Socket error occurred');
        setIsSending(false);
      });

      socketRef.current = newSocket;
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token]);

  const fetchChannels = async () => {
    if (!activeWorkspace) return;
    setIsLoadingChannels(true);
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/channels?workspaceId=${activeWorkspace}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannels(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching channels:', err);
      if (err.response?.status === 401) onLogout();
      setError('Failed to load channels');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const fetchWorkspaces = async () => {
    setIsLoadingWorkspaces(true);
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspaces(res.data);
      if (res.data.length > 0) {
        if (!activeWorkspace) {
          setActiveWorkspace(res.data[0]._id);
        }
      } else {
        setIsCreatingWorkspace(true);
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      setError('Failed to load workspaces');
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchWorkspaces();
    }
  }, [token, navigate]);

  useEffect(() => {
    if (activeWorkspace) {
      fetchChannels();
      setSelectedChannel(null); // Clear selection when workspace changes
      setMessages([]);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (selectedChannel) {
      const fetchMessages = async () => {
        setIsLoadingMessages(true);
        try {
          const apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000/api' 
            : 'https://zyntry.onrender.com/api';
          const res = await axios.get(`${apiBaseUrl}/messages/${selectedChannel}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMessages(res.data);
          setError(null);
        } catch (err) {
          console.error('Error fetching messages:', err);
          setError('Failed to load message history');
        } finally {
          setIsLoadingMessages(false);
        }
      };
      fetchMessages();
    }
  }, [selectedChannel, token]);

  const onLogout = () => {
    removeToken();
    localStorage.removeItem('user');
    if (socketRef.current) socketRef.current.disconnect();
    navigate('/login');
  };

  const joinChannel = (channelId) => {
    if (socketRef.current) {
      // Clear messages immediately to avoid bleed
      setMessages([]);
      setSelectedChannel(channelId);
      socketRef.current.emit('join_channel', channelId);
      
      // Auto-hide sidebar on mobile after selection
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      }
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return; // Prevent empty messages

    if (socketRef.current && selectedChannel && !isSending) {
      setIsSending(true);
      socketRef.current.emit('send_message', {
        channelId: selectedChannel,
        text
      });
      setNewMessage('');
      // Safety timeout to reset isSending if broadcast fails
      setTimeout(() => setIsSending(false), 5000);
    }
  };

  const startDM = async (e) => {
    e.preventDefault();
    if (!dmSearchQuery.trim()) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.post(`${apiBaseUrl}/channels/dm`, { 
        email: dmSearchQuery,
        workspaceId: activeWorkspace 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDmSearchQuery('');
      setIsCreatingDM(false);
      await fetchChannels();
      joinChannel(res.data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Error starting DM');
    }
  };

  const createChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.post(`${apiBaseUrl}/channels`, { 
        name: newChannelName,
        workspaceId: activeWorkspace
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewChannelName('');
      setIsCreatingChannel(false);
      await fetchChannels();
      joinChannel(res.data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating channel');
    }
  };

  const fetchPublicChannels = async () => {
    setIsLoadingPublic(true);
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/channels/public?workspaceId=${activeWorkspace}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPublicChannels(res.data);
    } catch (err) {
      setError('Failed to load public channels');
    } finally {
      setIsLoadingPublic(false);
    }
  };

  const handleJoinPublicChannel = async (channelId) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/channels/${channelId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchChannels();
      setIsBrowsingChannels(false);
      joinChannel(channelId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join channel');
    }
  };

  const handleLeaveChannel = async (e, channelId) => {
    e.stopPropagation(); // Prevent selecting the channel when clicking 'x'
    if (!window.confirm('Are you sure you want to remove this from your sidebar? Messages will not be deleted.')) return;
    
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/channels/${channelId}/leave`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (selectedChannel === channelId) {
        setSelectedChannel(null);
      }
      await fetchChannels();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave channel');
    }
  };

  useEffect(() => {
    if (isBrowsingChannels) {
      fetchPublicChannels();
    }
  }, [isBrowsingChannels]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getChannelDisplayName = (ch) => {
    if (ch.isDirectMessage) {
      const otherUser = ch.participants.find(p => p._id !== user.id);
      return otherUser ? otherUser.username : 'Unknown User';
    }
    return ch.name;
  };

  const createWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.post(`${apiBaseUrl}/workspaces`, { name: newWorkspaceName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewWorkspaceName('');
      setIsCreatingWorkspace(false);
      await fetchWorkspaces();
      setActiveWorkspace(res.data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating workspace');
    }
  };

  const fetchPublicWorkspaces = async () => {
    setIsLoadingPublicWorkspaces(true);
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/workspaces/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPublicWorkspaces(res.data);
    } catch (err) {
      setError('Failed to load available workspaces');
    } finally {
      setIsLoadingPublicWorkspaces(false);
    }
  };

  const handleJoinWorkspace = async (workspaceId) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/workspaces/${workspaceId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchWorkspaces();
      setIsJoiningWorkspace(false);
      setActiveWorkspace(workspaceId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join workspace');
    }
  };

  useEffect(() => {
    if (isJoiningWorkspace) {
      fetchPublicWorkspaces();
    }
  }, [isJoiningWorkspace]);

  const activeChannelObj = channels.find(c => c._id === selectedChannel);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      minHeight: '100vh',
      height: '100dvh', // Modern dynamic viewport height for mobile
      backgroundColor: 'var(--bg-dark)', 
      color: 'var(--text-primary)', 
      overflow: 'hidden', 
      position: 'relative' 
    }}>
      {/* Mobile Overlay */}
      {isSidebarOpen && window.innerWidth <= 768 && (
        <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Error Notification */}
      {error && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          backgroundColor: '#ef4444', 
          color: 'white', 
          padding: '12px 24px', 
          borderRadius: '12px', 
          boxShadow: 'var(--shadow-premium)', 
          zIndex: 2000,
          animation: 'fadeIn 0.3s ease-out',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          {error}
        </div>
      )}

      {/* Workspace Rail (Slack-style far left bar) */}
      <div style={{ 
        width: '72px', 
        backgroundColor: 'var(--bg-dark)', 
        borderRight: '1px solid var(--glass-border)',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        padding: '16px 0', 
        gap: '12px',
        zIndex: 1002
      }}>
        {workspaces.map(ws => (
          <div 
            key={ws._id}
            className={`workspace-icon ${activeWorkspace === ws._id ? 'workspace-icon-active' : ''}`}
            onClick={() => setActiveWorkspace(ws._id)}
            title={ws.name}
          >
            {ws.name.substring(0, 2).toUpperCase()}
          </div>
        ))}
        
        <button 
          onClick={() => setIsJoiningWorkspace(true)}
          className="workspace-icon"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
          title="Join Workspace"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>

        <button 
          onClick={() => setIsCreatingWorkspace(true)}
          className="workspace-icon"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--primary-color)' }}
          title="Create Workspace"
        >
          +
        </button>
      </div>

      {/* Sidebar */}
      <div className={`mobile-sidebar ${isSidebarOpen ? '' : 'sidebar-closed'}`} style={{ 
        width: isSidebarOpen ? '300px' : '0', 
        minWidth: isSidebarOpen ? '300px' : '0',
        backgroundColor: 'var(--bg-card)', 
        borderRight: '1px solid var(--glass-border)',
        display: 'flex', 
        flexDirection: 'column',
        transition: 'var(--transition)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1001
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '2px' }}>Zyntry</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {workspaces.find(ws => ws._id === activeWorkspace)?.name || 'Select Workspace'}
            </p>
          </div>
          {window.innerWidth <= 768 && (
            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          {/* Channels Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '600' }}>Channels</h4>
              <button 
                onClick={() => setIsBrowsingChannels(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600' }}
                title="Browse Channels"
              >Browse</button>
            </div>
            <button 
              onClick={() => setIsCreatingChannel(!isCreatingChannel)}
              style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition)' }}
              title="Create Channel"
            >+</button>
          </div>
          
          {isCreatingChannel && (
            <form onSubmit={createChannel} style={{ padding: '0 16px', marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="New channel name..."
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                autoFocus
              />
            </form>
          )}
          
          {isLoadingChannels ? (
            <div style={{ padding: '0 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
              {channels.filter(ch => !ch.isDirectMessage).length === 0 ? (
                <li style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No channels found</li>
              ) : (
                channels.filter(ch => !ch.isDirectMessage).map(ch => (
                  <li 
                    key={ch._id} 
                    onClick={() => joinChannel(ch._id)}
                    className={`sidebar-item ${selectedChannel === ch._id ? 'sidebar-item-active' : ''}`}
                    style={{ 
                      padding: '10px 16px', 
                      cursor: 'pointer', 
                      color: selectedChannel === ch._id ? 'var(--primary-color)' : 'var(--text-secondary)',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      transition: 'var(--transition)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <span style={{ marginRight: '12px', opacity: 0.5, fontSize: '1.1rem' }}>#</span>
                      <span style={{ fontSize: '0.95rem' }}>{ch.name}</span>
                    </div>
                    <button 
                      onClick={(e) => handleLeaveChannel(e, ch._id)}
                      className="cancel-btn"
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-secondary)', 
                        cursor: 'pointer', 
                        padding: '4px',
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.6
                      }}
                      title="Unpin channel"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {/* DMs Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '600' }}>Direct Messages</h4>
            <button 
              onClick={() => setIsCreatingDM(!isCreatingDM)}
              style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition)' }}
              title="Start DM"
            >+</button>
          </div>

          {isCreatingDM && (
            <form onSubmit={startDM} style={{ padding: '0 16px', marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="User email or username..."
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                autoFocus
              />
            </form>
          )}

          {isLoadingChannels ? (
            <div style={{ padding: '0 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {channels.filter(ch => ch.isDirectMessage).length === 0 ? (
                <li style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No DMs yet</li>
              ) : (
                channels.filter(ch => ch.isDirectMessage).map(ch => (
                  <li 
                    key={ch._id} 
                    onClick={() => joinChannel(ch._id)}
                    className={`sidebar-item ${selectedChannel === ch._id ? 'sidebar-item-active' : ''}`}
                    style={{ 
                      padding: '10px 16px', 
                      cursor: 'pointer', 
                      color: selectedChannel === ch._id ? 'var(--primary-color)' : 'var(--text-secondary)',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      transition: 'var(--transition)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', opacity: selectedChannel === ch._id ? 1 : 0.4 }}></div>
                      <span style={{ fontSize: '0.95rem' }}>{getChannelDisplayName(ch)}</span>
                    </div>
                    <button 
                      onClick={(e) => handleLeaveChannel(e, ch._id)}
                      className="cancel-btn"
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-secondary)', 
                        cursor: 'pointer', 
                        padding: '4px',
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.6
                      }}
                      title="Unpin chat"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.9rem' }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{user?.username}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'var(--transition)' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        {!activeWorkspace ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-dark)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Start with a Workspace</h2>
            <p style={{ maxWidth: '400px', lineHeight: '1.6', fontSize: '0.95rem' }}>You are not in any workspaces yet. Create a new one or join an existing workspace to start chatting.</p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button 
                onClick={() => setIsCreatingWorkspace(true)}
                style={{ padding: '12px 24px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}
              >Create Workspace</button>
              <button 
                onClick={() => setIsJoiningWorkspace(true)}
                style={{ padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}
              >Join Workspace</button>
            </div>
          </div>
        ) : selectedChannel ? (
          <>
            <header style={{ 
              padding: '16px 24px', 
              borderBottom: '1px solid var(--glass-border)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              backgroundColor: 'var(--glass-bg)',
              backdropFilter: 'blur(10px)',
              zIndex: 10
            }}>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                  {activeChannelObj?.isDirectMessage ? '@' : '#'}
                </span>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {getChannelDisplayName(activeChannelObj)}
                </h2>
              </div>
            </header>
            
            <div style={{ 
              flex: 1, 
              padding: '24px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              backgroundColor: 'var(--bg-dark)'
            }}>
              {isLoadingMessages ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Loading messages...
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✨</div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.1rem' }}>Beginning of history</h3>
                  <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Say hello to {activeChannelObj?.isDirectMessage ? '@' : '#'}{getChannelDisplayName(activeChannelObj)}!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = msg.sender?._id === user?.id;
                  const prevMsg = messages[index - 1];
                  const showHeader = !prevMsg || prevMsg.sender?._id !== msg.sender?._id;

                  return (
                    <div key={msg._id} style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: isOwn ? 'flex-end' : 'flex-start',
                      marginTop: showHeader ? '12px' : '2px'
                    }}>
                      {showHeader && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', padding: '0 4px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isOwn ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                            {isOwn ? 'You' : msg.sender?.username}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <div style={{ 
                        padding: '10px 16px', 
                        borderRadius: '12px', 
                        borderTopRightRadius: isOwn && showHeader ? '2px' : '12px',
                        borderTopLeftRadius: !isOwn && showHeader ? '2px' : '12px',
                        backgroundColor: isOwn ? 'var(--primary-color)' : 'var(--bg-card)',
                        color: isOwn ? 'white' : 'var(--text-primary)',
                        maxWidth: '75%',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: isOwn ? 'none' : '1px solid var(--glass-border)'
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-dark)' }}>
              <form onSubmit={sendMessage} style={{ 
                display: 'flex', 
                gap: '12px', 
                background: 'var(--bg-card)', 
                padding: '8px 12px', 
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'var(--transition)'
              }}
              onFocusCapture={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
              onBlurCapture={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
              >
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeChannelObj?.isDirectMessage ? '@' : '#'}${getChannelDisplayName(activeChannelObj)}`}
                  style={{ 
                    flex: 1, 
                    padding: '8px 4px', 
                    backgroundColor: 'transparent', 
                    border: 'none', 
                    color: 'white', 
                    outline: 'none',
                    fontSize: '0.95rem'
                  }}
                  disabled={isSending}
                />
                <button 
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: (isSending || !newMessage.trim()) ? 'rgba(255,255,255,0.05)' : 'var(--primary-color)', 
                    color: (isSending || !newMessage.trim()) ? 'var(--text-secondary)' : 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: (isSending || !newMessage.trim()) ? 'not-allowed' : 'pointer', 
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    transition: 'var(--transition)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  {isSending ? 'Sending' : 'Send'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-dark)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Welcome to Zyntry</h2>
            <p style={{ maxWidth: '400px', lineHeight: '1.6', fontSize: '0.95rem' }}>Select a channel from the sidebar to join the conversation and start messaging in real-time.</p>
            {window.innerWidth <= 768 && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}
              >
                Open Sidebar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Browse Channels Modal */}
      {isBrowsingChannels && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          backdropFilter: 'blur(8px)',
          zIndex: 3000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '500px', 
            backgroundColor: 'var(--bg-card)', 
            borderRadius: '16px', 
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-premium)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>Browse Channels</h3>
              <button onClick={() => setIsBrowsingChannels(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
              {isLoadingPublic ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading channels...</div>
              ) : publicChannels.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <p>No new channels found.</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {publicChannels.map(ch => (
                    <li key={ch._id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      marginBottom: '8px',
                      border: '1px solid var(--glass-border)'
                    }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}># {ch.name}</span>
                      </div>
                      <button 
                        onClick={() => handleJoinPublicChannel(ch._id)}
                        style={{ padding: '8px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                      >Join</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {isCreatingWorkspace && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          backdropFilter: 'blur(8px)',
          zIndex: 4000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '400px', 
            backgroundColor: 'var(--bg-card)', 
            borderRadius: '16px', 
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-premium)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>Create Workspace</h3>
              <button onClick={() => setIsCreatingWorkspace(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={createWorkspace} style={{ padding: '24px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Workspaces are the top-level container for your channels and messages.</p>
              <input 
                type="text" 
                placeholder="Workspace name (e.g. Acme Corp)"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.9rem', marginBottom: '20px' }}
                autoFocus
              />
              <button 
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)' }}
              >
                Create Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Workspace Modal */}
      {isJoiningWorkspace && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          backdropFilter: 'blur(8px)',
          zIndex: 4000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '500px', 
            backgroundColor: 'var(--bg-card)', 
            borderRadius: '16px', 
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-premium)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>Join Workspace</h3>
              <button onClick={() => setIsJoiningWorkspace(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
              {isLoadingPublicWorkspaces ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading workspaces...</div>
              ) : publicWorkspaces.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <p>No other workspaces available to join.</p>
                  <button 
                    onClick={() => { setIsJoiningWorkspace(false); setIsCreatingWorkspace(true); }}
                    style={{ marginTop: '16px', background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                  >Create One Instead</button>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {publicWorkspaces.map(ws => (
                    <li key={ws._id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '16px', 
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      marginBottom: '10px',
                      border: '1px solid var(--glass-border)'
                    }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1rem' }}>{ws.name}</span>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ws.members?.length || 0} members</p>
                      </div>
                      <button 
                        onClick={() => handleJoinWorkspace(ws._id)}
                        style={{ padding: '8px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                      >Join</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .sidebar-closed {
          width: 0 !important;
          min-width: 0 !important;
        }
        .sidebar-item:hover .cancel-btn {
          display: flex !important;
        }
        .cancel-btn:hover {
          color: #ef4444 !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
