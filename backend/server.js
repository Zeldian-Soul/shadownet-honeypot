// ==========================================
// SHADOWNET: ENTERPRISE HONEYPOT & COMMAND CENTER
// ==========================================
const net = require('net');
const { Pool } = require('pg');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const geoip = require('geoip-lite'); 

// ==========================================
// 1. DATABASE CONFIGURATION
// ==========================================
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'shadownet',
    password: process.env.DB_PASSWORD || 'YOUR_DATABASE_PASSWORD_HERE', // Update if necessary
    port: 5433,
});

// ==========================================
// 2. EXPRESS COMMAND CENTER API
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// Geolocation Engine with Localhost Tarpit Mapping
function locateIp(ip) {
    // If it's a local testing loop, generate highly realistic global threat metrics
    if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
        const mockLocations = [
            { country: 'US', city: 'Ashburn', ll: [39.0437, -77.4875] },
            { country: 'CN', city: 'Beijing', ll: [39.9042, 116.4074] },
            { country: 'NL', city: 'Amsterdam', ll: [52.3676, 4.9041] },
            { country: 'DE', city: 'Frankfurt', ll: [50.1109, 8.6821] },
            { country: 'RU', city: 'Moscow', ll: [55.7558, 37.6173] }
        ];
        return mockLocations[Math.floor(Math.random() * mockLocations.length)];
    }
    
    const geo = geoip.lookup(ip);
    if (geo) {
        return {
            country: geo.country,
            city: geo.city || 'Unknown Location',
            ll: geo.ll
        };
    }
    return { country: 'XX', city: 'Unknown Origin', ll: [0, 0] };
}

// API Route: Fetch live threat logs with geolocation
app.get('/api/threats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM intrusion_logs ORDER BY attack_timestamp DESC LIMIT 100');
        const enrichedLogs = result.rows.map(log => {
            const geoInfo = locateIp(log.attacker_ip);
            return {
                ...log,
                country_code: geoInfo.country,
                city: geoInfo.city,
                coordinates: geoInfo.ll
            };
        });
        res.json(enrichedLogs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Route: Aggregated Threat Analytics
app.get('/api/analytics', async (req, res) => {
    try {
        const portDistributionQuery = `SELECT target_port, COUNT(*) as total_attacks FROM intrusion_logs GROUP BY target_port;`;
        const portResult = await pool.query(portDistributionQuery);

        const timelineQuery = `
            SELECT TO_CHAR(attack_timestamp, 'HH24:00') as attack_hour, COUNT(*) as attack_count
            FROM intrusion_logs
            WHERE attack_timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY attack_hour ORDER BY attack_hour ASC;
        `;
        const timelineResult = await pool.query(timelineQuery);

        const ipResult = await pool.query('SELECT attacker_ip FROM intrusion_logs');
        const countryCounts = {};
        
        ipResult.rows.forEach(row => {
            const geo = locateIp(row.attacker_ip);
            countryCounts[geo.country] = (countryCounts[geo.country] || 0) + 1;
        });

        const geoDistribution = Object.keys(countryCounts).map(country => ({
            country,
            count: countryCounts[country]
        })).sort((a, b) => b.count - a.count).slice(0, 5); // Top 5 countries

        res.json({
            distribution: portResult.rows,
            timeline: timelineResult.rows,
            geoDistribution: geoDistribution
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Route: Manual Active Defense Override (Ban/Unban)
app.post('/api/firewall', async (req, res) => {
    const { ip, action } = req.body;

    if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
        return res.status(400).json({ error: "Safeguard engaged: Cannot modify firewall rules for Localhost." });
    }

    if (action === 'ban') {
        exec(`sudo ufw insert 1 deny from ${ip} to any`, async (error) => {
            if (error) return res.status(500).json({ error: `Firewall execution failed: ${error.message}` });
            
            try {
                await pool.query(`INSERT INTO active_bans (attacker_ip, status) VALUES ($1, 'ACTIVE') ON CONFLICT (attacker_ip) DO NOTHING;`, [ip]);
                res.json({ success: true, message: `Successfully blacklisted ${ip}` });
            } catch (dbErr) {
                res.status(500).json({ error: dbErr.message });
            }
        });
    }
});

// ==========================================
// 3. ENTERPRISE TARPIT & ACTIVE DEFENSE ENGINE
// ==========================================
const DECOY_PORTS = [2222, 2323];
const banQueue = new Set(); 
let isBanning = false;

// Async Ban Queue to prevent Linux Firewall locking
async function processBanQueue() {
    if (isBanning || banQueue.size === 0) return;
    isBanning = true;
    
    const ip = banQueue.keys().next().value;
    banQueue.delete(ip);

    // Safeguard localhost
    if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
        isBanning = false;
        return processBanQueue();
    }

    exec(`sudo ufw insert 1 deny from ${ip} to any`, async (error) => {
        if (!error) {
            console.log(`\n🧱 FIREWALL QUEUE: Successfully isolated ${ip}`);
            try {
                await pool.query(
                    `INSERT INTO active_bans (attacker_ip, status) VALUES ($1, 'ACTIVE') ON CONFLICT (attacker_ip) DO NOTHING;`,
                    [ip]
                );
            } catch (e) { /* ignore duplicate db logs */ }
        } else {
            console.error(`🧱 FIREWALL ERROR: Could not ban ${ip} - ${error.message}`);
        }
        
        isBanning = false;
        processBanQueue();
    });
}

// High-Interaction Decoy Listener
function createDecoyListener(port) {
    const server = net.createServer((socket) => {
        const attackerIp = socket.remoteAddress;
        
        // Memory Protection: Kill dead connections after 15 seconds
        socket.setTimeout(15000);
        socket.on('timeout', () => socket.destroy());

        console.log(`🚨 Alert! Connection attempt on port ${port} from IP: ${attackerIp}`);

        // The Tarpit: Emulate a real server login sequence
        if (port === 2222) socket.write('SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n');
        else if (port === 2323) socket.write('Ubuntu 24.04 LTS\r\nlogin: ');

        let interactionCount = 0;

        socket.on('data', async (data) => {
            const payload = data.toString().trim();
            if (!payload) return;

            interactionCount++;

            // Log interactions directly to ShaktiDB
            try {
                await pool.query(
                    `INSERT INTO intrusion_logs (attacker_ip, target_port, attempted_username) VALUES ($1, $2, $3)`,
                    [attackerIp, port, payload]
                );
            } catch (dbErr) {
                console.error('Database write error:', dbErr.message);
            }

            // Interactive Fake Shell Logic
            if (interactionCount === 1) {
                socket.write('Password: ');
            } else if (interactionCount === 2) {
                socket.write('\r\nWelcome to Ubuntu 24.04 LTS (GNU/Linux 5.15.0-101-generic x86_64)\r\nLast login: Mon from 192.168.1.44\r\nroot@ubuntu:~# ');
            } else {
                console.log(`😈 Targeted Hacker Typing: "${payload}"`);
                
                if (payload === 'exit' || payload === 'logout') {
                    socket.end('logout\r\n');
                    banQueue.add(attackerIp);
                    processBanQueue();
                } else if (payload.includes('wget') || payload.includes('curl')) {
                    socket.write('Resolving host... failed: Name or service not known.\r\nroot@ubuntu:~# ');
                } else {
                    socket.write('bash: ' + payload.split(' ')[0] + ': command not found\r\nroot@ubuntu:~# ');
                }
            }

            // Sever connection and ban after 10 interactions to protect resources
            if (interactionCount > 10) {
                socket.end('\r\nConnection closed by remote host.\r\n');
                banQueue.add(attackerIp);
                processBanQueue();
            }
        });

        socket.on('error', () => { /* Silently catch disconnects to prevent crashes */ });
    });

    // Speed/Stability Upgrade: Limit concurrent connections
    server.maxConnections = 500;

    server.listen(port, '0.0.0.0', () => {
        console.log(`🛡️ ShadowNet High-Interaction Tarpit active on port ${port}...`);
    });
}

// ==========================================
// 4. IGNITION
// ==========================================
DECOY_PORTS.forEach(port => createDecoyListener(port));

const API_PORT = 3000;
app.listen(API_PORT, () => console.log(`🌐 Command Center API running on port ${API_PORT}`));