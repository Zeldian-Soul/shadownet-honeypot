const net = require('net');
const { Pool } = require('pg');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const geoip = require('geoip-lite'); // NEW: Offline Geolocation Engine

// Pool configuration (Keep your existing database configuration here)
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'shadownet',
    password: process.env.DB_PASSWORD || 'Life@123',
    port: 5433,
});

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to geolocate an IP with a fallback for local testing
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
        // Pick a deterministic mock target based on string characteristics or random rotation
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

// Endpoint 1: Fetch threats bundled with geographical intelligence coordinates
app.get('/api/threats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM intrusion_logs ORDER BY attack_timestamp DESC LIMIT 100');
        
        // Map over the database logs and inject live geolocation layers dynamically
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

// Endpoint 3: Enhanced Analytics Endpoint with Country Breakdown
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

        // Fetch raw IPs to calculate country distribution metrics
        const ipResult = await pool.query('SELECT attacker_ip FROM intrusion_logs');
        const countryCounts = {};
        
        ipResult.rows.forEach(row => {
            const geo = locateIp(row.attacker_ip);
            countryCounts[geo.country] = (countryCounts[geo.country] || 0) + 1;
        });

        const geoDistribution = Object.keys(countryCounts).map(country => ({
            country,
            count: countryCounts[country]
        }));

        res.json({
            distribution: portResult.rows,
            timeline: timelineResult.rows,
            geoDistribution: geoDistribution
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint 4: Manual Active Defense Override (Ban/Unban)
app.post('/api/firewall', async (req, res) => {
    const { ip, action } = req.body;

    // Hard safeguard to prevent locking yourself out during local testing
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

// Start the Command Center API
const API_PORT = 3000;
app.listen(API_PORT, () => {
    console.log(`🌐 Command Center API live and serving data on http://localhost:${API_PORT}`);
});

// ==========================================
// ACTIVE DEFENSE DECOY ENGINE
// ==========================================
const DECOY_PORTS = [2222, 2323];

async function executeFirewallBan(ip) {
    if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
        console.log(`⚠️ [SAFEGUARD] Bypassing firewall ban for Localhost.`);
        return;
    }

    exec(`ufw insert 1 deny from ${ip} to any`, async (error) => {
        if (error) return console.error(`❌ Firewall execution failed: ${error.message}`);
        console.log(`🧱 FIREWALL TRIGGERED: Dropped all traffic from ${ip}`);

        try {
            await pool.query(
                `INSERT INTO active_bans (attacker_ip, status) VALUES ($1, 'ACTIVE') ON CONFLICT (attacker_ip) DO NOTHING;`,
                [ip]
            );
            console.log(`💾 Active ban registered in ShaktiDB.`);
        } catch (dbErr) {
            console.error('❌ Failed to log ban to database:', dbErr.message);
        }
    });
}

function createDecoyListener(port) {
    const server = net.createServer((socket) => {
        const attackerIp = socket.remoteAddress;
        console.log(`\n🚨 Alert! Connection attempt on port ${port} from IP: ${attackerIp}`);

        if (port === 2222) socket.write('SSH-2.0-OpenSSH_7.4p1 Debian-10+deb9u7\r\n');
        else if (port === 2323) socket.write('Ubuntu 24.04 LTS\r\nlogin: ');

        socket.on('data', async (data) => {
            const payload = data.toString().trim();
            console.log(`📥 Captured payload: "${payload}"`);

            try {
                await pool.query(
                    `INSERT INTO intrusion_logs (attacker_ip, target_port, attempted_username) VALUES ($1, $2, $3)`,
                    [attackerIp, port, payload]
                );
            } catch (dbErr) {
                console.error('❌ Failed to log threat:', dbErr.message);
            }

            socket.end('Access Denied\r\n');
            executeFirewallBan(attackerIp);
        });

        socket.on('error', (err) => console.log(`⚠️ Socket error: ${err.message}`));
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`🛡️ ShadowNet decoy active on localhost port ${port}...`);
    });
}

DECOY_PORTS.forEach(port => createDecoyListener(port));