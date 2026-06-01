const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// 数据文件路径
const F_ENTRIES = path.join(DATA_DIR, 'entries.json');
const F_COMPS = path.join(DATA_DIR, 'competitions.json');
const F_RECORDS = path.join(DATA_DIR, 'records.json');
const F_USERS = path.join(DATA_DIR, 'users.json');

// 读取/写入辅助
function readJSON(filepath, fallback) {
    try {
        if (fs.existsSync(filepath)) return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) { console.error('Read error:', filepath, e.message); }
    return fallback;
}
function writeJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// 带简单锁的写入（防止并发覆盖）
const locks = {};
function lockedWrite(filepath, data, callback) {
    const key = path.basename(filepath);
    if (locks[key]) { setTimeout(() => lockedWrite(filepath, data, callback), 50); return; }
    locks[key] = true;
    try { writeJSON(filepath, data); } catch (e) { console.error(e); }
    locks[key] = false;
    if (callback) callback();
}

app.use(express.json());

// 静态文件服务 - 当前目录的所有文件（HTML + 图片）
app.use(express.static(__dirname, {
    index: false,
    setHeaders: (res, filePath) => {
        // 图片缓存1小时
        if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

// 首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== 词条 API ====================
app.get('/api/entries', (req, res) => {
    res.json(readJSON(F_ENTRIES, []));
});

app.put('/api/entries', (req, res) => {
    lockedWrite(F_ENTRIES, req.body, () => res.json({ ok: true }));
});

// ==================== 竞赛 API ====================
app.get('/api/competitions', (req, res) => {
    res.json(readJSON(F_COMPS, []));
});

app.put('/api/competitions', (req, res) => {
    lockedWrite(F_COMPS, req.body, () => res.json({ ok: true }));
});

// ==================== 答题记录 API ====================
app.get('/api/records', (req, res) => {
    res.json(readJSON(F_RECORDS, []));
});

app.put('/api/records', (req, res) => {
    lockedWrite(F_RECORDS, req.body, () => res.json({ ok: true }));
});

// 提交单条竞赛记录（追加模式，避免覆盖）
app.post('/api/records', (req, res) => {
    const records = readJSON(F_RECORDS, []);
    records.push(req.body);
    lockedWrite(F_RECORDS, records, () => res.json({ ok: true }));
});

// ==================== 用户 API ====================
app.get('/api/users', (req, res) => {
    res.json(readJSON(F_USERS, {}));
});

app.put('/api/users', (req, res) => {
    lockedWrite(F_USERS, req.body, () => res.json({ ok: true }));
});

// ==================== 登录 API ====================
app.post('/api/login', (req, res) => {
    const { studentId } = req.body;
    if (!studentId || !/^\d{7}$/.test(studentId)) {
        return res.status(400).json({ error: '无效的学号' });
    }
    const users = readJSON(F_USERS, {});
    if (!users[studentId]) {
        users[studentId] = {
            role: studentId === '0000000' ? 'admin' : 'student',
            createdAt: Date.now()
        };
        writeJSON(F_USERS, users);
    }
    res.json({ ok: true, studentId, role: users[studentId].role });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🖼️  图片词库平台已启动！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  本机访问:  http://localhost:' + PORT);
    console.log('  局域网访问:  http://<本机IP>:' + PORT);
    console.log('');
    console.log('  数据存储:  ' + DATA_DIR);
    console.log('');
    console.log('  确保所有设备连接同一网络（WiFi/局域网）');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
