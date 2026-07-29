import assert from 'node:assert/strict';

const endpoint = process.env.NOVNC_WS_URL ?? 'ws://127.0.0.1:6080/websockify';

const banner = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timed out waiting for the VNC protocol banner')), 5000);
  const socket = new WebSocket(endpoint);
  socket.binaryType = 'arraybuffer';

  socket.addEventListener('message', (event) => {
    clearTimeout(timeout);
    const text = new TextDecoder().decode(new Uint8Array(event.data));
    socket.close();
    resolve(text);
  }, { once: true });
  socket.addEventListener('error', () => {
    clearTimeout(timeout);
    reject(new Error(`WebSocket connection failed: ${endpoint}`));
  }, { once: true });
});

assert.match(banner, /^RFB \d{3}\.\d{3}\n$/, `Unexpected VNC banner: ${JSON.stringify(banner)}`);
console.log(`noVNC WebSocket reached x11vnc: ${banner.trim()}`);
