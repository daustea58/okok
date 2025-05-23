// index.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');

const SESSION_DIR = './auth_info_multi';
if (fs.existsSync(SESSION_DIR)) fs.rmSync(SESSION_DIR, { recursive: true, force: true });

// Hardcode ke versi WA Web terbaru:
const WA_VERSION = process.env.WA_VERSION.split(',').map(n => parseInt(n));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  console.log(`🔄 Connecting WA v${WA_VERSION.join('.')}`);

  const sock = makeWASocket({
    version: WA_VERSION,
    auth: state,
    printQRInTerminal: false,
    browser: ['Ryzen','Android','10'],
    waWebSocketUrl: 'wss://g.whatsapp.net/ws'
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', upd => {
    const { connection, lastDisconnect, qr } = upd;
    if (qr) {
      console.log('\n🔗 Scan this QR:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('✅ Bot connected!');
    else if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Disconnected code', code);
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
      else console.log('🚪 Logged out; delete session to re-scan.');
    }
  });

  sock.ev.on('messages.upsert', async mUp => {
    const msg = mUp.messages[0];
    if (!msg.message || msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) return;
    const sender = msg.key.remoteJid.replace('@s.whatsapp.net','');
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    let reply = '...';
    try {
      const res = await axios.post(
        'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
        { inputs: text },
        { headers: { Authorization: `Bearer ${process.env.HF_API_TOKEN}` } }
      );
      reply = res.data.generated_text || reply;
    } catch {
      reply = 'Ryzen lagi mikir…';
    }

    if (sender === process.env.SPECIAL_NUMBER) reply = `Iya, sayang. ${reply}`;
    await sock.sendMessage(msg.key.remoteJid, { text: reply });
  });
}

startBot();
