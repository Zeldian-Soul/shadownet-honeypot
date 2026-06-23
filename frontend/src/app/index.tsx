import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

interface PortDistribution {
  target_port: number;
  total_attacks: number;
}

interface HourlyTimeline {
  attack_hour: string;
  attack_count: number;
}

interface GeoDistribution {
  country: string;
  count: number;
}

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
  const [analytics, setAnalytics] = useState<AnalyticsData>({ 
    distribution: [], 
    timeline: [],
    geoDistribution: [] 
  });
  const [logs, setLogs] = useState<ThreatLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  if (loading) return <div style={{ color: '#aaa', padding: '40px', fontFamily: 'sans-serif' }}>Loading Global Intel...</div>;

  const maxAttackCount = Math.max(...analytics.timeline.map(t => t.attack_count), 1);

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', padding: '30px' }}>
      <header style={{ borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ color: '#ff4444', margin: 0, fontSize: '2rem', letterSpacing: '1px' }}>SHADOWNET COMMAND CENTER</h1>
        <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '0.9rem' }}>Real-Time Threat Intelligence Aggregator</p>
      </header>

      {/* Main Grid View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
        
        {/* Top Activity Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {analytics.distribution.map(port => (
            <div key={port.target_port} style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
              <div style={{ color: '#888', fontSize: '0.85rem', fontWeight: 'bold' }}>PORT {port.target_port} ACTIVITY</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ff4444', marginTop: '10px' }}>{port.total_attacks} probes</div>
            </div>
          ))}
        </div>

        {/* Global Origins Panel */}
        <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#aaa' }}>Geographic Source Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {analytics.geoDistribution.map((geo, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#161616', padding: '12px', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>📍 Country: {geo.country}</span>
                <span style={{ color: '#ff4444', fontWeight: 'bold' }}>{geo.count} attacks logged</span>
              </div>
            ))}
          </div>
        </div>

        {/* 24-Hour Timeline Profile */}
        <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#aaa' }}>24-Hour Attack Timeline Profile</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '15px', paddingBottom: '10px', borderBottom: '1px solid #333' }}>
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
        </div>

        {/* Live Logs Stream with Active Defense Controls */}
        <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '6px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#aaa' }}>Live Security Stream</h3>
          
          {/* THE SCROLL FIX: maxHeight and overflowY enable the internal scrollbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
            {logs.map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161616', padding: '12px', borderRadius: '4px', borderLeft: '3px solid #ff4444', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>{log.attacker_ip}</span>
                    <span style={{ color: '#888' }}>Target: Port <strong style={{ color: '#ffcc00' }}>{log.target_port}</strong></span>
                </div>
                
                <span style={{ color: '#aaa' }}>📍 {log.city} ({log.country_code})</span>
                
                {/* MANUAL OVERRIDE BUTTON */}
                <button 
                  onClick={async () => {
                    try {
                      alert(`Initiating network ban protocol for ${log.attacker_ip}...`);
                      await axios.post(`${API_BASE_URL}/firewall`, { ip: log.attacker_ip, action: 'ban' });
                      alert('Target successfully isolated at the firewall level.');
                    } catch (e: any) {
                      alert(e.response?.data?.error || 'Failed to execute ban.');
                    }
                  }}
                  style={{ 
                    backgroundColor: 'transparent', 
                    color: '#ff4444', 
                    border: '1px solid #ff4444', 
                    padding: '6px 12px', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: '0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ff444433'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  BLOCK IP
                </button>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}