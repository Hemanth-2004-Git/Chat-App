# Self-Hosted Coturn TURN Server Setup

## Why Self-Hosted Coturn?

- **Free and Open Source**: No usage limits
- **Full Control**: Your own infrastructure
- **Better Reliability**: No dependency on third-party services
- **Privacy**: All traffic goes through your server

## Quick Setup (Ubuntu/Debian)

### 1. Install Coturn

```bash
sudo apt-get update
sudo apt-get install coturn
```

### 2. Configure Coturn

Edit `/etc/turnserver.conf`:

```conf
# Listening ports
listening-port=3478
tls-listening-port=5349

# External IP (replace with your server's public IP)
external-ip=YOUR_SERVER_IP

# Realm
realm=yourdomain.com

# User credentials (username:password)
user=username:password

# No authentication for local network (optional)
no-auth

# Enable logging
log-file=/var/log/turn.log
verbose
```

### 3. Start Coturn

```bash
sudo systemctl enable coturn
sudo systemctl start coturn
```

### 4. Update Your WebRTC Config

```javascript
const TURN_SERVERS = [
  {
    urls: 'turn:your-server-ip:3478',
    username: 'username',
    credential: 'password'
  },
  {
    urls: 'turns:your-server-ip:5349',
    username: 'username',
    credential: 'password'
  }
];
```

## Docker Setup (Easier)

```bash
docker run -d \
  --name coturn \
  -p 3478:3478/udp \
  -p 3478:3478/tcp \
  -p 5349:5349/udp \
  -p 5349:5349/tcp \
  -e EXTERNAL_IP=YOUR_SERVER_IP \
  -e USERNAME=username \
  -e PASSWORD=password \
  coturn/coturn
```

## Firewall Rules

```bash
# UDP
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp

# TCP
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
```

## Testing

Use this tool to test your TURN server:
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

## Resources

- Official Coturn: https://github.com/coturn/coturn
- Documentation: https://github.com/coturn/coturn/wiki

