const axios = require('axios');
const http = require('http');

const ID_INSTANCE = '710701675528';
const API_TOKEN_INSTANCE = 'c5e69a0d11d9498ea2cfba3f6d8b0eb5f91c5947919f405aa2';
const TELEGRAM_BOT_TOKEN = '8950271184:AAEIIVI6O_uCDItY3cZOYFXoXnby7-9JFio';

const CHAT_IDS = {
    delivery: '-1004498318409',  
    support: '-1004384835355',   
    archive: '-1004467931305'    
};

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
        console.error('Error sending to TG:', error.message);
    }
}

// فەنکشن بۆ هێنانی لیستی ناوی چاتەکان و ناردنی نامەی بەکۆمەڵ
async function broadcastMessage(textToSend) {
    try {
        const response = await axios.get(`https://api.green-api.com/waInstance${ID_INSTANCE}/getChats/${API_TOKEN_INSTANCE}`);
        const chats = response.data;
        if (Array.isArray(chats)) {
            for (const chat of chats) {
                // تەنها بۆ ژمارە شەخسییەکان بنێرێت نەک گرووپەکان
                if (chat.id.endsWith('@c.us')) {
                    await sendWhatsAppMessage(chat.id, textToSend);
                    // کەمێک وەستان بۆ ئەوەی وەتسئاپ بلۆکی نەکات
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    } catch (err) {
        console.error('Broadcast error:', err.message);
    }
}

async function handleBotLogic(webhookData) {
    const senderData = webhookData.senderData;
    const messageData = webhookData.messageData;

    if (!messageData) return;

    const chatId = senderData.chatId;
    const clientName = senderData.senderName || 'کڕیار';
    const clientPhone = chatId.split('@')[0];
    
    let messageText = '';
    const msgType = messageData.typeMessage;

    if (msgType === 'textMessage' && messageData.textMessageData) {
        messageText = messageData.textMessageData.textMessage.trim();
    } else {
        messageText = `[ناردنی مێدیا: ${msgType}]`;
    }

    // لێرەدا فەرمانەکانی خۆت کۆنترۆڵ دەکەین کاتێک نامەکە لەلایەن خودی ئەدۆمۆنەوە (مۆبایلی خۆتەوە) دەنوسرێت
    if (webhookData.instanceData && webhookData.instanceData.wid === chatId) {
        if (messageText === '@کەرەم_لایڤ') {
            const startLiveText = `سڵاو هاوڕێی بەڕێزم ✨🌸 لایڤی ئەمشەومان دەستی پێکرد! چەندین کاڵا و ئەشیای نایاب و ناوازەمان ئامادە کردووە بۆتان. کاتێکی خۆش و پڕ خێر لەگەڵمان بەسەر بەرن. چاوڕێتانین! 🎉`;
            await broadcastMessage(startLiveText);
            return;
        }
        if (messageText === '@کۆتایی_لایڤ') {
            const endLiveText = `سوپاس بۆ کڕینی ئەشیاکان لە لایڤی ئەمشەومان، متمانەتان جێگای شانازی ئێمەیە 🌸 تکایە کۆی گشتی نرخ یان بڕی ئەو ئەشیاکانەمان بۆ بنوسە کە ئەمشەو کڕیوتە تا کارمەندەکانمان فۆرمی ناردنەکەت بۆ ئامادە بکەن. 🚚`;
            // هەموو کڕیارەکان دەخەینە دۆخی چاوڕێی نرخەوە
            for (const key in userSessions) {
                userSessions[key].step = 'awaiting_price_total';
            }
            await broadcastMessage(endLiveText);
            return;
        }
    }

    // ئەگەر کڕیار پێشتر لە دۆخی وەرگرتنی نرخدا بووبێت دوای لایڤ
    if (userSessions[chatId] && userSessions[chatId].step === 'awaiting_price_total') {
        const priceText = `💰 *[حیساباتی لایڤ - نرخی ئەشیا]*\n\n👤 *کڕیار:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n💵 *کۆی گشتی نرخ:* ${messageText}`;
        await sendToTelegram(CHAT_IDS.archive, priceText); // دەنێردرێت بۆ بەشی فڕۆش و حیسابات
        await sendWhatsAppMessage(chatId, "زۆر سوپاس، حیساباتەکەت تۆمارکرا و درایە بەشی وردبینی. 🤍");
        delete userSessions[chatId];
        return;
    }

    // ئەگەر کڕیارەکە تازە نامەی ناردبێت (مینیوی ئاسایی)
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

    userSessions[chatId].lastInteraction = Date.now();
    userSessions[chatId].reminded = false; 
    const currentStep = userSessions[chatId].step;

    if (currentStep === 'menu') {
        if (messageText === '1' || messageText === '١') {
            userSessions[chatId].step = 'awaiting_delivery_details';
            await sendWhatsAppMessage(chatId, "تکایە (ناوی تەواو، ناونیشانی ورد، و جۆری کاڵاکە) بە نامەیەک بنوسە تا تۆماری بکەین.");
        } else if (messageText === '2' || messageText === '٢') {
            userSessions[chatId].step = 'awaiting_support_details';
            await sendWhatsAppMessage(chatId, "تکایە کێشەکەت یان داواکارییەکەت بنوسە، کارمەندەکانمان دەیبینن.");
        } else {
            await sendWhatsAppMessage(chatId, "تکایە تەنها ژمارە [1] یان [2] بنوسە بۆ هەڵبژاردنی بەشەکان.");
        }
        return;
    }

    let logText = messageText;
    if (msgType !== 'textMessage') {
        const fileUrl = messageData.fileMessageData ? messageData.fileMessageData.downloadUrl : '';
        logText = `📸 *[مێدیای ناردووە: ${msgType}]*\n🔗 لینک: ${fileUrl || 'لە مۆبایل سەیر بکە'}`;
    }

    if (currentStep === 'awaiting_delivery_details') {
        const deliveryText = `🚚 *[داواکاری نوێ]*\n\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n📝 *زانیاری:* \n${logText}`;
        await sendToTelegram(CHAT_IDS.delivery, deliveryText);
        await sendToTelegram(CHAT_IDS.archive, `📁 *[ئەرشیف]*\n👤 ${clientName} (${clientPhone}) زانیاری نارد.`);
        
        await sendWhatsAppMessage(chatId, "سوپاس بۆ داواکارییەکەت! زانیارییەکانت نێردرایە بەشی بەڕێکردن. ✨");
        delete userSessions[chatId]; 
        return;
    }

    if (currentStep === 'awaiting_support_details') {
        const supportText = `⚠️ *[کێشەی کڕیار]*\n\n👤 *کڕیار:* ${clientName}\n📞 *ژمارە:* ${clientPhone}\n💬 *ناوەرۆک:* \n${logText}`;
        await sendToTelegram(CHAT_IDS.support, supportText);
        
        await sendWhatsAppMessage(chatId, "نامەکەت گەیشتە بەشی پشتیوانی. کارمەندەکانمان ئێستا پێداچوونەوەی بۆ دەکەن.");
        delete userSessions[chatId];
        return;
    }
}

// سیستمی پشکنینی ٢٤ کاتژمێری
setInterval(async () => {
    const NOW = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    for (const chatId in userSessions) {
        const session = userSessions[chatId];
        if (session.step !== 'menu' && session.step !== 'awaiting_price_total' && (NOW - session.lastInteraction >= TWENTY_FOUR_HOURS) && !session.reminded) {
            session.reminded = true;
            const reminderText = "سڵاو هاوڕێم، مینیوی داواکارییەکەت نیوەچڵ مابووەوە، ئایا هێشتا دەتەوێت بەڕێکردنی کاڵاکەت (بەرید) بۆ تەواو بکەین؟ ئەگەر دەتەوێت تەنها نامەیەک بنووسەرەوە.";
            await sendWhatsAppMessage(chatId, reminderText);
        }
    }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${
        
