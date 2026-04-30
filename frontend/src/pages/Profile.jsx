import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken, getUser } from '../services/authService';

const Profile = () => {
  const navigate = useNavigate();
  const token = getToken();
  const currentUser = getUser();
  
  const [profile, setProfile] = useState({
    fullName: '',
    profilePicture: '',
    title: '',
    description: '',
    timezone: '',
    contact: {
      phone: '',
      website: ''
    },
    location: '',
    company: ''
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchProfile = async () => {
    if (!token || !currentUser) {
      navigate('/login');
      return;
    }
    
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
        
      const res = await axios.get(`${apiBaseUrl}/users/${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfile({
        ...res.data,
        contact: res.data.contact || { phone: '', website: '' }
      });
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setProfile(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://zyntry.onrender.com/api';
        
      await axios.put(`${apiBaseUrl}/users/profile`, {
        ...profile,
        phone: profile.contact.phone,
        website: profile.contact.website
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      // Update local storage user info if needed
      const updatedUser = { ...currentUser, profilePicture: profile.profilePicture };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !profile.username) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-dark)', color: 'white' }}>
        Loading profile...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)', color: 'var(--text-primary)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-premium)', overflow: 'hidden' }}>
        
        {/* Header/Back Button */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
          </button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary-color)' }}>User Profile</h2>
        </div>

        <div style={{ padding: '40px 32px' }}>
          {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
          {success && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary-color)', padding: '12px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{success}</div>}

          {!isEditing ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '40px', backgroundColor: 'var(--primary-color)', margin: '0 auto 24px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                {profile.profilePicture ? (
                  <img src={profile.profilePicture} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '3rem', fontWeight: '700', color: 'white' }}>{profile.username?.[0]?.toUpperCase()}</span>
                )}
              </div>
              
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px' }}>{profile.fullName || profile.username}</h1>
              {profile.title && <p style={{ fontSize: '1rem', color: 'var(--primary-color)', fontWeight: '600', marginBottom: '16px' }}>{profile.title}</p>}
              
              {profile.description ? (
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto 32px' }}>{profile.description}</p>
              ) : (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '32px' }}>No bio provided yet.</p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left', marginBottom: '40px' }}>
                <div className="profile-info-item">
                  <span className="label">Email</span>
                  <span className="value">{profile.email}</span>
                </div>
                <div className="profile-info-item">
                  <span className="label">Username</span>
                  <span className="value">@{profile.username}</span>
                </div>
                {profile.location && (
                  <div className="profile-info-item">
                    <span className="label">Location</span>
                    <span className="value">{profile.location}</span>
                  </div>
                )}
                {profile.timezone && (
                  <div className="profile-info-item">
                    <span className="label">Timezone</span>
                    <span className="value">{profile.timezone}</span>
                  </div>
                )}
                {profile.company && (
                  <div className="profile-info-item">
                    <span className="label">Company</span>
                    <span className="value">{profile.company}</span>
                  </div>
                )}
                {profile.contact.website && (
                  <div className="profile-info-item">
                    <span className="label">Website</span>
                    <a href={profile.contact.website} target="_blank" rel="noopener noreferrer" className="value" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>{profile.contact.website.replace(/^https?:\/\//, '')}</a>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsEditing(true)}
                style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)' }}
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" name="fullName" value={profile.fullName} onChange={handleChange} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label>Profile Picture URL</label>
                  <input type="text" name="profilePicture" value={profile.profilePicture} onChange={handleChange} placeholder="https://example.com/avatar.jpg" />
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" name="title" value={profile.title} onChange={handleChange} placeholder="Frontend Engineer" />
                </div>
                <div className="form-group">
                  <label>Bio (Max 200 chars)</label>
                  <textarea name="description" value={profile.description} onChange={handleChange} maxLength="200" rows="3" placeholder="Tell us about yourself..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="form-group">
                    <label>Location</label>
                    <input type="text" name="location" value={profile.location} onChange={handleChange} placeholder="San Francisco, CA" />
                  </div>
                  <div className="form-group">
                    <label>Timezone</label>
                    <input type="text" name="timezone" value={profile.timezone} onChange={handleChange} placeholder="GMT-7" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="form-group">
                    <label>Company</label>
                    <input type="text" name="company" value={profile.company} onChange={handleChange} placeholder="Zyntry Inc." />
                  </div>
                  <div className="form-group">
                    <label>Website</label>
                    <input type="text" name="contact.website" value={profile.contact.website} onChange={handleChange} placeholder="https://yourwebsite.com" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" name="contact.phone" value={profile.contact.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ flex: 1, padding: '14px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  style={{ flex: 2, padding: '14px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'var(--transition)' }}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .profile-info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .profile-info-item .label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .profile-info-item .value {
          font-size: 0.95rem;
          color: var(--text-primary);
          font-weight: 500;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .form-group input, .form-group textarea {
          padding: 12px;
          background-color: var(--bg-dark);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: white;
          outline: none;
          font-size: 0.95rem;
          transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group textarea:focus {
          border-color: var(--primary-color);
        }
      `}</style>
    </div>
  );
};

export default Profile;
