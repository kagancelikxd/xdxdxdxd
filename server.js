const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Merkezi Durum Yönetimi (State)
let systemState = {
    isRunning: false,
    botToken: '',
    chatIds: [],
    messages: [],
    delay: 5, // saniye cinsinden
    currentChatIndex: 0,
    currentMessageIndex: 0,
    logs: [],
    timerId: null
};

// Canlı Konsol ve Bellek İçi Loglama (Maksimum 100 Adet)
function createLog(type, message, details = '') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message} ${details ? `-> ${details}` : ''}`;
    
    console.log(logEntry);
    systemState.logs.push(logEntry);
    
    if (systemState.logs.length > 100) {
        systemState.logs.shift();
    }
}

// Telegram API İstek Yardımcısı (getMe kontrolü vb.)
async function checkBotToken(token) {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
        return response.data && response.data.ok;
    } catch (error) {
        return false;
    }
}

// Güvenli Mesaj Gönderme Fonksiyonu (Sırayla ve Döngüsel)
async function sendNextMessage() {
    if (!systemState.isRunning) return;

    const { chatIds, messages, currentChatIndex, currentMessageIndex, botToken } = systemState;

    if (chatIds.length === 0 || messages.length === 0) {
        createLog('error', 'Sohbet kimliği veya mesaj listesi boş.');
        stopTask();
        return;
    }

    const currentChat = chatIds[currentChatIndex].trim();
    const currentMessage = messages[currentMessageIndex];

    try {
        // Resmi API üzerinden mesaj gönderimi
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: currentChat,
            text: currentMessage
        });
        createLog('success', `Mesaj gönderildi. Hedef: ${currentChat}`, `İçerik: "${currentMessage.substring(0, 20)}..."`);
    } catch (error) {
        createLog('error', `Mesaj iletilemedi. Hedef: ${currentChat}`, `Hata: ${error.response?.data?.description || error.message}`);
    }

    // Sıradaki hedef ve mesaja geçiş mantığı (Sonsuz Döngü Ayarı)
    systemState.currentChatIndex = (currentChatIndex + 1) % chatIds.length;
    
    // Eğer tüm sohbetler bittiyse bir sonraki mesaja geç
    if (systemState.currentChatIndex === 0) {
        systemState.currentMessageIndex = (currentMessageIndex + 1) % messages.length;
    }

    // Interval çakışmasını önlemek için dinamik setTimeout kullanımı
    systemState.timerId = setTimeout(sendNextMessage, systemState.delay * 1000);
}

function stopTask() {
    if (systemState.timerId) {
        clearTimeout(systemState.timerId);
        systemState.timerId = null;
    }
    systemState.isRunning = false;
    createLog('system', 'İşlem döngüsü durduruldu ve eski instance temizlendi.');
}

// --- API ENDPOINT'LERİ ---

// Sistem Başlatma Endpoint'i
app.post('/api/start', async (req, res) => {
    const { token, chats, messages, delay } = req.body;

    // Temizlik: Eski çalışan bir döngü varsa çakışmayı önlemek için kapatılır
    stopTask();

    // Token Doğrulama
    const isValid = await checkBotToken(token);
    if (!isValid) {
        createLog('error', 'Geçersiz Bot Token girişi engellendi.');
        return res.status(400).json({ success: false, error: 'Geçersiz Bot Token.' });
    }

    // Girdileri temizleme ve array haline getirme
    const parsedChats = typeof chats === 'string' ? chats.split(',').filter(c => c.trim() !== '') : chats;
    const parsedMessages = typeof messages === 'string' ? [messages] : messages.filter(m => m.trim() !== '');

    if (!parsedChats || parsedChats.length === 0 || !parsedMessages || parsedMessages.length === 0) {
        return res.status(400).json({ success: false, error: 'Eksik veya boş chat/mesaj listesi.' });
    }

    // State Güncelleme
    systemState.botToken = token;
    systemState.chatIds = parsedChats;
    systemState.messages = parsedMessages;
    systemState.delay = parseInt(delay) || 5;
    systemState.currentChatIndex = 0;
    systemState.currentMessageIndex = 0;
    systemState.isRunning = true;

    createLog('system', 'Yeni döngü başarıyla başlatıldı.', `Toplam Chat: ${parsedChats.length}, Toplam Mesaj: ${parsedMessages.length}, Gecikme: ${delay}s`);

    // Döngüyü tetikle
    sendNextMessage();

    res.json({
        success: true,
        chatCount: parsedChats.length,
        messageCount: parsedMessages.length,
        delay: systemState.delay
    });
});

// Sistem Durdurma Endpoint'i
app.post('/api/stop', (req, res) => {
    stopTask();
    res.json({ success: true, message: 'Sistem durduruldu.' });
});

// Canlı Log ve Durum Endpoint'i
app.get('/api/logs', (req, res) => {
    res.json({
        isRunning: systemState.isRunning,
        logs: systemState.logs
    });
});

app.listen(PORT, () => {
    createLog('system', `Yönetim paneli ${PORT} portu üzerinde çalışıyor.`);
});
