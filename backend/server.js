require('dotenv').config();
// ==========================================
// SHADOWNET: ENTERPRISE HONEYPOT & COMMAND CENTER
// ==========================================
const net = require('net');
const { Pool } = require('pg');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const geoip = require('geoip-lite');
const crypto = require('crypto');

// ==========================================
// 1. DATABASE CONFIGURATION
// ==========================================
const pool = new Pool({
    user: process.env.DB_USER || 'shadow_logger',
    password: process.env.DB_PASSWORD,
    host: '127.0.0.1',
    database: 'shadownet',
    port: 5433,
});

// ==========================================
// 1.5 TELEGRAM ALERT SYSTEM (Telegraf Engine)
// ==========================================
const { Telegraf } = require('telegraf');

// 🛑 PASTE YOUR BOTFATHER TOKEN HERE:
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
    console.error("❌ ERROR: TELEGRAM_TOKEN is missing from your .env file!");
    process.exit(1); // Stop the server if the token isn't configured
}

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!ADMIN_CHAT_ID) {
    console.error("❌ ERROR: ADMIN_CHAT_ID is missing from your .env file!");
    process.exit(1); // Stop the server if the ID isn't configured
} 

// Initialize the modern bot engine
const bot = new Telegraf(TELEGRAM_TOKEN);

// Listen for the /start command from your phone
// bot.start((ctx) => {
//     ADMIN_CHAT_ID = ctx.chat.id;
//     console.log(`\n🔔 TELEGRAM LINKED! Your Chat ID is: ${ADMIN_CHAT_ID}`);
//     ctx.reply(`🛡️ ShadowNet Command Center Uplink Established.\nAwaiting network intrusions...`);
// });

// Launch the bot background process
bot.launch();

// Helper function to send alerts safely
function sendAlert(message) {
    if (ADMIN_CHAT_ID) {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'Markdown' })
           .catch(err => console.error('Telegram alert failed:', err.message));
    }
}

// ==========================================
// 2. EXPRESS COMMAND CENTER API
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// Dynamic Geolocation Engine
async function locateIp(ip) {
    let targetIp = ip;

    // If local test, dynamically fetch your REAL public IP from the internet
    if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            targetIp = data.ip; 
        } catch (err) {
            console.error("Could not fetch public IP. Falling back to unknown.");
        }
    }
    
    // Look up the real public IP in the local database
    const geo = geoip.lookup(targetIp);
    if (geo) {
        return {
            country: geo.country,
            city: geo.city || 'Unknown City',
            ll: geo.ll
        };
    }
    return { country: 'XX', city: 'Unknown Origin', ll: [0, 0] };
}

// API Route: Fetch live threat logs with geolocation
app.get('/api/threats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM intrusion_logs ORDER BY attack_timestamp DESC LIMIT 100');
        
        // Use Promise.all to handle the async geolocation lookups
        const enrichedLogs = await Promise.all(result.rows.map(async (log) => {
            const geoInfo = await locateIp(log.attacker_ip);
            return {
                ...log,
                country_code: geoInfo.country,
                city: geoInfo.city,
                coordinates: geoInfo.ll
            };
        }));
        
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
        
        // Handle async lookups for analytics
        await Promise.all(ipResult.rows.map(async (row) => {
            const geo = await locateIp(row.attacker_ip);
            countryCounts[geo.country] = (countryCounts[geo.country] || 0) + 1;
        }));

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
        const sessionId = crypto.randomUUID(); // 🧬 GENERATE UNIQUE SESSION ID FOR THIS ATTACK
        
        // Memory Protection: Kill dead connections after 15 seconds
        socket.setTimeout(15000);
        socket.on('timeout', () => socket.destroy());

        console.log(`🚨 Alert! Connection attempt on port ${port} from IP: ${attackerIp} (Session: ${sessionId})`);

        // The Tarpit: Emulate a real server login sequence
        if (port === 2222) socket.write('SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n');
        else if (port === 2323) socket.write('Ubuntu 24.04 LTS\r\nlogin: ');

        let interactionCount = 0;

        socket.on('data', async (data) => {
            let payload = data.toString().trim();
            if (payload.length > 500) {
                payload = payload.substring(0, 500) + '... [PAYLOAD TRUNCATED]';
            }
            if (!payload) return;
            
            interactionCount++;

            // 🧬 INJECT SESSION ID INTO SHAKTIDB
            try {
                await pool.query(
                    `INSERT INTO intrusion_logs (attacker_ip, target_port, attempted_username, session_id) VALUES ($1, $2, $3, $4)`,
                    [attackerIp, port, payload, sessionId]
                );
            } catch (dbErr) {
                console.error('Database write error:', dbErr.message);
            }

            // Interactive Fake Shell Logic
            if (interactionCount === 1) {
                sendAlert(`🚨 *SHADOWNET ALERT*\n\nImmediate payload dropped!\n📍 IP: \`${attackerIp}\`\n😈 Payload: \`${payload}\``);
                socket.write('Password: ');
            } else if (interactionCount === 2) {
                socket.write('\r\nWelcome to Ubuntu 24.04 LTS (GNU/Linux 5.15.0-101-generic x86_64)\r\nLast login: Mon from 192.168.1.44\r\nroot@ubuntu:~# ');
            } else {
                console.log(`😈 Targeted Hacker Typing: "${payload}"`);

                // 🚨 FIRE THE TELEGRAM ALERT!
                if (interactionCount === 3) {
                    sendAlert(`🚨 *SHADOWNET ALERT*\n\nTargeted human interaction detected!\n📍 IP: \`${attackerIp}\`\n💻 Port: \`${port}\`\n😈 First Command: \`${payload}\``);
                }
                
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