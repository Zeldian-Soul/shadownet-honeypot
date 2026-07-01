import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// --- Interfaces ---
interface PortDistribution { target_port: number; total_attacks: number; }
interface HourlyTimeline { attack_hour: string; attack_count: number; }
interface GeoDistribution { country: string; count: number; }
interface AnalyticsData {
  distribution: PortDistribution[];
  timeline: HourlyTimeline[];
  geoDistribution: GeoDistribution[];
}
interface ThreatLog {
  id: number;
  attacker_ip: string;
  target_port: number;
  attempted_username: string | null;
  attack_timestamp: string;
  country_code: string;
  city: string;
}

export default function WebCommandCenter() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({ distribution: [], timeline: [], geoDistribution: [] });
  const [logs, setLogs] = useState<ThreatLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // UX State: Controls which tab is currently active
  const [activeTab, setActiveTab] = useState<'overview' | 'geo' | 'stream'>('overview');

  const fetchData = async () => {
    try {
      const [analyticsRes, logsRes] = await Promise.all([
        axios.get<AnalyticsData>(`${API_BASE_URL}/analytics`),
        axios.get<ThreatLog[]>(`${API_BASE_URL}/threats`)
      ]);
      setAnalytics(analyticsRes.data);
      setLogs(logsRes.data);
      setLoading(false);
    } catch (err: unknown) {
      if (err instanceof Error) console.error('Error fetching data:', err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBan = async (ip: string) => {
    try {
      alert(`Initiating network ban protocol for ${ip}...`);
      await axios.post(`${API_BASE_URL}/firewall`, { ip, action: 'ban' });
      alert('Target successfully isolated at the firewall level.');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to execute ban.');
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4444', fontFamily: 'sans-serif' }}>
        <h2>INITIALIZING SECURE UPLINK...</h2>
      </div>
    );
  }

  const maxAttackCount = Math.max(...analytics.timeline.map(t => t.attack_count), 1);

  // Helper for tab styling
  const getTabStyle = (tabName: string) => ({
    padding: '12px 24px',
    backgroundColor: activeTab === tabName ? '#1a1a1a' : 'transparent',
    color: activeTab === tabName ? '#ff4444' : '#888',
    border: 'none',
    borderBottom: activeTab === tabName ? '2px solid #ff4444' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    outline: 'none'
  });

  return (
    // FIX: Lock viewport height to exactly 100vh and use Flexbox to manage internal scrolling
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* Header Panel (Fixed) */}
      <header style={{ padding: '20px 30px', backgroundColor: '#111', borderBottom: '1px solid #222' }}>
        <h1 style={{ color: '#ff4444', margin: 0, fontSize: '1.8rem', letterSpacing: '1px' }}>SHADOWNET COMMAND CENTER</h1>
        <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '0.85rem' }}>Real-Time Threat Intelligence Aggregator</p>
      </header>

      {/* Navigation Tabs (Fixed) */}
      <nav style={{ display: 'flex', backgroundColor: '#0a0a0a', borderBottom: '1px solid #222', padding: '0 30px' }}>
        <button style={getTabStyle('overview')} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button style={getTabStyle('geo')} onClick={() => setActiveTab('geo')}>GLOBAL INTEL</button>
        <button style={getTabStyle('stream')} onClick={() => setActiveTab('stream')}>LIVE STREAM</button>
      </nav>

      {/* Main Content Area (Scrollable) */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
        
        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Port Activity Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              {analytics.distribution.length > 0 ? analytics.distribution.map(port => (
                <div key={port.target_port} style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
                  <div style={{ color: '#888', fontSize: '0.85rem', fontWeight: 'bold' }}>PORT {port.target_port} ACTIVITY</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff4444', marginTop: '10px' }}>{port.total_attacks} <span style={{ fontSize: '1rem', color: '#444' }}>probes</span></div>
                </div>
              )) : (
                <div style={{ color: '#555', padding: '20px', border: '1px dashed #333' }}>No port activity detected.</div>
              )}
            </div>

            {/* Timeline Profile */}
            <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#aaa' }}>24-Hour Attack Timeline Profile</h3>
              
              {analytics.timeline.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: '15px', paddingBottom: '10px', borderBottom: '1px solid #333' }}>
                  {analytics.timeline.map((hour, idx) => {
                    const heightPercentage = (hour.attack_count / maxAttackCount) * 100;
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '100%', height: `${heightPercentage}%`, backgroundColor: '#ff4444', borderRadius: '3px 3px 0 0', minHeight: '4px' }}></div>
                        <span style={{ color: '#555', fontSize: '0.75rem', marginTop: '8px' }}>{hour.attack_hour}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', borderBottom: '1px solid #222' }}>
                  NO TRAFFIC LOGGED IN THE LAST 24 HOURS
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: GLOBAL INTEL ================= */}
        {activeTab === 'geo' && (
          <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#aaa' }}>Geographic Source Distribution (Top Origins)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {analytics.geoDistribution.length > 0 ? analytics.geoDistribution.map((geo, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#161616', padding: '16px', borderRadius: '4px', borderLeft: '3px solid #555' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>📍 {geo.country}</span>
                  <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '1.1rem' }}>{geo.count} <span style={{ color: '#666', fontSize: '0.85rem' }}>attacks</span></span>
                </div>
              )) : (
                 <div style={{ color: '#555', padding: '20px', textAlign: 'center' }}>No geographic data available yet.</div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: LIVE STREAM ================= */}
        {activeTab === 'stream' && (
          <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#aaa' }}>Live Security Stream</h3>
            
            {/* The internal scrollable log container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.length > 0 ? logs.map(log => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161616', padding: '16px', borderRadius: '4px', borderLeft: '3px solid #ff4444', fontFamily: 'monospace' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>{log.attacker_ip}</span>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Target: Port <strong style={{ color: '#ffcc00' }}>{log.target_port}</strong></span>
                  </div>
                  
                  <span style={{ color: '#aaa', fontSize: '0.9rem' }}>📍 {log.city} ({log.country_code})</span>
                  
                  <button 
                    onClick={() => handleBan(log.attacker_ip)}
                    style={{ 
                      backgroundColor: 'transparent', color: '#ff4444', border: '1px solid #ff4444', 
                      padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ff444433'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    BLOCK IP
                  </button>

                </div>
              )) : (
                <div style={{ color: '#555', padding: '20px', textAlign: 'center' }}>Awaiting network activity...</div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}