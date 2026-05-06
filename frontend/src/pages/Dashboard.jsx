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
  const [success, setSuccess] = useState(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [isBrowsingChannels, setIsBrowsingChannels] = useState(false);
  const [publicChannels, setPublicChannels] = useState([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(localStorage.getItem('activeWorkspace') || null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [settingsTab, setSettingsTab] = useState('members');
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isJoiningWorkspace, setIsJoiningWorkspace] = useState(false);
  const [publicWorkspaces, setPublicWorkspaces] = useState([]);
  const [isLoadingPublicWorkspaces, setIsLoadingPublicWorkspaces] = useState(false);
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [isInvitingUser, setIsInvitingUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [userInvites, setUserInvites] = useState([]); // Invites for the current user across all workspaces
  const [viewedUser, setViewedUser] = useState(null);
  const [isViewingProfile, setIsViewingProfile] = useState(false);

  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const [channelToLeave, setChannelToLeave] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ channels: [], users: [] });

  const [lookupSlug, setLookupSlug] = useState('');
  const [workspacePreview, setWorkspacePreview] = useState(null);
  const [isSearchingEmail, setIsSearchingEmail] = useState(false);
  const [foundWorkspaces, setFoundWorkspaces] = useState([]);
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);



  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);




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

    if (socketRef.current) {
      socketRef.current.on('new_notification', (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });
    }

    if (socketRef.current) {
      socketRef.current.on('user_presence_update', (data) => {
        const { userId, status, customStatus } = data;
        // Update channels members
        setChannels(prev => prev.map(ch => ({
          ...ch,
          members: ch.members.map(m => m._id === userId ? { ...m, status, customStatus: customStatus || m.customStatus } : m),
          participants: ch.participants.map(p => p._id === userId ? { ...p, status, customStatus: customStatus || p.customStatus } : p)
        })));
        // Update workspaceDetails members
        setWorkspaceDetails(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            members: prev.members.map(m => m._id === userId ? { ...m, status, customStatus: customStatus || m.customStatus } : m)
          };
        });
      });
    }

    // Inactivity heartbeat
    const heartbeat = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('user_activity');
      }
    }, 60000); // Every 1 minute

    return () => {
      clearInterval(heartbeat);
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
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      setChannels(res.data);

      // Auto-select general channel if no channel is selected
      if (res.data.length > 0 && !selectedChannel) {
        const general = res.data.find(c => c.name === 'general');
        if (general) {
          joinChannel(general._id);
        }
      }

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

      // If we have an active workspace set in state, verify it still exists in the fetched list
      if (activeWorkspace && !res.data.some(ws => ws._id === activeWorkspace)) {
        setActiveWorkspace(null);
        localStorage.removeItem('activeWorkspace');
      }

      if (res.data.length === 0) {
        setIsCreatingWorkspace(true);
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      setError('Failed to load workspaces');
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  const fetchUserInvites = async () => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/workspaces/invites/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserInvites(res.data);
    } catch (err) {
      console.error('Error fetching user invites:', err);
    }
  };



  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchWorkspaces();
      fetchUserInvites();
      fetchNotifications();

      // Handle invite links (?invite=slug)
      const params = new URLSearchParams(window.location.search);
      const inviteSlug = params.get('invite');
      if (inviteSlug) {
        setLookupSlug(inviteSlug);
        setIsJoiningWorkspace(true);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [token, navigate]);

  // Global Search Shortcut & Resize Listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true); // Always show sidebar on desktop
      }
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setIsSearching(true);
      }
      if (e.key === 'Escape') {
        setIsSearching(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults({ channels: [], users: [] });
      return;
    }

    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/search?q=${query}&workspaceId=${activeWorkspace}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleLookupWorkspace = async (e) => {
    e.preventDefault();
    if (!lookupSlug.trim()) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/workspaces/lookup/${lookupSlug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspacePreview(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Workspace not found');
    }
  };

  useEffect(() => {
    if (isJoiningWorkspace && lookupSlug && !workspacePreview) {
      const triggerLookup = async () => {
        try {
          const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
          const res = await axios.get(`${apiBaseUrl}/workspaces/lookup/${lookupSlug}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setWorkspacePreview(res.data);
        } catch (err) {
          // Silent fail for auto-lookup
        }
      };
      triggerLookup();
    }
  }, [isJoiningWorkspace, lookupSlug, token]);

  const findWorkspacesByEmail = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      const res = await axios.post(`${apiBaseUrl}/workspaces/find`, { email: inviteEmail }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFoundWorkspaces(res.data);
      setIsSearchingEmail(true);
    } catch (err) {
      setError('Failed to find workspaces');
    }
  };

  const fetchWorkspaceDetails = async (id) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/workspaces/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspaceDetails(res.data);
      setEditSlug(res.data.slug || '');
      setEditDomain(res.data.settings?.allowedDomain || '');
    } catch (err) {
      console.error('Error fetching workspace details:', err);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('activeWorkspace', activeWorkspace);
      fetchChannels();
      fetchWorkspaceDetails(activeWorkspace);
      setSelectedChannel(null); // Clear selection when workspace changes
      setMessages([]);
    } else {
      localStorage.removeItem('activeWorkspace');
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
            headers: {
              Authorization: `Bearer ${token}`,
              'x-workspace-id': activeWorkspace
            }
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

  const fetchNotifications = async () => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
      await axios.put(`${apiBaseUrl}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read');
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
      await axios.put(`${apiBaseUrl}/notifications/read-all`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (notification) => {
    markNotificationAsRead(notification._id);
    setIsNotificationOpen(false);

    if (notification.type === 'WORKSPACE_INVITE') {
      setIsJoiningWorkspace(true);
    } else if (notification.type === 'JOIN_REQUEST_APPROVED') {
      fetchWorkspaces();
      if (notification.metadata?.workspaceId) {
        setActiveWorkspace(notification.metadata.workspaceId);
      }
    } else if (notification.type === 'DIRECT_MESSAGE' || notification.type === 'MENTION') {
      if (notification.metadata?.channelId) {
        joinChannel(notification.metadata.channelId);
      }
    }
  };

  const logout = () => {
    removeToken();
    localStorage.removeItem('user');
    if (socketRef.current) socketRef.current.disconnect();
    navigate('/login');
  };

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
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
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
        description: newChannelDescription,
        workspaceId: activeWorkspace
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      setNewChannelName('');
      setNewChannelDescription('');
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
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
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

  const handleLeaveChannel = (e, channelId) => {
    e.stopPropagation(); // Prevent selecting the channel when clicking 'x'
    setChannelToLeave(channelId);
    setIsConfirmingLeave(true);
  };

  const confirmLeaveChannel = async () => {
    if (!channelToLeave) return;

    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/channels/${channelToLeave}/leave`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      if (selectedChannel === channelToLeave) {
        setSelectedChannel(null);
      }
      await fetchChannels();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave channel');
    } finally {
      setIsConfirmingLeave(false);
      setChannelToLeave(null);
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

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
      const res = await axios.post(`${apiBaseUrl}/workspaces`, {
        name: newWorkspaceName,
        slug: newWorkspaceSlug,
        description: newWorkspaceDescription
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewWorkspaceName('');
      setNewWorkspaceSlug('');
      setNewWorkspaceDescription('');
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

  const handleRequestToJoin = async (workspaceId) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/workspaces/${workspaceId}/request`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Join request sent! Waiting for owner approval.');
      setIsJoiningWorkspace(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send join request');
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/workspaces/${activeWorkspace}/invite`, {
        email: inviteEmail.includes('@') ? inviteEmail : undefined,
        username: !inviteEmail.includes('@') ? inviteEmail : undefined
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      setInviteEmail('');
      setIsInvitingUser(false);
      fetchWorkspaceDetails(activeWorkspace);
      setSuccess('Invite sent successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invite');
    }
  };

  const handleApproveRequest = async (userId) => {
    setIsProcessingApproval(true);
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/workspaces/${activeWorkspace}/approve`, { userId }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      await fetchWorkspaceDetails(activeWorkspace);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleRejectRequest = async (userId) => {
    setIsProcessingApproval(true);
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/workspaces/${activeWorkspace}/reject`, { userId }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-workspace-id': activeWorkspace
        }
      });
      await fetchWorkspaceDetails(activeWorkspace);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleAcceptInvite = async (workspaceId) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.post(`${apiBaseUrl}/workspaces/invite/accept`, { workspaceId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Invite accepted! You have joined the workspace.');
      fetchUserInvites();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invite');
    }
  };

  const handleUpdateRole = async (userId, role) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
      await axios.put(`${apiBaseUrl}/workspaces/${activeWorkspace}/members/${userId}/role`, { role }, {
        headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': activeWorkspace }
      });
      fetchWorkspaceDetails(activeWorkspace);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
      await axios.delete(`${apiBaseUrl}/workspaces/${activeWorkspace}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': activeWorkspace }
      });
      fetchWorkspaceDetails(activeWorkspace);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!window.confirm('WARNING: Are you sure you want to DELETE this entire workspace? This cannot be undone.')) return;
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
      await axios.delete(`${apiBaseUrl}/workspaces/${activeWorkspace}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': activeWorkspace }
      });
      setActiveWorkspace(null);
      localStorage.removeItem('activeWorkspace');
      fetchWorkspaces();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete workspace');
    }
  };

  const handleUpdateWorkspaceSettings = async () => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      await axios.put(`${apiBaseUrl}/workspaces/${activeWorkspace}/settings`, {
        slug: editSlug,
        settings: {
          allowedDomain: editDomain
        }
      }, {
        headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': activeWorkspace }
      });
      setSuccess('Workspace settings updated successfully');
      fetchWorkspaceDetails(activeWorkspace);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update settings');
    }
  };

  const handleViewProfile = async (userId) => {
    try {
      const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://zyntry.onrender.com/api';
      const res = await axios.get(`${apiBaseUrl}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setViewedUser(res.data);
      setIsViewingProfile(true);
    } catch (err) {
      setError('Failed to load user profile');
    }
  };



  useEffect(() => {
    if (isJoiningWorkspace) {
      fetchPublicWorkspaces();
    }
  }, [isJoiningWorkspace]);

  const activeChannelObj = channels.find(c => c._id === selectedChannel);

  return (
    <div className="dashboard-container">
      {/* Mobile Sidebar Toggle (Floating if no workspace) */}
      {isMobile && !activeWorkspace && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 1000,
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-premium)'
          }}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* Mobile Overlay */}
      {isSidebarOpen && isMobile && (
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

      {/* Success Notification */}
      {success && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-premium)',
          zIndex: 2000,
          animation: 'fadeIn 0.3s ease-out',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          {success}
        </div>
      )}

      {/* Workspace Rail */}
      <div className={`workspace-rail ${isMobile && isSidebarOpen ? 'open' : ''}`}>
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
      {activeWorkspace && (
        <div className={`mobile-sidebar ${isSidebarOpen ? 'open' : 'sidebar-closed'}`} style={{ left: isMobile ? (isSidebarOpen ? '72px' : '-300px') : '0' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 
                  onClick={() => navigate('/')}
                  style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '2px', cursor: 'pointer' }}
                >Zyntry</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: '600' }}>
                  {workspaces.find(ws => ws._id === activeWorkspace)?.name || 'Select Workspace'}
                </p>
                {workspaceDetails && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Permission check: Creator OR Owner/Admin role */}
                    {(() => {
                      const userId = user?.id || user?._id;
                      if (!userId) return false;

                      const isCreator = workspaceDetails.createdBy?.toString() === userId.toString();
                      const isAdmin = workspaceDetails.members?.some(m =>
                        (m._id?.toString() === userId.toString() || m.id?.toString() === userId.toString()) &&
                        ['owner', 'admin'].includes(m.role)
                      );

                      return isCreator || isAdmin;
                    })() && (
                        <>
                          <button
                            onClick={() => setIsWorkspaceSettingsOpen(true)}
                            style={{ background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                            title="Workspace Settings"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
                          <button
                            onClick={() => setIsInvitingUser(true)}
                            style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: '2px 6px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Invite User"
                          >
                            <span style={{ fontSize: '0.9rem', lineHeight: '1' }}>+</span>
                            <span>INVITE</span>
                          </button>
                        </>
                      )}
                  </div>
                )}
              </div>
            </div>
            {window.innerWidth <= 768 && (
              <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            {/* Owner Approval Section */}
            {workspaceDetails?.createdBy === user?.id && workspaceDetails?.pendingRequests?.length > 0 && (
              <div style={{ marginBottom: '24px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary-color)', fontWeight: '700', marginBottom: '12px' }}>Join Requests</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {workspaceDetails.pendingRequests.map(reqUser => (
                    <li key={reqUser._id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700' }}>{reqUser.username[0].toUpperCase()}</div>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{reqUser.username}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApproveRequest(reqUser._id)}
                          disabled={isProcessingApproval}
                          style={{ flex: 1, padding: '6px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                        >Approve</button>
                        <button
                          onClick={() => handleRejectRequest(reqUser._id)}
                          disabled={isProcessingApproval}
                          style={{ flex: 1, padding: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                        >Reject</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
              <form onSubmit={createChannel} style={{ padding: '0 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="New channel name..."
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                  autoFocus
                />
                <textarea
                  placeholder="Description (optional)..."
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.8rem', minHeight: '60px', resize: 'vertical' }}
                />
                <button type="submit" style={{ padding: '8px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}>Create</button>
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
              <div style={{ padding: '0 16px 16px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
                <form onSubmit={startDM} style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="Search workspace members..."
                    value={dmSearchQuery}
                    onChange={(e) => setDmSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                    autoFocus
                  />
                </form>

                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {workspaceDetails?.members?.filter(m =>
                    m._id !== user.id &&
                    (m.username.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                      m.email.toLowerCase().includes(dmSearchQuery.toLowerCase()))
                  ).map(member => (
                    <div
                      key={member._id}
                      onClick={async () => {
                        try {
                          const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
                          const res = await axios.post(`${apiBaseUrl}/channels/dm`, {
                            userId: member._id,
                            workspaceId: activeWorkspace
                          }, {
                            headers: {
                              Authorization: `Bearer ${token}`,
                              'x-workspace-id': activeWorkspace
                            }
                          });
                          setDmSearchQuery('');
                          setIsCreatingDM(false);
                          await fetchChannels();
                          joinChannel(res.data._id);
                        } catch (err) {
                          setError(err.response?.data?.message || 'Error starting DM');
                        }
                      }}
                      style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'var(--transition)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700', color: 'white' }}>
                        {member.username[0].toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{member.username}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{member.email}</span>
                      </div>
                    </div>
                  ))}
                  {workspaceDetails?.members?.length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No members found</div>
                  )}
                </div>
              </div>
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
                        <div style={{ position: 'relative' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', opacity: selectedChannel === ch._id ? 1 : 0.4 }}></div>
                          {ch.isDirectMessage && (
                            <div style={{
                              position: 'absolute',
                              bottom: '-4px',
                              right: '-4px',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              border: '1.5px solid var(--bg-sidebar)',
                              backgroundColor: ch.participants?.find(p => p._id !== user.id)?.status === 'online' ? '#10b981' : 'transparent',
                              boxShadow: ch.participants?.find(p => p._id !== user.id)?.status === 'away' ? 'inset 0 0 0 1.5px var(--text-secondary)' : 'none',
                              pointerEvents: 'none'
                            }}></div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.95rem' }}>{getChannelDisplayName(ch)}</span>
                        {ch.isDirectMessage && ch.participants?.find(p => p._id !== user.id)?.customStatus?.emoji && (
                          <span title={ch.participants.find(p => p._id !== user.id).customStatus.text} style={{ fontSize: '0.8rem' }}>{ch.participants.find(p => p._id !== user.id).customStatus.emoji}</span>
                        )}
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
            <div
              onClick={() => { setViewedUser(user); setIsViewingProfile(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'var(--transition)', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '16px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
            >
              <div style={{ position: 'relative' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.9rem', overflow: 'hidden' }}>
                  {user?.profilePicture ? (
                    <img src={user.profilePicture} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.username?.[0]?.toUpperCase()
                  )}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-sidebar)',
                  backgroundColor: user?.status === 'online' ? '#10b981' : 'transparent',
                  boxShadow: user?.status === 'away' ? 'inset 0 0 0 2px var(--text-secondary)' : 'none',
                  pointerEvents: 'none'
                }}></div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                  {user?.username} {user?.customStatus?.emoji}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Profile
                </p>
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
      )}

      {/* Main Content */}
      <div className="main-content">
        {!activeWorkspace ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-dark)' }}>
            <div style={{ width: '100%', maxWidth: '600px', padding: '40px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-premium)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>Select a Workspace</h2>
              <p style={{ maxWidth: '450px', margin: '0 auto 32px', lineHeight: '1.6', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                You must select a workspace to access your channels, messages, and team members.
              </p>

              {workspaces.length > 0 && (
                <div style={{ marginBottom: '32px', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px' }}>Your Workspaces</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {workspaces.map(ws => (
                      <div
                        key={ws._id}
                        onClick={() => setActiveWorkspace(ws._id)}
                        style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'var(--transition)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>
                          {ws.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{ws.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button
                  onClick={() => setIsCreatingWorkspace(true)}
                  style={{ padding: '14px 28px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                >Create Workspace</button>
                <button
                  onClick={() => setIsJoiningWorkspace(true)}
                  style={{ padding: '14px 28px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)' }}
                >Join Workspace</button>
              </div>

              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--glass-border)' }}>
                <button
                  onClick={onLogout}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                >Logout from Account</button>
              </div>
            </div>
          </div>
        ) : (
          selectedChannel ? (
            <>
              <header className="chat-header">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>

                <div className="hidden-mobile" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    onClick={() => setIsSearching(true)}
                    style={{
                      width: '100%',
                      maxWidth: '400px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <span>Search {workspaceDetails?.name || 'Workspace'}...</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5, border: '1px solid var(--glass-border)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + G</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {activeChannelObj?.isDirectMessage ? '@' : '#'} {getChannelDisplayName(activeChannelObj)}
                  </h2>
                  {activeChannelObj?.isDirectMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: activeChannelObj.participants?.find(p => p._id !== user.id)?.status === 'online' ? '#10b981' : 'transparent',
                        boxShadow: activeChannelObj.participants?.find(p => p._id !== user.id)?.status === 'away' ? 'inset 0 0 0 1.5px var(--text-secondary)' : 'none'
                      }}></div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {activeChannelObj.participants?.find(p => p._id !== user.id)?.status || 'offline'}
                      </span>
                      {activeChannelObj.participants?.find(p => p._id !== user.id)?.customStatus?.text && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px', opacity: 0.8 }}>
                          | {activeChannelObj.participants.find(p => p._id !== user.id).customStatus.emoji} {activeChannelObj.participants.find(p => p._id !== user.id).customStatus.text}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      {unreadCount > 0 && (
                        <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: '800', border: '2px solid var(--bg-card)' }}>
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {isNotificationOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        width: isMobile ? '280px' : '320px',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--glass-border)',
                        boxShadow: 'var(--shadow-premium)',
                        marginTop: '12px',
                        zIndex: 3000,
                        overflow: 'hidden',
                        animation: 'fadeIn 0.2s ease-out'
                      }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: '700' }}>Notifications</h4>
                          <button
                            onClick={markAllNotificationsAsRead}
                            style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                          >Mark all as read</button>
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {notifications.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No notifications yet</div>
                          ) : (
                            notifications.map(n => (
                              <div
                                key={n._id}
                                onClick={() => handleNotificationClick(n)}
                                style={{
                                  padding: '16px',
                                  borderBottom: '1px solid var(--glass-border)',
                                  cursor: 'pointer',
                                  backgroundColor: n.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                                  transition: 'var(--transition)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = n.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{n.title}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{n.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => setIsInfoSidebarOpen(!isInfoSidebarOpen)}
                    style={{ background: 'transparent', border: 'none', color: isInfoSidebarOpen ? 'var(--primary-color)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}
                    title="Show Info"
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
              </header>

              <div className="message-list">
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
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: '12px',
                        marginTop: showHeader ? '16px' : '2px',
                        paddingLeft: isOwn ? '0' : '0',
                        paddingRight: isOwn ? '0' : '0',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start'
                      }}>
                        {!isOwn && showHeader && (
                          <div
                            onClick={() => handleViewProfile(msg.sender?._id)}
                            style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-color)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.8rem', transition: 'var(--transition)' }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            {msg.sender?.profilePicture ? (
                              <img src={msg.sender.profilePicture} alt={msg.sender.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              msg.sender?.username?.[0]?.toUpperCase()
                            )}
                          </div>
                        )}
                        {!isOwn && !showHeader && <div style={{ width: '36px', flexShrink: 0 }} />}

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwn ? 'flex-end' : 'flex-start',
                          maxWidth: isMobile ? '90%' : '75%'
                        }}>
                          {showHeader && (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', padding: '0 4px' }}>
                              <span
                                onClick={() => !isOwn && handleViewProfile(msg.sender?._id)}
                                style={{ fontSize: '0.8rem', fontWeight: '700', color: isOwn ? 'var(--primary-color)' : 'var(--text-primary)', cursor: isOwn ? 'default' : 'pointer' }}
                              >
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
                            fontSize: '0.95rem',
                            lineHeight: '1.4',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            border: isOwn ? 'none' : '1px solid var(--glass-border)'
                          }}>
                            {msg.text}
                          </div>
                        </div>

                        {isOwn && showHeader && (
                          <div
                            onClick={() => { setViewedUser(user); setIsViewingProfile(true); }}
                            style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-color)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.8rem', transition: 'var(--transition)' }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            {user?.profilePicture ? (
                              <img src={user.profilePicture} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              user?.username?.[0]?.toUpperCase()
                            )}
                          </div>
                        )}
                        {isOwn && !showHeader && <div style={{ width: '36px', flexShrink: 0 }} />}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input-area">
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
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewMessage(value);

                        // Mention logic
                        const lastAtPos = value.lastIndexOf('@');
                        if (lastAtPos !== -1 && (lastAtPos === 0 || value[lastAtPos - 1] === ' ')) {
                          const query = value.substring(lastAtPos + 1);
                          if (!query.includes(' ')) {
                            setMentionQuery(query);
                            setShowMentions(true);
                            const filtered = workspaceDetails?.members?.filter(m =>
                              m.username.toLowerCase().includes(query.toLowerCase())
                            ) || [];
                            setMentionSuggestions(filtered);
                          } else {
                            setShowMentions(false);
                          }
                        } else {
                          setShowMentions(false);
                        }
                      }}
                      placeholder={`Message ${activeChannelObj?.isDirectMessage ? '@' : '#'}${getChannelDisplayName(activeChannelObj)}`}
                      style={{
                        width: '100%',
                        padding: '8px 4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'white',
                        outline: 'none',
                        fontSize: '0.95rem'
                      }}
                      disabled={isSending}
                    />

                    {showMentions && mentionSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        width: '240px',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        boxShadow: 'var(--shadow-premium)',
                        marginBottom: '8px',
                        overflow: 'hidden',
                        zIndex: 100
                      }}>
                        <div style={{ padding: '8px 12px', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700', borderBottom: '1px solid var(--glass-border)' }}>Members</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {mentionSuggestions.map(member => (
                            <div
                              key={member._id}
                              onClick={() => {
                                const lastAtPos = newMessage.lastIndexOf('@');
                                const before = newMessage.substring(0, lastAtPos);
                                const after = newMessage.substring(lastAtPos + mentionQuery.length + 1);
                                setNewMessage(`${before}@${member.username} ${after}`);
                                setShowMentions(false);
                              }}
                              style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'var(--transition)' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '700' }}>
                                {member.username[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize: '0.85rem' }}>{member.username}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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

              {/* Info Sidebar (Inside Chat Area) */}
              {isInfoSidebarOpen && (
                <div className={`info-sidebar ${isInfoSidebarOpen ? 'open' : ''}`}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Details</h3>
                    <button onClick={() => setIsInfoSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {/* Workspace Info (Always at the top of info sidebar) */}
                    <div style={{ marginBottom: '32px' }}>
                      <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px' }}>Workspace</h4>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px' }}>{workspaceDetails?.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{workspaceDetails?.slug}.zyntry.app</div>
                        {workspaceDetails?.description && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: '16px' }}>{workspaceDetails.description}</p>
                        )}
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Members</span>
                            <span style={{ fontWeight: '600' }}>{workspaceDetails?.members?.length || 0}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Owner</span>
                            <span style={{ fontWeight: '600' }}>{workspaceDetails?.createdBy === user?.id ? 'You' : workspaceDetails?.members?.find(m => m._id === workspaceDetails?.createdBy)?.username || 'Owner'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {activeChannelObj?.isDirectMessage ? (
                      /* DM Info */
                      <div>
                        <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px' }}>Conversation Partner</h4>
                        {(() => {
                          const otherUser = activeChannelObj.participants.find(p => p._id !== user.id);
                          if (!otherUser) return null;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                              <div
                                onClick={() => handleViewProfile(otherUser._id)}
                                style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: '700', color: 'white', marginBottom: '16px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)' }}
                              >
                                {otherUser.profilePicture ? (
                                  <img src={otherUser.profilePicture} style={{ width: '100%', height: '100%', borderRadius: '24px', objectFit: 'cover' }} alt={otherUser.username || 'User'} />
                                ) : (otherUser.username ? otherUser.username[0].toUpperCase() : '?')}
                              </div>
                              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '4px' }}>{otherUser.fullName || otherUser.username || 'Unknown User'}</h3>
                              <p style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: '600', marginBottom: '12px' }}>{otherUser.title || 'Team Member'}</p>

                              <div style={{ width: '100%', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email</label>
                                  <div style={{ fontSize: '0.85rem' }}>{otherUser.email}</div>
                                </div>
                                {otherUser.description && (
                                  <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Bio</label>
                                    <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{otherUser.description}</div>
                                  </div>
                                )}
                                <button
                                  onClick={() => handleViewProfile(otherUser._id)}
                                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', marginTop: '8px', transition: 'var(--transition)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
                                >Profile</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Channel Info */
                      <div>
                        <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px' }}>Channel Info</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}># {activeChannelObj?.name}</h3>
                            {activeChannelObj?.description && (
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: '16px' }}>{activeChannelObj.description}</p>
                            )}
                            <div style={{ display: 'grid', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
                              <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Created by</span>
                                <span style={{ fontWeight: '600' }}>{activeChannelObj?.createdBy?.username || 'Unknown'}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Created on</span>
                                <span style={{ fontWeight: '600' }}>{new Date(activeChannelObj?.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '12px' }}>Members ({activeChannelObj?.members?.length || 0})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {activeChannelObj?.members?.slice(0, 5).map(member => (
                                <div key={member._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', transition: 'var(--transition)', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} onClick={() => handleViewProfile(member._id)}>
                                  <div style={{ position: 'relative' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'white' }}>
                                      {member.profilePicture ? <img src={member.profilePicture} style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} alt={member.username || 'User'} /> : (member.username ? member.username[0].toUpperCase() : '?')}
                                    </div>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '-2px',
                                      right: '-2px',
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      border: '2px solid var(--bg-card)',
                                      backgroundColor: member.status === 'online' ? '#10b981' : 'transparent',
                                      boxShadow: member.status === 'away' ? 'inset 0 0 0 2px var(--text-secondary)' : 'none',
                                      pointerEvents: 'none'
                                    }}></div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                                      {member.username || 'Unknown'} {member._id === user?.id && '(You)'}
                                      {(() => {
                                        const wsRole = workspaceDetails?.members?.find(m => m._id === member._id)?.role;
                                        if (wsRole && wsRole !== 'member') {
                                          return (
                                            <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', marginLeft: '6px' }}>
                                              {wsRole}
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{member.title || 'Member'}</span>
                                  </div>
                                </div>
                              ))}
                              {activeChannelObj?.members?.length > 5 && (
                                <button style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', textAlign: 'left', padding: '8px' }}>
                                  Show all {activeChannelObj.members.length} members
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-dark)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Welcome to Zyntry</h2>
              <p style={{ maxWidth: '400px', lineHeight: '1.6', fontSize: '0.95rem' }}>Select a channel from the sidebar to join the conversation and start messaging in real-time.</p>
              {isMobile && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Open Sidebar
                </button>
              )}
            </div>
          )
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
                        onClick={() => {

                          handleJoinPublicChannel(ch._id);
                        }}
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
        <div className="modal-overlay" onClick={() => setIsCreatingWorkspace(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>Create Workspace</h3>
              <button onClick={() => setIsCreatingWorkspace(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={createWorkspace} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newWorkspaceName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewWorkspaceName(name);

                    // Auto-suggest slug: only if it hasn't been manually edited to something else
                    // For simplicity, we'll just suggest it if the current slug is empty
                    // or if it matches the slugified version of the previous name
                    const suggested = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                    setNewWorkspaceSlug(suggested);
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.9rem' }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Workspace URL (Slug)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="acme-corp"
                    value={newWorkspaceSlug}
                    onChange={(e) => setNewWorkspaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                    style={{ width: '100%', padding: '12px', paddingRight: '90px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.9rem' }}
                  />
                  <span style={{ position: 'absolute', right: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', pointerEvents: 'none' }}>.zyntry.app</span>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>This is how others will find your workspace. Leave blank to auto-generate.</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Description (Optional)</label>
                <textarea
                  placeholder="What is this workspace about?"
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.9rem', minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)', marginTop: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
              >
                Create Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Workspace Modal */}
      {isJoiningWorkspace && (
        <div className="modal-overlay" onClick={() => setIsJoiningWorkspace(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>Join Workspace</h3>
              <button onClick={() => setIsJoiningWorkspace(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {userInvites.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary-color)', fontWeight: '700', marginBottom: '12px' }}>Your Invitations</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {userInvites.map(inv => (
                      <li key={inv.workspaceId} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        marginBottom: '10px',
                        border: '1px solid rgba(16, 185, 129, 0.1)'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1rem' }}>{inv.workspaceName}</span>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>You've been invited!</p>
                        </div>
                        <button
                          onClick={() => handleAcceptInvite(inv.workspaceId)}
                          style={{ padding: '8px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                        >Accept Invite</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Find by Email */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Find My Workspaces</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Enter your email to find workspaces you belong to.</p>
                <form onSubmit={findWorkspacesByEmail} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                  />
                  <button type="submit" style={{ padding: '10px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}>Find</button>
                </form>

                {isSearchingEmail && (
                  <div style={{ marginTop: '16px' }}>
                    {foundWorkspaces.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No workspaces found.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {foundWorkspaces.map(ws => (
                          <li key={ws._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: '6px' }}>
                            <div>
                              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{ws.name}</span>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{ws.slug}.zyntry.app</p>
                            </div>
                            <button
                              onClick={() => {
                                if (ws.members.includes(user.id)) {
                                  setActiveWorkspace(ws._id);
                                  setIsJoiningWorkspace(false);
                                } else {
                                  handleRequestToJoin(ws._id);
                                }
                              }}
                              style={{ padding: '6px 12px', backgroundColor: ws.members.includes(user.id) ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                              {ws.members.includes(user.id) ? 'Launch' : 'Join'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Join by Slug */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Join by Workspace URL</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Enter the unique workspace slug.</p>
                <form onSubmit={handleLookupWorkspace} style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="acme-corp"
                      value={lookupSlug}
                      onChange={(e) => setLookupSlug(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', paddingRight: '90px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
                    />
                    <span style={{ position: 'absolute', right: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', pointerEvents: 'none' }}>.zyntry.app</span>
                  </div>
                  <button type="submit" style={{ padding: '10px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}>Lookup</button>
                </form>

                {workspacePreview && (
                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h5 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-color)' }}>{workspacePreview.name}</h5>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{workspacePreview.memberCount} members</p>
                      </div>
                      {!workspacePreview.isMember ? (
                        <button
                          onClick={() => handleRequestToJoin(workspacePreview._id)}
                          style={{ padding: '8px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                        >Request Access</button>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: '600' }}>Member</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isViewingProfile && viewedUser && (
        <div className="modal-overlay" onClick={() => { setIsViewingProfile(false); setViewedUser(null); }}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header Banner */}
            <div style={{ position: 'relative', height: '140px', background: `linear-gradient(135deg, var(--primary-color) 0%, #059669 100%)` }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.2, backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
              <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }}>
                {(viewedUser._id === user?.id || viewedUser.id === user?.id) && (
                  <>
                    <button 
                      onClick={() => navigate('/profile')}
                      title="Edit Profile"
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', transition: 'var(--transition)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button 
                      onClick={() => navigate('/profile')}
                      title="Settings & Status"
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', transition: 'var(--transition)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  </>
                )}
                <button 
                  onClick={() => { setIsViewingProfile(false); setViewedUser(null); }}
                  title="Close"
                  style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', transition: 'var(--transition)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)'}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div style={{ padding: '0 32px 32px', marginTop: '-60px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <div style={{ width: '110px', height: '110px', borderRadius: '32px', backgroundColor: 'var(--primary-color)', border: '6px solid var(--bg-card)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', position: 'relative' }}>
                  {viewedUser.profilePicture ? (
                    <img src={viewedUser.profilePicture} alt={viewedUser.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '2.8rem', fontWeight: '800', color: 'white' }}>{viewedUser.username?.[0]?.toUpperCase()}</span>
                  )}
                </div>

              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{viewedUser.fullName || viewedUser.username}</h2>
                  {viewedUser.customStatus?.emoji && <span style={{ fontSize: '1.5rem' }}>{viewedUser.customStatus.emoji}</span>}
                </div>
                {viewedUser.title && <p style={{ fontSize: '1rem', color: 'var(--primary-color)', fontWeight: '700', marginBottom: '12px' }}>{viewedUser.title}</p>}

                {viewedUser.customStatus?.text && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', width: 'fit-content', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>{viewedUser.customStatus.text}</span>
                  </div>
                )}

                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {viewedUser.description || (viewedUser._id === user?.id ? "Add a bio to tell people more about yourself." : "No bio provided.")}
                </p>
              </div>



              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>@{viewedUser.username}</span>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{viewedUser.email}</span>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{viewedUser.location || 'Not set'}</span>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timezone</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{viewedUser.timezone || 'Not set'}</span>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{viewedUser.company || 'Not set'}</span>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{viewedUser.contact?.phone || 'Not set'}</span>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: 'span 2' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Website</span>
                  {viewedUser.website || viewedUser.contact?.website ? (
                    <a href={viewedUser.website || viewedUser.contact?.website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.9rem', textDecoration: 'none' }}>{viewedUser.website || viewedUser.contact?.website}</a>
                  ) : (
                    <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>Not set</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Invite User Modal */}
      {isInvitingUser && (
        <div className="modal-overlay" onClick={() => setIsInvitingUser(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>Invite to Workspace</h3>
              <button onClick={() => setIsInvitingUser(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleInviteUser} style={{ padding: '24px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Enter the email or username of the person you'd like to invite.</p>
              <input
                type="text"
                placeholder="Email or username"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '0.9rem', marginBottom: '20px' }}
                autoFocus
              />
              <button
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)' }}
              >
                Send Invite
              </button>
            </form>
          </div>
        </div>
      )}


      {/* Global Search Modal */}
      {isSearching && (
        <div className="modal-backdrop" onClick={() => setIsSearching(false)}>
          <div className="confirm-modal" style={{ maxWidth: '600px', height: '60vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header" style={{ padding: '16px 24px' }}>
              <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ position: 'absolute', left: '16px', color: 'var(--primary-color)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  placeholder="Search channels, people, or messages..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '12px', border: '1px solid var(--primary-color)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none', fontSize: '1.1rem' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="confirm-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
              {!searchQuery ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <p>Search for anything in this workspace.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Channels Results */}
                  {searchResults.channels.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '12px' }}>Channels</h4>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {searchResults.channels.map(ch => (
                          <li
                            key={ch._id}
                            onClick={() => { joinChannel(ch._id); setIsSearching(false); }}
                            style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '4px', cursor: 'pointer', transition: 'var(--transition)', display: 'flex', alignItems: 'center', gap: '12px' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                          >
                            <span style={{ color: 'var(--primary-color)', fontWeight: '700' }}>{ch.isDirectMessage ? '@' : '#'}</span>
                            <span style={{ fontWeight: '600' }}>{getChannelDisplayName(ch)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Users Results */}
                  {searchResults.users.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '12px' }}>People</h4>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {searchResults.users.map(u => (
                          <li
                            key={u._id}
                            onClick={async () => {
                              // Logic to start DM with this user
                              try {
                                const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://zyntry.onrender.com/api';
                                const res = await axios.post(`${apiBaseUrl}/channels/dm`, {
                                  email: u.email,
                                  workspaceId: activeWorkspace
                                }, {
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    'x-workspace-id': activeWorkspace
                                  }
                                });
                                await fetchChannels();
                                joinChannel(res.data._id);
                                setIsSearching(false);
                              } catch (err) { setError('Failed to start conversation'); }
                            }}
                            style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '4px', cursor: 'pointer', transition: 'var(--transition)', display: 'flex', alignItems: 'center', gap: '12px' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                          >
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.8rem' }}>
                              {u.username ? u.username[0].toUpperCase() : '?'}
                            </div>
                            <div>
                              <span style={{ fontWeight: '600' }}>{u.username}</span>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.fullName || u.email}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {searchResults.channels.length === 0 && searchResults.users.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No results found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isConfirmingLeave && (
        <div className="modal-backdrop" onClick={() => setIsConfirmingLeave(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>Remove from Sidebar</h3>
            </div>
            <div className="confirm-modal-body">
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Are you sure you want to remove this from your sidebar? Your message history will not be deleted and you can join back later.
              </p>
            </div>
            <div className="confirm-modal-footer">
              <button className="btn-secondary" onClick={() => setIsConfirmingLeave(false)}>Cancel</button>
              <button className="btn-danger" onClick={confirmLeaveChannel}>Remove</button>
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
      {/* Workspace Settings Modal */}
      {isWorkspaceSettingsOpen && (
        <div className="modal-overlay" onClick={() => { setIsWorkspaceSettingsOpen(false); setSettingsTab('members'); }}>
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Workspace Settings</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{workspaces.find(ws => ws._id === activeWorkspace)?.name}</p>
              </div>
              <button onClick={() => { setIsWorkspaceSettingsOpen(false); setSettingsTab('members'); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 24px', gap: '20px' }}>
              <button 
                onClick={() => setSettingsTab('members')}
                style={{ padding: '12px 0', background: 'transparent', border: 'none', borderBottom: settingsTab === 'members' ? '2px solid var(--primary-color)' : '2px solid transparent', color: settingsTab === 'members' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}
              >Members</button>
              <button 
                onClick={() => setSettingsTab('general')}
                style={{ padding: '12px 0', background: 'transparent', border: 'none', borderBottom: settingsTab === 'general' ? '2px solid var(--primary-color)' : '2px solid transparent', color: settingsTab === 'general' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}
              >General</button>
              <button 
                onClick={() => setSettingsTab('audit')}
                style={{ padding: '12px 0', background: 'transparent', border: 'none', borderBottom: settingsTab === 'audit' ? '2px solid var(--primary-color)' : '2px solid transparent', color: settingsTab === 'audit' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}
              >Audit Log</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {settingsTab === 'members' && (
                <>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px' }}>Manage Members</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workspaceDetails?.members?.map(member => {
                  const isOwner = workspaceDetails.createdBy === user?.id;
                  const isSelf = member._id === user?.id;

                  return (
                    <div key={member._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}>
                          {member.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{member.username}</span>
                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>
                              {member.role || 'Member'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{member.email}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isOwner && !isSelf && (
                          <select
                            value={member.role || 'member'}
                            onChange={(e) => handleUpdateRole(member._id, e.target.value)}
                            style={{ padding: '6px 12px', backgroundColor: 'var(--bg-dark)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', outline: 'none' }}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="guest">Guest</option>
                          </select>
                        )}
                        {isOwner && !isSelf && (
                          <button
                            onClick={() => handleRemoveMember(member._id)}
                            style={{ padding: '6px 12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                          >Remove</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                  </div>
                </>
              )}

              {settingsTab === 'general' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700' }}>General Settings</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>Workspace Slug</label>
                    <input 
                      type="text" 
                      value={editSlug} 
                      onChange={(e) => setEditSlug(e.target.value)} 
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', outline: 'none' }} 
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Share this slug so people can join: <strong>{window.location.origin}/join/{editSlug}</strong></p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>Allowed Email Domain</label>
                    <input 
                      type="text" 
                      placeholder="e.g. company.com"
                      value={editDomain} 
                      onChange={(e) => setEditDomain(e.target.value)} 
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', outline: 'none' }} 
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Users with this email domain will automatically see your workspace.</p>
                  </div>

                  <button 
                    onClick={handleUpdateWorkspaceSettings}
                    style={{ padding: '10px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }}
                  >Save Settings</button>

                  {workspaceDetails?.createdBy === user?.id && (
                    <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--glass-border)' }}>
                      <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', fontWeight: '700', marginBottom: '12px' }}>Danger Zone</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Permanently delete this workspace and all its channels, messages, and files.</p>
                      <button
                        onClick={handleDeleteWorkspace}
                        style={{ padding: '10px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', width: '100%' }}
                      >Delete Workspace</button>
                    </div>
                  )}
                </div>
              )}

              {settingsTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700' }}>Audit Log</h4>
                  {(!workspaceDetails?.auditLogs || workspaceDetails.auditLogs.length === 0) ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No audit logs available.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {workspaceDetails.auditLogs.slice().reverse().map((log, index) => (
                        <div key={index} style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{log.action}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <p style={{ color: 'var(--text-primary)' }}>{log.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Dashboard;
