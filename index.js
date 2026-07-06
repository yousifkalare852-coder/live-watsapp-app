const axios = require('axios');
const http = require('http');

// کلیلەکانی GREEN-API و تێلیگرام
const ID_INSTANCE = '710701675528';
const API_TOKEN_INSTANCE = 'c5e69a0d11d9498ea2cfba3f6d8b0eb5f91c5947919f405aa2';
const TELEGRAM_BOT_TOKEN = '8950271184:AAEIIVI6O_uCDItY3cZOYFXoXnby7-9JFio';

// ئایدی فەرمی کەناڵەکانی تۆ لە تێلیگرام
const CHAT_IDS = {
    delivery: '-1004498318409',  // بەشی بەرید (محمد ڕۆژ)
    support: '-1004384835355',   // بەشی کێشەی کڕیاران (کەنەدی)
    archive: '-1004467931305'    // بەشی فرۆش و حیسابات (کاک فەرهاد)
};

// بیرگەی کاتی بۆ پاراستنی دۆخی کڕیار و کاتەکەی
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
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error sending to Telegram:', error.message);
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

    // ئەگەر کڕیارەکە هیچ سێشنێکی نەبێت، مینیوی سەرەکی پێ نیشان دەدەین
    if (!userSessions[chatId]) {
        userSessions[chatId] = { 
            step: 'menu', 
            lastInteraction: Date.now(),
            reminded: false 
        };
        const menuText = `سڵاو *${clientName}*، بەخێربێیت بۆ پشتیوانی دوکانەکەمان. 🌸\n\nتکایە ژمارەی بەشی پێویست بنوسە:\n١ - بۆ داواکاری نوێ و کڕینی کاڵا 🚚\n٢ - بۆ کێشە و پشتیوانی کڕیاران ⚠️`;
        await sendWhatsAppMessage(chatId, menuText);
        return;
    }

    // نوێکردنەوەی کاتی کۆتا نامەی کڕیار
    userSessions[chatId].lastInteraction = Date.now();
    userSessions[chatId].reminded = false; 
    const currentStep = userSessions[chatId].step;

    // قۆناغی هەڵبژاردنی مینیو
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

    // وەرگرتنی زانیاری بەڕێکردن و ناردنی بۆ کەناڵی بەڕێکردن (محمد ڕۆژ)
    if (currentStep === 'awaiting_delivery_details') {
        const deliveryText = `🚚 *[داواکاری نوێ]*\n\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n📝 *زانیاری:* \n${messageText}`;
        await sendToTelegram(CHAT_IDS.delivery, deliveryText);
        await sendToTelegram(CHAT_IDS.archive, `📁 *[ئەرشیف - کڕین]*\n👤 ${clientName} (${clientPhone}) داواکاری تۆمارکرد.`);
        
        await sendWhatsAppMessage(chatId, "سوپاس بۆ داواکارییەکەت! زانیارییەکانت نێردرایە بەشی بەڕێکردن. ✨");
        delete userSessions[chatId]; 
        return;
    }

    // وەرگرتنی کێشەکە و ناردنی بۆ کەناڵی کێشەی کڕیاران (کەنەدی)
    if (currentStep === 'awaiting_support_details') {
        const supportText = `⚠️ *[کێشەی کڕیار]*\n\n👤 *کڕیار:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n💬 *دەق:* ${messageText}`;
        await sendToTelegram(CHAT_IDS.support, supportText);
        await sendToTelegram(CHAT_IDS.archive, `📁 *[ئەرشیف - پشتیوانی]*\n👤 ${clientName} (${clientPhone}) سکاڵای نارد.`);

        await sendWhatsAppMessage(chatId, "نامەکەت گەیشتە بەشی پشتیوانی. کارمەندەکانمان ئێستا پێداچوونەوەی بۆ دەکەن.");
        delete userSessions[chatId];
        return;
    }
}

// سیستمی پشکنینی ئۆتۆماتیکی ٢٤ کاتژمێر جارێک (Checking every 1 hour)
setInterval(async () => {
    const NOW = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // ٢٤ کاتژمێر بە میلی چرکە

    for (const chatId in userSessions) {
        const session = userSessions[chatId];
        // ئەگەر کڕیارەکە لە ناو پڕۆسەکەدا بوو و ٢٤ کاتژمێر تێپەڕیبوو و هێشتا ئاگادار نەکراوەتەوە
        if (session.step !== 'menu' && (NOW - session.lastInteraction >= TWENTY_FOUR_HOURS) && !session.reminded) {
            session.reminded = true;
            const reminderText = "سڵاو هاوڕێم، هیوادارم کاتت باش بێت. مینیوی داواکارییەکەت نیوەچڵ مابووەوە، ئایا هێشتا دەتەوێت بەڕێکردنی کاڵاکەت (بەرید) بۆ تەواو بکەین؟ ئەگەر دەتەوێت تەنها نامەیەک بنووسەرەوە.";
            await sendWhatsAppMessage(chatId, reminderText);
        }
    }
}, 60 * 60 * 1000); // هەموو کاتژمێرێک پشکنین دەکات

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
