const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const http = require('http');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

// دروستکردنی سێرڤەرێکی سادە بۆ ئەوەی ڕێندەر پۆرتەکە بخوێنێتەوە و سێرڤەرەکە نەکوژێتەوە
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('وەتسئاپ بۆ تێلیگرام کار دەکات...');
}).listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false 
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // پیشاندانی QR کۆدەکە بە شێوازی چوارگۆشەیی نوێ لەناو لۆگی ڕێندەردا
        if (qr) {
            console.log('--------------------------------------------------');
            console.log('📥 تکایە ئەم QR کۆدە سکیان بکە لە ڕێگەی وەتسئاپەوە:');
            qrcode.generate(qr, { small: true });
            console.log('--------------------------------------------------');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ وەتسئاپ بە سەرکەوتوویی بەستراوەوە و چالاکە!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const from = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const name = msg.pushName || "کڕیاری نەناسراو";

            if (text && from.endsWith('@s.whatsapp.net')) {
                const cleanNumber = from.split('@')[0];
                const report = `📥 *پەیامی نوێ لە وەتسئاپەوە*\n\n👤 *ناو:* ${name}\n📱 *ژمارە:* ${cleanNumber}\n💬 *پەیام:* ${text}`;
                
                try {
                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: TELEGRAM_ADMIN_ID,
                        text: report,
                        parse_mode: 'Markdown'
                    });
                } catch (err) {
                    console.error("هەڵە لە ناردنی پەیام بۆ تێلیگرام:", err.message);
                }
            }
        }
    });
}

startWhatsApp();
