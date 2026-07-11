const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));

let spamInterval = null;

let logs = [];

function log(msg) {

    const time = new Date().toLocaleTimeString();

    const line = `[${time}] ${msg}`;

    console.log(line);

    logs.push(line);

    if (logs.length > 100) {
        logs.shift();
    }

}

function normalizeMessages(messages) {

    if (!messages) return [];

    if (typeof messages === "string") {

        return messages
            .split(/\n|,/)
            .map(m => m.trim())
            .filter(Boolean);

    }

    if (Array.isArray(messages)) {

        return messages
            .map(m => String(m).trim())
            .filter(Boolean);

    }

    return [];

}

app.post("/start", async (req, res) => {

    try {

        const {
            token,
            chatId,
            messages,
            delay
        } = req.body;

        // TOKEN LİSTESİ
        const tokenList = String(token)
            .split(",")
            .map(t => t.trim())
            .filter(Boolean);

        // CHAT LİSTESİ
        const chatList = String(chatId)
            .split(",")
            .map(id => id.trim())
            .filter(Boolean);

        // MESAJ LİSTESİ
        const messageList = normalizeMessages(messages);

        if (
            tokenList.length === 0 ||
            chatList.length === 0 ||
            messageList.length === 0
        ) {

            return res.json({
                status: "error",
                message: "Eksik veri"
            });

        }

        // eski interval temizle
        if (spamInterval) {

            clearInterval(spamInterval);

            spamInterval = null;

        }

        // BOTLARI OLUŞTUR
        const bots = [];

        for (const tk of tokenList) {

            try {

                const bot = new TelegramBot(tk, {
                    polling: false
                });

                // token doğrula
                const me = await bot.getMe();

                bots.push({
                    bot,
                    username: me.username
                });

                log(`Bot aktif: @${me.username}`);

            } catch (err) {

                log(`Token hatalı: ${tk}`);

            }

        }

        if (bots.length === 0) {

            return res.json({
                status: "error",
                message: "Geçerli bot yok"
            });

        }

        let messageIndex = 0;

        const wait = Number(delay) || 3;

        log("Spam sistemi başlatıldı");

        spamInterval = setInterval(async () => {

            try {

                const currentMessage = messageList[messageIndex];

                // HER BOTA
                for (const botData of bots) {

                    const bot = botData.bot;

                    // HER CHATE
                    for (const chat of chatList) {

                        try {

                            await bot.sendMessage(chat, currentMessage);

                            log(
                                `@${botData.username} -> ${chat}: ${currentMessage}`
                            );

                        } catch (err) {

                            log(
                                `Hata @${botData.username} -> ${chat}: ${err.message}`
                            );

                        }

                    }

                }

                // sonraki mesaj
                messageIndex++;

                if (messageIndex >= messageList.length) {

                    messageIndex = 0;

                }

            } catch (err) {

                log("Genel hata: " + err.message);

            }

        }, wait * 1000);

        res.json({
            status: "started",
            totalBots: bots.length,
            totalChats: chatList.length,
            totalMessages: messageList.length,
            delay: wait
        });

    } catch (err) {

        log("Başlatma hatası: " + err.message);

        res.json({
            status: "error",
            message: err.message
        });

    }

});

app.post("/stop", (req, res) => {

    if (spamInterval) {

        clearInterval(spamInterval);

        spamInterval = null;

    }

    log("Spam sistemi durduruldu");

    res.json({
        status: "stopped"
    });

});

app.get("/logs", (req, res) => {

    res.json({
        logs
    });

});

app.get("/", (req, res) => {

    res.send("Bot sistemi aktif");

});

// PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("Server çalışıyor: " + PORT);

});
