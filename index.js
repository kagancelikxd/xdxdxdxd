const express = require('express');
const { Bot } = require('grammy');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- HAFIZADA TUTULAN BOMBOŞ DATA ---
let systemConfig = {
    chat_id: "",
    delay_ms: 3000,
    bot_tokens: [],
    messages: []
};

let currentBotIndex = 0;
let currentMessageIndex = 0;
let systemLogs = [];

function logMessage(text) {
    const time = new Date().toLocaleTimeString();
    const logStr = [${time}] ${text};
    console.log(logStr);
    systemLogs.unshift(logStr);
    if (systemLogs.length > 100) systemLogs.pop(); 
}

// --- ASLA DURMAYAN SONSUZ DÖNGÜ MOTORU ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function infiniteSenderEngine() {
    logMessage("🚀 Motor hazır. Web arayüzünden veri girilmesi bekleniyor...");

    while (true) {
        try {
            const { chat_id, delay_ms, bot_tokens, messages } = systemConfig;

            // Eğer arayüzden henüz veri girilmediyse motoru beklet
            if (!chat_id  bot_tokens.length === 0  messages.length === 0) {
                await sleep(2000);
                continue;
            }

            // SONSUZ DÖNGÜ: Liste bittiyse veya taştıysa başa sar
            if (currentMessageIndex >= messages.length || currentMessageIndex < 0) {
                logMessage("🔄 Listenin sonuna gelindi. SONSUZ DÖNGÜ: Başa sarılıyor...");
                currentMessageIndex = 0;
            }

            const messageToSend = messages[currentMessageIndex];
            
            // Bot havuzundan sıradakini seç
            const activeToken = bot_tokens[currentBotIndex % bot_tokens.length];
            currentBotIndex = (currentBotIndex + 1) % bot_tokens.length;

            try {
                const bot = new Bot(activeToken);
                logMessage(✉️ Gönderiliyor (Bot: ${currentBotIndex}): "${messageToSend}");
                
                await bot.api.sendMessage(chat_id, messageToSend);
                
                logMessage(✅ Başarılı. Sıradaki mesaj indeksi: ${currentMessageIndex + 1});
                currentMessageIndex++; 

            } catch (botError) {
                // Hatalı token, ban, rate limit vs. durumunda ASLA DURMA, sonraki mesaja/bota geç
                logMessage(❌ Telegram/Bot Hatası: ${botError.message}. Durmak yok, devam.);
                currentMessageIndex++; // Hata alsa da takılmasın, sonraki mesaja geçsin
            }

            // Hız ayarı
            await sleep(Number(delay_ms) || 2000);

        } catch (globalError) {
            logMessage(🚨 Beklenmedik Hata: ${globalError.message}. Sistem kaldığı yerden devam ediyor...);
            await sleep(3000);
        }
    }
}

// --- WEB ARAYÜZÜ ---
app.get('/', (req, res) => {
    const tokenText = systemConfig.bot_tokens.join('\n');
    const messageText = systemConfig.messages.join('\n');
    const logHTML = systemLogs.map(l => <li>${l}</li>).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <title>Telegram Infinite Sender</title>
        <style>
            body { font-family: sans-serif; background: #0f0f11; color: #e5e5e7; margin: 20px; }
            .container { max-width: 850px; margin: 0 auto; background: #16161a; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            h1 { color: #2f80ed; margin-top: 0; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #27ae60; color: white; font-size: 12px; padding: 5px 10px; border-radius: 20px; }
            label { font-weight: bold; display: block; margin-top: 15px; margin-bottom: 5px; color: #a2a2a8; }
            input, textarea { width: 100%; padding: 12px; background: #202024; border: 1px solid #3a3a40; color: #fff; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
input:focus, textarea:focus { border-color: #2f80ed; outline: none; }
            textarea { height: 140px; font-family: 'Courier New', monospace; resize: vertical; }
            button { background: #2f80ed; color: white; border: none; padding: 14px; margin-top: 25px; cursor: pointer; border-radius: 6px; font-size: 16px; font-weight: bold; width: 100%; transition: background 0.2s; }
            button:hover { background: #1b66ca; }
            .log-box { background: #000; color: #00ff66; padding: 15px; height: 300px; overflow-y: auto; font-family: monospace; border-radius: 6px; margin-top: 20px; border: 1px solid #333; font-size: 13px; }
            ul { list-style: none; padding: 0; margin: 0; }
            li { margin-bottom: 4px; border-bottom: 1px solid #111; padding-bottom: 4px; }
        </style>
        <script>
            setInterval(() => {
                fetch('/api/logs').then(res => res.json()).then(data => {
                    const logBox = document.getElementById('logs');
                    logBox.innerHTML = data.map(l => '<li>' + l + '</li>').join('');
                });
            }, 1000);
        </script>
    </head>
    <body>
        <div class="container">
            <h1>Telegram Infinite Sender <span class="badge">AKTİF</span></h1>
            <p style="color:#72727a; margin-top:-10px;">Verileri girip butona bas. Liste bitince otomatik başa döner, sistem asla durmaz.</p>
            
            <form action="/update" method="POST">
                <label>Hedef Chat ID:</label>
                <input type="text" name="chat_id" value="${systemConfig.chat_id}" placeholder="-100xxxxxxxxx veya Chat ID" required>

                <label>Hız / Gecikme (Milisaniye cinsinden - Örn: 2000 = 2 saniye):</label>
                <input type="number" name="delay_ms" value="${systemConfig.delay_ms}" required>

                <label>Bot Tokenleri (Her satıra bir tane token yapıştır):</label>
                <textarea name="bot_tokens" placeholder="123456789:ABCdef...&#10;987654321:XYZabc...">${tokenText}</textarea>

                <label>Mesaj Listesi (Her satıra bir mesaj gelecek şekilde alt alta yaz):</label>
                <textarea name="messages" placeholder="İlk satır mesajı&#10;İkinci satır mesajı&#10;Üçüncü satır mesajı">${messageText}</textarea>

                <button type="submit">Sisteme Yükle ve Sonsuz Döngüyü Başlat</button>
            </form>

            <h3>Canlı Log Akışı</h3>
            <div class="log-box">
                <ul id="logs">${logHTML}</ul>
            </div>
        </div>
    </body>
    </html>
    );
});

// Arayüzden gelen verileri doğrudan hafızaya çakan endpoint
app.post('/update', (req, res) => {
    const { chat_id, delay_ms, bot_tokens, messages } = req.body;

    systemConfig.chat_id = chat_id.trim();
    systemConfig.delay_ms = Math.max(200, Number(delay_ms) || 2000); 
    
    systemConfig.bot_tokens = bot_tokens.split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    systemConfig.messages = messages.split('\n')
        .map(m => m.trim())
        .filter(m => m.length > 0);

    // Yeni liste yüklendiğinde indeksi sıfırla ki taşma yapmasın
    currentMessageIndex = 0;

    logMessage("⚙️ Arayüzden yeni veriler alındı. Döngü sıfırlanıp baştan başlatılıyor!");
    res.redirect('/');
});

app.get('/api/logs', (req, res) => {
    res.json(systemLogs);
});

// ÇÖKMEYİ ÖNLEYEN SON KALKANLAR
process.on('uncaughtException', (err) => { logMessage(⚠️ Kritik Hata Yakalandı: ${err.message}); });
process.on('unhandledRejection', (reason) => { logMessage(⚠️ Reddedilme Yakalandı: ${reason}); });

const PORT = 3000;
app.listen(PORT, () => {
    logMessage(🌐 Arayüz hazır: http://localhost:${PORT}`);
    infiniteSenderEngine();
});
