import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const primaryButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'var(--transition)',
    boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.3)'
  };

  const secondaryButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'var(--transition)'
  };

  const featureCardStyle = {
    padding: '32px',
    backgroundColor: 'var(--glass-bg)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-border)',
    borderRadius: '24px',
    textAlign: 'center',
    transition: 'var(--transition)'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--bg-dark)', 
      color: 'var(--text-primary)',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Navbar */}
      <nav style={{ 
        padding: '20px 40px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid var(--glass-border)',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <h1 style={{ 
          fontSize: '1.75rem', 
          fontWeight: '800', 
          color: 'var(--primary-color)',
          margin: 0,
          fontFamily: "'Outfit', sans-serif"
        }}>Zyntry</h1>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => navigate('/login')}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-primary)', 
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >Login</button>
          <button 
            onClick={() => navigate('/register')}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              fontWeight: '700', 
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'var(--transition)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
          >Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ 
        padding: '120px 20px 100px', 
        textAlign: 'center',
        background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.15), transparent 40%), radial-gradient(circle at bottom left, rgba(15, 23, 42, 1), transparent 40%)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: '4.5rem', 
            fontWeight: '800', 
            marginBottom: '24px',
            lineHeight: '1.1',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.03em'
          }}>Real-time team collaboration <span style={{ color: 'var(--primary-color)' }}>made simple</span></h1>
          <p style={{ 
            fontSize: '1.25rem', 
            color: 'var(--text-secondary)', 
            marginBottom: '48px',
            lineHeight: '1.6',
            maxWidth: '600px',
            margin: '0 auto 48px'
          }}>Zyntry brings your team together with powerful workspaces, channels, and instant messaging. Scale your productivity without the noise.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/register')}
              style={primaryButtonStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >Get Started for Free</button>
            <button 
              onClick={() => navigate('/login')}
              style={secondaryButtonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
            >Login</button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section style={{ padding: '100px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '800', 
          textAlign: 'center', 
          marginBottom: '60px',
          fontFamily: "'Outfit', sans-serif"
        }}>Everything you need to <span style={{ color: 'var(--primary-color)' }}>succeed</span></h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '32px' 
        }}>
          <div style={featureCardStyle}>
            <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary-color)' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px' }}>Real-time messaging</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>Experience lightning-fast communication with instant message delivery.</p>
          </div>

          <div style={featureCardStyle}>
            <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary-color)' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px' }}>Channels & Workspaces</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>Organize your projects and teams into dedicated spaces and channels.</p>
          </div>

          <div style={featureCardStyle}>
            <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary-color)' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px' }}>Direct Messaging</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>Connect one-on-one with team members for private collaboration.</p>
          </div>

          <div style={featureCardStyle}>
            <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary-color)' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px' }}>Simple Collaboration</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>A clean, focused interface designed to let you work without distractions.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ padding: '100px 20px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            textAlign: 'center', 
            marginBottom: '60px',
            fontFamily: "'Outfit', sans-serif"
          }}>How it works</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
              <div style={{ width: '50px', height: '50px', backgroundColor: 'var(--primary-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.5rem', flexShrink: 0 }}>1</div>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>Create or join a workspace</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Set up a space for your organization or join an existing one via invitation.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
              <div style={{ width: '50px', height: '50px', backgroundColor: 'var(--primary-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.5rem', flexShrink: 0 }}>2</div>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>Join channels or start DMs</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Organize conversations by topic in channels or message teammates directly.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
              <div style={{ width: '50px', height: '50px', backgroundColor: 'var(--primary-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.5rem', flexShrink: 0 }}>3</div>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>Chat in real-time</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Collaborate effortlessly with instant message delivery and real-time presence.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        padding: '60px 20px', 
        borderTop: '1px solid var(--glass-border)',
        textAlign: 'center',
        backgroundColor: 'var(--bg-dark)'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '800', 
          color: 'var(--primary-color)',
          marginBottom: '24px',
          fontFamily: "'Outfit', sans-serif"
        }}>Zyntry</h2>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '32px' }}>
          <button 
            onClick={() => navigate('/login')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >Login</button>
          <button 
            onClick={() => navigate('/register')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >Sign Up</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} Zyntry. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
