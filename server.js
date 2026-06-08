const net = require('net');
const { Pool } = require('pg');
const { exec } = require('child_process'); // NEW: Allows Node to run Linux terminal commands

// 1. Configure the connection pool for ShaktiDB
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'shadownet',
    password: process.env.DB_PASSWORD || 'Life@123',
    port: 5433,
});

pool.connect((err, client, release) => {
    if (err) return console.error('❌ Error acquiring client from ShaktiDB pool:', err.stack);
    console.log('✅ Successfully connected to ShaktiDB instance.');
    release();
});

const DECOY_PORTS = [2222, 2323];

// NEW: The Active Defense Function
async function executeFirewallBan(ip) {
    // CRITICAL SAFEGUARD: Never ban localhost so you don't lock yourself out during testing!
    if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
        console.log(`⚠️ [SAFEGUARD] Attack detected from Localhost. Bypassing firewall ban to prevent self-lockout.`);
        return;
    }

    // Command to block the IP using Uncomplicated Firewall (UFW)
    const banCommand = `ufw insert 1 deny from ${ip} to any`;

    exec(banCommand, async (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Firewall execution failed. (Are you running as root?): ${error.message}`);
            return;
        }
        console.log(`🧱 FIREWALL TRIGGERED: Successfully dropped all future traffic from ${ip}`);

        // Register the ban in ShaktiDB for the dashboard
        try {
            const queryText = `
                INSERT INTO active_bans (attacker_ip, status) 
                VALUES ($1, 'ACTIVE') 
                ON CONFLICT (attacker_ip) DO NOTHING;
            `;
            await pool.query(queryText, [ip]);
            console.log(`💾 Active ban securely registered in ShaktiDB Vault.`);
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

            // 1. Log the threat to the ledger
            try {
                await pool.query(
                    `INSERT INTO intrusion_logs (attacker_ip, target_port, attempted_username) VALUES ($1, $2, $3)`,
                    [attackerIp, port, payload]
                );
            } catch (dbErr) {
                console.error('❌ Failed to log threat:', dbErr.message);
            }

            // 2. Terminate connection
            socket.end('Access Denied\r\n');

            // 3. Trigger the Active Defense Protocol
            executeFirewallBan(attackerIp);
        });

        socket.on('error', (err) => console.log(`⚠️ Socket error: ${err.message}`));
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`🛡️ ShadowNet decoy active on localhost port ${port}...`);
    });
}

DECOY_PORTS.forEach(port => createDecoyListener(port));