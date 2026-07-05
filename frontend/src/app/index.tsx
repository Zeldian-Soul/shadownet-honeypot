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
  session_id: string | null;
  coordinates: [number, number]; // Added Session Tracking
}

export default function WebCommandCenter() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({ distribution: [], timeline: [], geoDistribution: [] });
  const [logs, setLogs] = useState<ThreatLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  
  const [activeTab, setActiveTab] = useState<'overview' | 'geo' | 'stream'>('overview');
  
  // UX State: Forensic Replay Modal
  const [replaySession, setReplaySession] = useState<string | null>(null);
  
  // 🗺️ NEW: Dynamic Map State
  const [MapLib, setMapLib] = useState<any>(null);

  useEffect(() => {
    // Only run this inside the actual web browser (bypassing SSR)
    if (typeof window !== 'undefined') {
      // 1. Safely inject Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // 2. Dynamically require the libraries
      const L = require('leaflet');
      const RL = require('react-leaflet');

      // 3. Build the Cyber Icon
      const cyberIcon = L.divIcon({
        className: 'custom-cyber-icon',
        html: '<div style="background-color: #ff4444; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 12px #ff4444; border: 2px solid #222;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      // 4. Save to state so React can use them
      setMapLib({
        MapContainer: RL.MapContainer,
        TileLayer: RL.TileLayer,
        Marker: RL.Marker,
        Popup: RL.Popup,
        cyberIcon
      });
    }
  }, []);

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

  // Group logs by session for the Live Stream view
  const sessionGroups = logs.reduce((acc, log) => {
    const key = log.session_id || log.attacker_ip; // Fallback for older logs without IDs
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, ThreatLog[]>);

  // Extract the specific logs for the active replay modal, sorted chronologically
  const activeReplayLogs = replaySession ? (sessionGroups[replaySession] || []).sort((a, b) => new Date(a.attack_timestamp).getTime() - new Date(b.attack_timestamp).getTime()) : [];

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* --- FORENSIC REPLAY MODAL --- */}
      {replaySession && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#111', border: '1px solid #ff4444', borderRadius: '6px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#ff4444' }}>FORENSIC REPLAY: {activeReplayLogs[0]?.attacker_ip}</h3>
              <button onClick={() => setReplaySession(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#050505', fontFamily: 'monospace' }}>
              {activeReplayLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#555' }}>[{new Date(log.attack_timestamp).toLocaleTimeString()}]</span>{' '}
                  <span style={{ color: '#00ff00' }}>root@ubuntu:~#</span>{' '}
                  <span style={{ color: '#fff' }}>{log.attempted_username}</span>
                </div>
              ))}
            </div>
            
            <div style={{ padding: '15px 20px', borderTop: '1px solid #333', textAlign: 'right' }}>
               <button onClick={() => handleBan(activeReplayLogs[0]?.attacker_ip)} style={{ backgroundColor: '#ff4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ISOLATE THREAT (BAN IP)
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <header style={{ padding: '20px 30px', backgroundColor: '#111', borderBottom: '1px solid #222' }}>
        <h1 style={{ color: '#ff4444', margin: 0, fontSize: '1.8rem', letterSpacing: '1px' }}>SHADOWNET COMMAND CENTER</h1>
        <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '0.85rem' }}>Real-Time Threat Intelligence Aggregator</p>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', backgroundColor: '#0a0a0a', borderBottom: '1px solid #222', padding: '0 30px' }}>
        <button style={getTabStyle('overview')} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button style={getTabStyle('geo')} onClick={() => setActiveTab('geo')}>GLOBAL INTEL</button>
        <button style={getTabStyle('stream')} onClick={() => setActiveTab('stream')}>LIVE STREAM</button>
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
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

        {/* TAB 2: GLOBAL INTEL (Geospatial Heatmap) */}
        {activeTab === 'geo' && (
          <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px', height: '600px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#aaa' }}>Live Global Threat Heatmap</h3>
            
            <div style={{ flex: 1, borderRadius: '4px', overflow: 'hidden', border: '1px solid #333' }}>
              {!MapLib ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ff4444' }}>
                  INITIALIZING SATELLITE UPLINK...
                </div>
              ) : (
                <MapLib.MapContainer 
                  center={[20, 0]} 
                  zoom={2} 
                  style={{ height: '100%', width: '100%', backgroundColor: '#0a0a0a' }}
                  scrollWheelZoom={true}
                >
                  <MapLib.TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CARTO'
                  />
                  
                  {logs.map((log) => {
                    if (log.coordinates && log.coordinates.length === 2) {
                       return (
                         <MapLib.Marker key={log.id} position={[log.coordinates[0], log.coordinates[1]]} icon={MapLib.cyberIcon}>
                           <MapLib.Popup>
                             <div style={{ color: '#000', fontFamily: 'sans-serif' }}>
                               <strong>IP: {log.attacker_ip}</strong><br/>
                               📍 {log.city}, {log.country_code}<br/>
                               🎯 Target Port: {log.target_port}
                             </div>
                           </MapLib.Popup>
                         </MapLib.Marker>
                       )
                    }
                    return null;
                  })}
                </MapLib.MapContainer>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LIVE STREAM */}
        {activeTab === 'stream' && (
          <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#aaa' }}>Live Security Stream (Grouped by Session)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.keys(sessionGroups).length > 0 ? Object.values(sessionGroups).map((sessionLogs, idx) => {
                const firstLog = sessionLogs[0];
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161616', padding: '16px', borderRadius: '4px', borderLeft: '3px solid #ff4444', fontFamily: 'monospace' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>{firstLog.attacker_ip}</span>
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>
                          Target: Port <strong style={{ color: '#ffcc00' }}>{firstLog.target_port}</strong> | 
                          Interactions: <strong style={{ color: '#00ccff' }}>{sessionLogs.length}</strong>
                        </span>
                    </div>
                    
                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>📍 {firstLog.city} ({firstLog.country_code})</span>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => setReplaySession(firstLog.session_id || firstLog.attacker_ip)}
                        style={{ backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        VIEW SESSION
                      </button>
                      <button 
                        onClick={() => handleBan(firstLog.attacker_ip)}
                        style={{ backgroundColor: 'transparent', color: '#ff4444', border: '1px solid #ff4444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        BLOCK
                      </button>
                    </div>

                  </div>
                );
              }) : (
                <div style={{ color: '#555', padding: '20px', textAlign: 'center' }}>Awaiting network activity...</div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}