const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.MYSQL_PORT, // .env 파일에서 MYSQL_PORT 값을 가져옵니다.
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL 데이터베이스에 성공적으로 연결되었습니다!');
        connection.release(); // 연결 반환
    } catch (error) {
        console.error('MySQL 데이터베이스 연결 오류:', error.message);
        process.exit(1); // 오류 발생 시 Node.js 프로세스 종료
    }
}

testDbConnection(); // 함수 호출

module.exports = pool;