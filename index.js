const axios = require('axios');
const http = require('http');

const ID_INSTANCE = '710701675528';
const API_TOKEN_INSTANCE = 'c5e69a0d11d9498ea2cfba3f6d8b0eb5f91c5947919f405aa2';
const TELEGRAM_BOT_TOKEN = '8950271184:AAEIIVI6O_uCDItY3cZOYFXoXnby7-9JFio';

// لێرە ئایدی گرووپەکانت دابنێ دواتر
const CHAT_IDS = {
    delivery: 'YOUR_DELIVERY_CHAT_ID', 
    support: 'YOUR_SUPPORT_CHAT_ID',   
    archive: 'YOUR_ARCHIVE_CHAT_ID'    
};

// یادگەی کاتی بۆ ناسینەوەی قۆناغی کڕیار (تۆماری دۆخی کڕیار)
const userSessions = {};

const server = http.createServer((req, res) => {
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
                console.error('Webhook error:', err);
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Server is Running');
    }
});

async function sendWhatsAppMessage(chatId, text) {
    try {
        await axios.post(`https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`, {
            chatId: chatId,
            message: text
        });
    } catch (err) {
        console.error('Error sending WA:', err.message);
    }
}

async function sendToTelegram(chatId, text) {
    if (!chatId || chatId.includes('YOUR_')) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (err) {
        console.error('Error sending TG:', err.message);
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

    // ئەگەر کڕیارەکە نوێ بێت یان لە دەرەوەی مینیو بێت
    if (!userSessions[chatId]) {
        userSessions[chatId] = { step: 'menu' };
        const menuText = `سڵاو *${clientName}*، بەخێربێیت پۆ پشتیوانی دوکانەکەمان. 🌸\n\nتکایە ژمارەی بەشی پێویست بنوسە:\n١ - بۆ داواکاری نوێ و کڕینی کاڵا 🚚\n٢ - بۆ کێشە و پشتیوانی کڕیاران ⚠️`;
        await sendWhatsAppMessage(chatId, menuText);
        return;
    }

    const currentStep = userSessions[chatId].step;

    // کاتێک کڕیار لە لاپەڕەی سەرەکی مینیودایە و ژمارە هەڵدەبژێرێت
    if (currentStep === 'menu') {
        if (messageText === '1' || messageText === '١') {
            userSessions[chatId].step = 'awaiting_delivery_details';
            await sendWhatsAppMessage(chatId, "تکایە (ناوی تەواو، ناونیشانی ورد، و جۆری کاڵاکە) بە یەک نامە بنوسە تا تۆماری بکەین.");
        } else if (messageText === '2' || messageText === '٢') {
            userSessions[chatId].step = 'awaiting_support_details';
            await sendWhatsAppMessage(chatId, "تکایە کێشەکەت یان داواکارییەکەت بنوسە، کارمەندەکانمان ڕاستەوخۆ دەیبینن.");
        } else {
            await sendWhatsAppMessage(chatId, "تکایە تەنها ژمارە [1] یان [2] بنوسە بۆ هەڵبژاردنی بەشەکان.");
        }
        return;
    }

    // وەرگرتنی زانیاری داواکاری کڕین و ناردنی بۆ تێلیگرامی بەڕێکردن
    if (currentStep === 'awaiting_delivery_details') {
        const deliveryText = `🚚 *[داواکاری نوێ لە وەتسئاپەوە]*\n\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n📝 *زانیاری کڕین:* \n${messageText}`;
        await sendToTelegram(CHAT_IDS.delivery, deliveryText);
        
        // ناردنی بۆ بەشی ئەرشیفی گشتی
        await sendToTelegram(CHAT_IDS.archive, `📁 *[ئەرشیف - کڕین]*\n👤 ${clientName} - ${clientPhone}\n🛒 داواکاری تۆمارکرد.`);

        await sendWhatsAppMessage(chatId, "سوپاس بۆ داواکارییەکەت! زانیارییەکانت نێردرایە بەشی بەڕێکردن و بە زووترین کات پێوەندیت پێوە دەکەین. ✨");
        delete userSessions[chatId]; // سڕینەوەی کاتی بۆ ئەوەی گەر نامەی ناردەوە مینیو بێتەوە
        return;
    }

    // وەرگرتنی کێشەکە و ناردنی بۆ گرووپی پشتیوانی کڕیاران
    if (currentStep === 'awaiting_support_details') {
        const supportText = `⚠️ *[کێشەی کڕیار - پشتیوانی]*\n\n👤 *کڕیار:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n💬 *کێشەکە:* ${messageText}`;
        await sendToTelegram(CHAT_IDS.support, supportText);

        await sendWhatsAppMessage(chatId, "نامەکەت گەیشتە بەشی پشتیوانی. کارمەندەکانمان ئێستا پێداچوونەوەی بۆ دەکەن.");
        delete userSessions[chatId];
        return;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
