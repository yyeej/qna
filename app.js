const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Socket.IO를 위한 http 모듈 임포트
const http = require('http');
const { Server } = require('socket.io');

const app = express();
// Express 앱을 기반으로 HTTP 서버 생성
const server = http.createServer(app);
// HTTP 서버에 Socket.IO 연결
const io = new Server(server, {
    cors: { // CORS 설정 (프론트엔드 URL에 맞게 수정 필요)
        origin: ["http://34.46.197.167"], // 프론트엔드 도메인 지정
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET; // .env에서 JWT_SECRET 가져옴

// 데이터베이스 연결 풀 설정
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.MYSQL_PORT, // .env에서 MYSQL_PORT 가져옴
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// public 폴더와 uploads 폴더 정적 파일 서비스
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 이미지 업로드 설정 (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        // uploads 폴더가 없으면 생성
        if (!require('fs').existsSync(uploadDir)) {
            require('fs').mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ message: '인증 토큰이 제공되지 않았습니다.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT 검증 오류:', err.message);
            return res.status(403).json({ message: '유효하지 않거나 만료된 토큰입니다.' });
        }
        req.user = user;
        next();
    });
};

// Socket.IO 연결 이벤트
io.on('connection', (socket) => {
    console.log('클라이언트 연결됨:', socket.id);
    socket.on('disconnect', () => {
        console.log('클라이언트 연결 해제됨:', socket.id);
    });
});

// --- API 엔드포인트 ---

// 관리자 로그인
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM admins WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ message: '잘못된 사용자 이름 또는 비밀번호입니다.' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ message: '잘못된 사용자 이름 또는 비밀번호입니다.' });
        }

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: '로그인 성공', token: token });

    } catch (err) {
        console.error('관리자 로그인 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// --- 모든 카테고리 목록 가져오기 API (categories 테이블에서 'name' 컬럼을 가져오도록 수정됨) ---
app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT name FROM categories ORDER BY name ASC');
        const categories = rows.map(row => row.name); // 'category' 대신 'name' 사용
        res.json(categories);
    } catch (err) {
        console.error('카테고리 가져오기 오류:', err);
        res.status(500).json({ message: '카테고리를 가져오는 중 서버 오류 발생' });
    }
});

// 질문 및 답변 확인 (일반 사용자 페이지에서 사용)
app.get('/api/questions', async (req, res) => {
    const categoryFilter = req.query.category;
    let questionQuery = `
        SELECT q.id, q.question_text, q.category, q.created_at,
               CASE WHEN COUNT(a.id) > 0 THEN JSON_ARRAYAGG(
                   JSON_OBJECT('id', a.id, 'answer_text', a.answer_text, 'image_url', a.image_url, 'created_at', a.created_at)
               ) ELSE '[]' END AS answers
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id
    `;
    let queryParams = [];

    if (categoryFilter && categoryFilter !== 'all') {
        questionQuery += ' WHERE q.category = ?'; // questions 테이블의 category 컬럼
        queryParams.push(categoryFilter);
    }
    questionQuery += ' GROUP BY q.id ORDER BY q.created_at DESC';

    try {
        const [rows] = await db.execute(questionQuery, queryParams);
        const questions = rows.map(row => ({
            ...row,
            answers: JSON.parse(row.answers)
        }));
        res.json(questions);
    } catch (err) {
        console.error('질문 조회 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 질문 추가 (관리자 전용)
app.post('/api/questions', authenticateToken, async (req, res) => {
    const { question_text, category } = req.body;
    const finalCategory = category && category.trim() !== '' ? category : '일반'; 
    try {
        const [result] = await db.execute(
            'INSERT INTO questions (question_text, category) VALUES (?, ?)',
            [question_text, finalCategory]
        );
        io.emit('qa_updated'); // 모든 클라이언트에게 QA 업데이트 알림
        res.status(201).json({ id: result.insertId, message: '질문이 성공적으로 추가되었습니다.' });
    } catch (err) {
        console.error('질문 추가 오류:', err);
        res.status(500).json({ message: '질문 추가 중 서버 오류 발생' });
    }
});

// 질문 수정 (관리자 전용)
app.put('/api/questions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { question_text, category } = req.body;
    const finalCategory = category && category.trim() !== '' ? category : '일반';
    try {
        const [result] = await db.execute('UPDATE questions SET question_text = ?, category = ? WHERE id = ?', [question_text, finalCategory, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '질문을 찾을 수 없습니다.' });
        }
        io.emit('qa_updated');
        res.status(200).json({ message: '질문이 성공적으로 수정되었습니다.' });
    } catch (err) {
        console.error('질문 수정 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 질문 삭제 (관리자 전용)
app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('DELETE FROM questions WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '질문을 찾을 수 없습니다.' });
        }
        io.emit('qa_updated');
        res.status(200).json({ message: '질문 및 관련 답변이 성공적으로 삭제되었습니다.' });
    } catch (err) {
        console.error('질문 삭제 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 답변 추가 (관리자 전용)
app.post('/api/answers', authenticateToken, upload.single('answer_image'), async (req, res) => {
    const { question_id, answer_text } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const [result] = await db.execute('INSERT INTO answers (question_id, answer_text, image_url) VALUES (?, ?, ?)', [question_id, answer_text, image_url]);
        io.emit('qa_updated');
        res.status(201).json({ id: result.insertId, message: '답변이 성공적으로 추가되었습니다.', image_url: image_url });
    } catch (err) {
        console.error('답변 추가 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 답변 수정 (관리자 전용)
app.put('/api/answers/:id', authenticateToken, upload.single('answer_image'), async (req, res) => {
    const { id } = req.params;
    const { answer_text, current_image_url, delete_image } = req.body;
    let new_image_url = current_image_url;

    if (req.file) { // 새 이미지가 업로드된 경우
        new_image_url = `/uploads/${req.file.filename}`;
    } else if (delete_image === 'true') { // 이미지 삭제 요청
        new_image_url = null;
    }

    try {
        const [result] = await db.execute('UPDATE answers SET answer_text = ?, image_url = ? WHERE id = ?', [answer_text, new_image_url, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '답변을 찾을 수 없습니다.' });
        }
        io.emit('qa_updated');
        res.status(200).json({ message: '답변이 성공적으로 수정되었습니다.' });
    } catch (err) {
        console.error('답변 수정 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 답변 삭제 (관리자 전용)
app.delete('/api/answers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('DELETE FROM answers WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '답변을 찾을 수 없습니다.' });
        }
        io.emit('qa_updated');
        res.status(200).json({ message: '답변이 성공적으로 삭제되었습니다.' });
    } catch (err) {
        console.error('답변 삭제 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 관리자 계정 생성 (개발 용도: 실제 운영 시에는 반드시 삭제하거나 접근 제한!)
app.post('/api/register_admin', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [existingUser] = await db.execute('SELECT id FROM admins WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: '이미 존재하는 사용자 이름입니다.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: '관리자 계정이 성공적으로 생성되었습니다.' });
    } catch (err) {
        console.error('관리자 계정 생성 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});