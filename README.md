# ShadowNet: Active Defense Honeypot & IPS

ShadowNet is a lightweight, active-defense cybersecurity honeypot and Intrusion Prevention System (IPS). It deploys decoy network listeners to detect unauthorized access attempts, instantly capturing attacker telemetry (IP, port, payload) and executing host-level firewall rules to neutralize threats in real-time.

## ⚙️ Core Architecture
* **The Lure:** Custom daemon listening on highly-targeted ports (e.g., 22, 23) to intercept automated botnets and brute-force attacks.
* **The Trap Door:** Automated execution of Linux `iptables`/`ufw` commands to permanently or temporarily ban malicious actors.
* **The Vault:** Threat intelligence and access logs are securely aggregated into a relational **ShaktiDB** (PostgreSQL) instance.
* **The Command Center:** A centralized REST API and dashboard for real-time visualization of attack vectors and manual firewall management.

## 🛠️ Tech Stack
* **Backend:** Node.js, Express
* **Database:** ShaktiDB v17.7.1.1 
* **Environment:** WSL2 Ubuntu 24.04
* **Security:** Linux core firewall utilities (`iptables`)
