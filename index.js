const http = require('http');
const axios = require('axios');

// ناسنامەکانی تایبەت بە خۆت
const ID_INSTANCE = '710701675528';
const API_TOKEN_INSTANCE = 'c5e69a0d11d9498ea2cfba3f6d8b0eb5f91c5947919f405aa2';
const TELEGRAM_BOT_TOKEN = '8950271184:AAEIIVI6O_uCDItY3cZOYFXoXnby7-9JFio';

const CHAT_IDS = {
    delivery: '-1004498318409',
    support: '-1004384835355',  
    archive: '-1004467931305'
};

const userSessions = {};

// دروستکردنی سێرڤەرەکە
const server = http.createServer((req, res) => {
    // بۆ ئەوەی ڕێندەر هەمیشە سێرڤەرەکە بە لایڤ ببێنێت لە ڕێگەی لۆگەکەوە
    console.log(`Received request: ${req.method} ${req.url}`);

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (data.typeWebhook === 'incomingMessageReceived') {
                    await handleBotLogic(data);
                }
            } catch (err) {
                console.error('Webhook structural error:', err.message);
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        });
    } else {
        // وەڵامدانەوە بۆ پشکنینی ڕێندەر (Health Check)
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Server is perfectly alive and listening!');
    }
});

async function sendWhatsAppMessage(chatId, text) {
    try {
        await axios.post(`https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`, {
            chatId: chatId,
            message: text
        });
    } catch (err) {
        console.error('WhatsApp dispatch error:', err.message);
    }
}

async function sendToTelegram(chatId, text) {
    if (!chatId) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (err) {
        console.error('Telegram dispatch error:', err.message);
    }
}

async function handleBotLogic(webhookData) {
    const senderData = webhookData.senderData;
    const messageData = webhookData.messageData;

    if (!messageData || messageData.typeMessage !== 'textMessage') return;

    const chatId = senderData.chatId;
    const clientName = senderData.senderName || 'کڕیار';
    const clientPhone = chatId.split('@')[0];
    const messageText = messageData.textMessageData.textMessage.trim();

    await sendToTelegram(CHAT_IDS.archive, `📁 *[ئەرشیف - نامەی نوێ]*\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* +${clientPhone}\n💬 *نامە:* ${messageText}`);

    if (!userSessions[chatId] || messageText === '0' || messageText === '٠') {
        userSessions[chatId] = { step: 'menu' };
        const menuText = `سڵاو *${clientName}*، بەخێربێیت بۆ پشتیوانی ئۆتۆماتیکی کۆگای کەرەم 🌸\n\nتکایە ژمارەی بەشی پێویست بنوسە:\n\n١ - بۆ داواکاری نوێ و کڕینی کاڵا (بەرید) 🚚\n٢ - بۆ کێشە و پشتیوانی کڕیاران ⚠️\n\n👉 بۆ گەڕانەوە بۆ ئەم مینیوە لە هەر کاتێکدا, بنووسە: 0`;
        await sendWhatsAppMessage(chatId, menuText);
        return;
    }

    const currentStep = userSessions[chatId].step;

    if (currentStep === 'menu') {
        if (messageText === '1' || messageText === '١') {
            userSessions[chatId].step = 'awaiting_delivery_details';
            await sendWhatsAppMessage(chatId, "📦 تکایە زانیارییەکانت بەم شێوازە لە یەک نامەدا بنووسە:\n• ناوی سیانی:\n• ژمارەی مۆبایل:\n• شار و ناونیشانی ورد:\n• ناوی ئەو کاڵایانەی کڕیوتەتەوە:\n\n👉 بۆ گەڕانەوە بنووسە: 0");
        } else if (messageText === '2' || messageText === '٢') {
            userSessions[chatId].step = 'awaiting_support_details';
            await sendWhatsAppMessage(chatId, "🛠️ تکایە کێشەکەت یان داواکارییەکەت بنوسە، کارمەندەکانمان ڕاستەوخۆ دەیبینن و وەڵامت دەدەنەوە.\n\n👉 بۆ گەڕانەوە بنووسە: 0");
        } else {
            await sendWhatsAppMessage(chatId, "تکایە تەنها ژمارە [1] یان [2] بنوسە بۆ هەڵبژاردنی بەشەکان، یان 0 بۆ مینیوی سەرەکی.");
        }
        return;
    }

    if (currentStep === 'awaiting_delivery_details') {
        const deliveryText = `🚚 *[داواکاری نوێ لە وەتسئاپەوە]*\n\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* +${clientPhone}\n📝 *زانیاری کڕین:* \n${messageText}`;
        await sendToTelegram(CHAT_IDS.delivery, deliveryText);

        await sendWhatsAppMessage(chatId, "✅ سوپاس برا گیان! زانیارییەکانت نێردرایە بەشی بەڕێکردن و گەیاندن. مۆبایلەکەت کراوە بێت. ✨");
        userSessions[chatId].step = 'menu'; 
        return;
    }

    if (currentStep === 'awaiting_support_details') {
        const supportText = `⚠️ *[کێشەی کڕیار - پشتیوانی]*\n\n👤 *کڕیار:* ${clientName}\n📞 *ژمارە:* +${clientPhone}\n💬 *کێشەکە:* ${messageText}`;
        await sendToTelegram(CHAT_IDS.support, supportText);

        await sendWhatsAppMessage(chatId, "📥 نامەکەت گەیشتە بەشی پشتیوانی. کارمەندەکانمان بە زووترین کات بە دەست وەڵامت دەدەنەوە.");
        userSessions[chatId].step = 'menu';
        return;
    }
}

// 🟢 زۆر گرنگ: ڕێندەر بەم پۆرتە ڕاستەوخۆ دەبێتە سەوز و لایڤ
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`==> Server is fully bound and running on port ${PORT}`);
});
