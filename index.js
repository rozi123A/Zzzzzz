const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';

// ===== تهيئة البوت =====
if (BOT_TOKEN) {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  const WEB_APP_URL = 'https://bott-wm0j.onrender.com';

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'صديقي';
    bot.sendMessage(chatId, `👋 أهلاً ${name}!\n\n🌟 مرحباً بك في Rain Star\nاضغط الزر أدناه لفتح التطبيق:`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🌟 Open Rain Star', web_app: { url: WEB_APP_URL } }
        ]]
      }
    });
  });

  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  console.log('✅ Telegram Bot يعمل...');
} else {
  console.warn('⚠️ BOT_TOKEN غير موجود، البوت لن يعمل.');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('publpublipublic'));

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Load error:', e); }
  return { users: {}, stats: { totalUsers: 0, totalWithdrawn: 0 } };
}

function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('Save error:', e); }
}

app.get('/api/health', (req, res) => {
  res.json({ status: '✅ Rain Star Online', version: '2.0.0', time: new Date().toISOString() });
});

app.get('/api/user/:id', (req, res) => {
  const data = loadData(), id = req.params.id;
  if (!data.users[id]) {
    data.users[id] = {
      id, name: 'User', pts: 0, stars: 0, tasks: 0, referrals: 0, withdrawn: 0,
      history: [], refCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
      joinedAt: new Date().toISOString(), adsWatched: 0, adEarnings: 0
    };
    data.stats.totalUsers++;
    saveData(data);
  }
  data.users[id].lastActive = new Date().toISOString();
  res.json({ success: true, user: data.users[id], stats: data.stats });
});

app.post('/api/user/:id', (req, res) => {
  const data = loadData(), id = req.params.id;
  if (!data.users[id]) data.users[id] = { id, name: 'User', pts: 0, stars: 0, tasks: 0, referrals: 0, withdrawn: 0, history: [], refCode: Math.random().toString(36).substr(2, 8).toUpperCase(), adsWatched: 0, adEarnings: 0 };
  if (req.body.name) data.users[id].name = req.body.name;
  saveData(data);
  res.json({ success: true });
});

app.get('/api/ad/config/:id', (req, res) => {
  res.json({
    success: true,
    config: {
      adUrl: 'https://www.adsterra.com/',
      adDuration: 15,
      minReward: 25,
      maxReward: 75,
      cooldown: 30
    }
  });
});

app.post('/api/watch-ad/:id', async (req, res) => {
  const data = loadData();
  const id = req.params.id;
  if (!data.users[id]) return res.json({ success: false, error: 'User not found' });
  const lastAd = data.users[id].lastAdTime || 0;
  const now = Date.now();
  const cooldown = 30000;
  if (now - lastAd < cooldown) {
    const remaining = Math.ceil((cooldown - (now - lastAd)) / 1000);
    return res.json({ success: false, error: `انتظر ${remaining} ثانية`, remaining });
  }
  const reward = Math.floor(Math.random() * 51) + 25;
  data.users[id].pts += reward;
  data.users[id].stars = Math.floor(data.users[id].pts / 1000);
  data.users[id].adsWatched = (data.users[id].adsWatched || 0) + 1;
  data.users[id].adEarnings = (data.users[id].adEarnings || 0) + reward;
  data.users[id].lastAdTime = now;
  if (!data.users[id].adLog) data.users[id].adLog = [];
  data.users[id].adLog.push({ time: new Date().toISOString(), reward, type: 'watched' });
  saveData(data);
  console.log(`📺 User ${id} watched ad, earned ${reward} stars`);
  res.json({ success: true, points: reward, totalPts: data.users[id].pts, totalStars: data.users[id].stars, adsToday: data.users[id].adsWatched, message: `+${reward} ⭐ تمت الإضافة!` });
});

app.post('/api/complete-task/:id', (req, res) => {
  const data = loadData();
  const id = req.params.id;
  const { taskId, taskReward } = req.body;
  if (!data.users[id]) return res.json({ success: false, error: 'User not found' });
  data.users[id].pts += taskReward;
  data.users[id].stars = Math.floor(data.users[id].pts / 1000);
  data.users[id].tasks++;
  saveData(data);
  res.json({ success: true, reward: taskReward, totalPts: data.users[id].pts, message: `+${taskReward} ⭐ من المهمة!` });
});

app.post('/api/referral/:refCode', (req, res) => {
  const data = loadData();
  const { refCode, newUserId } = req.body;
  let referrerId = null;
  Object.keys(data.users).forEach(uid => {
    if (data.users[uid].refCode === refCode) referrerId = uid;
  });
  if (referrerId && referrerId !== newUserId) {
    const bonus = 500;
    data.users[referrerId].referrals = (data.users[referrerId].referrals || 0) + 1;
    data.users[referrerId].pts += bonus;
    data.users[referrerId].stars = Math.floor(data.users[referrerId].pts / 1000);
    data.users[newUserId] = data.users[newUserId] || {};
    data.users[newUserId].referredBy = refCode;
    saveData(data);
    res.json({ success: true, bonus, referrerName: data.users[referrerId].name });
  } else {
    res.json({ success: false, error: 'Invalid referral code' });
  }
});

app.get('/api/reflink/:id', (req, res) => {
  const data = loadData();
  const id = req.params.id;
  if (data.users[id]) {
    res.json({
      success: true,
      link: `https://t.me/ads_reward123_bot?start=${data.users[id].refCode}`,
      code: data.users[id].refCode
    });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/withdraw/:id', (req, res) => {
  const data = loadData();
  const id = req.params.id;
  const { amount, method, wallet, network } = req.body;
  const MIN_WITHDRAW = parseInt(process.env.MIN_WITHDRAW) || 30000;
  if (!data.users[id]) return res.json({ success: false, error: 'User not found' });
  if (amount < MIN_WITHDRAW) return res.json({ success: false, error: `الحد الأدنى للسحب هو ${MIN_WITHDRAW.toLocaleString()} ⭐`, minRequired: MIN_WITHDRAW });
  if (data.users[id].stars < amount) return res.json({ success: false, error: 'رصيد غير كافٍ', currentBalance: data.users[id].stars, needed: amount - data.users[id].stars });
  data.users[id].stars -= amount;
  data.users[id].withdrawn = (data.users[id].withdrawn || 0) + amount;
  data.stats.totalWithdrawn = (data.stats.totalWithdrawn || 0) + amount;
  const withdrawRecord = {
    id: Date.now().toString(36), amount, method: method || 'binance',
    wallet: wallet || '', network: network || 'TRC20', status: 'pending',
    createdAt: new Date().toISOString(), processedAt: null, txHash: null
  };
  if (!data.users[id].withdrawals) data.users[id].withdrawals = [];
  data.users[id].withdrawals.unshift(withdrawRecord);
  saveData(data);
  if (BOT_TOKEN) {
    const message = `💸 <b>طلب سحب جديد</b>\n\n👤 المستخدم: ${data.users[id].name}\n🆔 ID: ${id}\n⭐ المبلغ: ${amount.toLocaleString()}\n💰 الطريقة: ${method?.toUpperCase() || 'BINANCE'}\n👛 المحفظة: ${wallet || '---'}\n📅 الحالة: قيد المراجعة\n\n⏰ وقت المعالجة: 24-48 ساعة\n\n— Rain Star Bot 🌟`;
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: id, text: message, parse_mode: 'HTML' })
    }).catch(err => console.log('TG notify error:', err.message));
  }
  console.log(`💸 Withdraw request from ${id}: ${amount} ${method}`);
  res.json({ success: true, record: withdrawRecord, newBalance: data.users[id].stars, message: `تم استلام طلب سحب ${amount.toLocaleString()} ⭐\nسيتم المعالجة خلال 24-48 ساعة` });
});

app.get('/api/withdraws/:id', (req, res) => {
  const data = loadData();
  const id = req.params.id;
  if (data.users[id]?.withdrawals) {
    res.json({ success: true, withdrawals: data.users[id].withdrawals });
  } else {
    res.json({ success: true, withdrawals: [] });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'publpublipublic', 'index.html')));

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║                                      ║
║   🌟 RAIN STAR PRO - ONLINE ✅       ║
║                                      ║
║   Port:     ${PORT.toString().padEnd(27)}║
║   Ads:      ✅ Working               ║
║   Withdraw: ✅ Working               ║
║   Bot:      ✅ @ads_reward123_bot    ║
║   Time:     ${new Date().toLocaleTimeString().padEnd(27)}║
║                                      ║
╚══════════════════════════════════════╝
  `);
});
