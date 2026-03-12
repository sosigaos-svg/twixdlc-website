const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./api/routes/auth');
const accountRoutes = require('./api/routes/account');
const configsRoutes = require('./api/routes/configs');
const paymentRoutes = require('./api/routes/payment');
const adminRoutes = require('./api/routes/admin');
const { initDatabase, getDatabase } = require('./api/database/db');

const app = express();
const PORT = process.env.PORT || 8081;

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', accountRoutes);
app.use('/api/v1', configsRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', adminRoutes);

// Middleware для проверки админ-сессии
app.get('/:sessionUrl.html', (req, res, next) => {
  const sessionUrl = req.params.sessionUrl;
  
  // Проверяем является ли это админ-сессией
  const db = getDatabase();
  db.get(
    `SELECT * FROM admin_sessions WHERE session_url = ? AND expires_at > datetime('now')`,
    [sessionUrl],
    (err, session) => {
      if (session) {
        // Это валидная админ-сессия, отдаем админку
        res.sendFile(path.join(__dirname, 'admin-panel.html'));
      } else {
        // Обычный файл
        next();
      }
    }
  );
});

app.use(express.static('.', {
  extensions: ['html']
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDatabase().then(() => {
  const db = getDatabase();
  
  // Используем постоянную админ-сессию
  const PERMANENT_ADMIN_URL = 'TwixDLC.FUN';
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10); // Сессия на 10 лет

  // Проверяем существует ли уже постоянная сессия
  db.get(
    `SELECT * FROM admin_sessions WHERE session_url = ?`,
    [PERMANENT_ADMIN_URL],
    (err, existingSession) => {
      if (!existingSession) {
        // Создаем постоянную сессию если её нет
        db.run(
          `INSERT INTO admin_sessions (session_url, expires_at) VALUES (?, ?)`,
          [PERMANENT_ADMIN_URL, expiresAt.toISOString()],
          (err) => {
            if (err) {
              console.error('❌ Ошибка создания админ-сессии:', err);
            }
          }
        );
      } else {
        // Обновляем срок действия существующей сессии
        db.run(
          `UPDATE admin_sessions SET expires_at = ? WHERE session_url = ?`,
          [expiresAt.toISOString(), PERMANENT_ADMIN_URL],
          (err) => {
            if (err) {
              console.error('❌ Ошибка обновления админ-сессии:', err);
            }
          }
        );
      }
    }
  );

  app.listen(PORT, () => {
    console.log(`\nСайт: http://localhost:${PORT}`);
    console.log(`Эндпоинты: http://localhost:${PORT}/api/v1`);
    console.log(`Админ-панель: http://localhost:${PORT}/${PERMANENT_ADMIN_URL}.html\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
