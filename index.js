const http = require('http');
const axios = require('axios');

// ==========================================
// CONFIGURATION & IDENTITIES
// ==========================================
const ID_INSTANCE = '710701675528';
const API_TOKEN_INSTANCE = 'c5e69a0d11d9498ea2cfba3f6d8b0eb5f91c5947919f405aa2';
const TELEGRAM_BOT_TOKEN = '8950271184:AAEIIVI6O_uCDItY3cZOYFXoXnby7-9JFio';

const CHAT_IDS = {
    delivery: '-1004498318409',
    support: '-1004384835355',  
    archive: '-1004467931305'
};

const userSessions = {};

// ==========================================
// CORE WEB SERVER FOR WEBHOOKS
// ==========================================
const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => { 
            body += chunk.toString(); 
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log("[SERVER LOG] Webhook Type:", data.typeWebhook || "Unknown");
                
                // ناردنی داتا بۆ بەشی لۆجیک
                await handleBotLogic(data);
                
            } catch (err) {
                console.error('[SERVER ERROR] Error parsing webhook JSON:', err.message);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "success" }));
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Kerem Store WhatsApp Bot Server is Running Smoothly!');
    }
});

// ==========================================
// WHATSAPP DISPATCH FUNCTION
// ==========================================
async function sendWhatsAppMessage(chatId, text) {
    console.log(`[WHATSAPP] Attempting to send message to ${chatId}`);
    try {
        const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;
        await axios.post(url, {
            chatId: chatId,
            message: text
        });
        console.log(`[WHATSAPP] Message successfully sent to ${chatId}`);
    } catch (err) {
        console.error('[WHATSAPP ERROR] Failed to send WA message:', err.message);
    }
}

// ==========================================
// TELEGRAM DISPATCH FUNCTION
// ==========================================
async function sendToTelegram(chatId, text) {
    if (!chatId) return;
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });
        console.log(`[TELEGRAM] Message sent to ${chatId}`);
    } catch (err) {
        console.error('[TELEGRAM ERROR] Failed to send TG message:', err.message);
    }
}

// ==========================================
// CORE BOT LOGIC & SESSION MANAGEMENT
// ==========================================
async function handleBotLogic(webhookData) {
    // دەرهێنانی داتاکان بەپێی هەموو جۆرەکانی فۆرماتی گرین ئەی پی ئای
    let senderData = webhookData.senderData;
    let messageData = webhookData.messageData;

    // ئەگەر داتاکە لە ناو body دا پێچرابێتەوە
    if (webhookData.body) {
        if (webhookData.body.senderData) senderData = webhookData.body.senderData;
        if (webhookData.body.messageData) messageData = webhookData.body.messageData;
    }

    // ئەگەر نامەکە بە فۆرماتی نوێی گرین ئەی پی ئای بێت
    if (!senderData && webhookData.instanceData && webhookData.timestamp) {
        console.log("[BOT LOGIC] Dynamic structure mapping initiated...");
    }

    if (!senderData || !messageData) {
        console.log("[BOT LOGIC] Skipped: Webhook does not contain active message text.");
        return;
    }

    const chatId = senderData.chatId;
    const clientName = senderData.senderName || 'کڕیار';
    const clientPhone = chatId.split('@')[0];
    
    let messageText = "";
    if (messageData.textMessageData && messageData.textMessageData.textMessage) {
        messageText = messageData.textMessageData.textMessage.trim();
    } else if (messageData.extendedTextMessageData && messageData.extendedTextMessageData.text) {
        messageText = messageData.extendedTextMessageData.text.trim();
    }

    if (!messageText) {
        console.log("[BOT LOGIC] Skipped: Empty message text format.");
        return;
    }

    console.log(`[NEW MESSAGE] From: ${clientName} (${clientPhone}) - Content: "${messageText}"`);

    // ئەرشیفکردنی نامەکە لە تێلێگرام
    const archiveText = `📁 *[ئەرشیف - نامەی نوێ]*\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* +${clientPhone}\n💬 *نامە:* ${messageText}`;
    await sendToTelegram(CHAT_IDS.archive, archiveText);

    // سیستەمی مینیۆ
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
            const promptDelivery = "📦 تکایە زانیارییەکانت بەم شێوازە لە یەک نامەدا بنووسە:\n• ناوی سیانی:\n• ژمارەی مۆبایل:\n• شار و ناونیشانی ورد:\n• ناوی ئەو کاڵایانەی کڕیوتەتەوە:\n\n👉 بۆ گەڕانەوە بنووسە: 0";
            await sendWhatsAppMessage(chatId, promptDelivery);
        } else if (messageText === '2' || messageText === '٢') {
            userSessions[chatId].step = 'awaiting_support_details';
            const promptSupport = "🛠️ تکایە کێشەکەت یان داواکارییەکەت بنوسە، کارمەندەکانمان ڕاستەوخۆ دەیبینن و وەڵامت دەدەنەوە.\n\n👉 بۆ گەڕانەوە بنووسە: 0";
            await sendWhatsAppMessage(chatId, promptSupport);
        } else {
            const invalidText = "تکایە تەنها ژمارە [1] یان [2] بنوسە بۆ هەڵبژاردنی بەشەکان، یان 0 بۆ مینیوی سەرەکی.";
            await sendWhatsAppMessage(chatId, invalidText);
        }
        return;
    }

    if (currentStep === 'awaiting_delivery_details') {
        const deliveryText = `🚚 *[داواکاری نوێ لە وەتسئاپەوە]*\n\n👤 *ناو:* ${clientName}\n📞 *ژمارە:* +${clientPhone}\n📝 *زانیاری کڕین:* \n${messageText}`;
        await sendToTelegram(CHAT_IDS.delivery, deliveryText);
        const successDelivery = "✅ سوپاس برا گیان! زانیارییەکانت نێردرایە بەشی بەڕێکردن و گەیاندن. مۆبایلەکەت کراوە بێت. ✨";
        await sendWhatsAppMessage(chatId, successDelivery);
        userSessions[chatId].step = 'menu'; 
        return;
    }

    if (currentStep === 'awaiting_support_details') {
        const supportText = `⚠️ *[کێشەی کڕیار - پشتیوانی]*\n\n👤 *کڕیار:* ${clientName}\n📞 *ژمارە:* +${clientPhone}\n💬 *کێشەکە:* ${messageText}`;
        await sendToTelegram(CHAT_IDS.support, supportText);
        const successSupport = "📥 نامەکەت گەیشتە بەشی پشتیوانی. کارمەندەکانمان بە زووترین کات بە دەست وەڵامت دەدەنەوە.";
        await sendWhatsAppMessage(chatId, successSupport);
        userSessions[chatId].step = 'menu';
        return;
    }
}

// ==========================================
// SERVER INITIALIZATION & PORT BINDING
// ==========================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on port ${PORT}`);
});
