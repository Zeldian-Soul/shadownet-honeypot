# 🛡️ ShadowNet Command Center
**An Advanced Distributed Threat Intelligence & Active Defense System**

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Platform](https://img.shields.io/badge/platform-Ubuntu%20Linux-orange)
![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20React%20Native%20%7C%20PostgreSQL-blue)

ShadowNet is a high-interaction tarpit honeypot and real-time threat intelligence platform designed to trap, analyze, and isolate targeted network intrusions. By emulating vulnerable SSH and Telnet services, it baits human attackers and automated botnets, recording their lateral movement attempts while safely containing them in a psychological tarpit.

---

## 🏗️ System Architecture

ShadowNet operates on a decoupled, asynchronous architecture separating the threat-capture engine from the intelligence-aggregation dashboard.

`[Attacker]` ➔ `[Node.js Tarpit]` ➔ `[ShaktiDB (PostgreSQL)]` ➔ `[Express API]` ➔ `[React Dashboard]`

1. **The Edge Tarpit (Backend):** Custom Node.js `net` sockets emulate Ubuntu 24.04 login sequences.
2. **The Intelligence Core (Database):** PostgreSQL logs interaction payloads, timestamps, and UUID session data.
3. **The Command Center (Frontend):** A React Native (Expo Web) interface provides real-time geospatial telemetry and forensic analysis.

---

## ✨ Enterprise Features

* **High-Interaction Emulation:** Bypasses standard botnet signatures by mimicking a live bash shell (`root@ubuntu:~#`), trapping attackers in a simulated environment.
* **Forensic Session Replay (VCR):** Generates native UUIDs per connection, stitching together multi-command attacks into a chronological, playable terminal UI.
* **Global Geospatial Heatmap:** Dynamically resolves public attacker IPs via `ipify` and maps threat origins globally using Leaflet and CartoDB dark-mode tiles.
* **Active Defense Firewall:** Features an asynchronous, non-blocking queue that dynamically orchestrates Linux `ufw` (Uncomplicated Firewall) to isolate hostile IPs upon threshold breaches.
* **Real-Time Telemetry Alerting:** Integrated `telegraf` engine pushes high-priority notifications to mobile devices via Telegram when targeted human interaction is detected.

---

## 🚀 Deployment Guide

### Prerequisites
* **OS:** Ubuntu Linux (Required for `ufw` active defense integration)
* **Environment:** Node.js v20+, npm, PostgreSQL (Port 5433)
* **API Keys:** A valid Telegram Bot Token from `@BotFather`

### 1. Database Initialization
Create a PostgreSQL database named `shadownet` and initialize the schema:
```sql
CREATE TABLE intrusion_logs (
    id SERIAL PRIMARY KEY,
    attacker_ip VARCHAR(45) NOT NULL,
    target_port INT NOT NULL,
    attempted_username TEXT,
    attack_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id UUID
);

CREATE TABLE active_bans (
    attacker_ip VARCHAR(45) PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    ban_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
