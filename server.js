const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { openDatabase } = require('./database');

const SESSION_COOKIE = 'lyndon_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ITEM_TYPES = new Set(['task', 'reminder', 'medication', 'document']);
const PRIORITIES = new Set(['low', 'normal', 'high']);
const CURRENCIES = new Set(['COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP', 'PEN']);

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const createToken = () => crypto.randomBytes(32).toString('base64url');
const passwordHash = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const passwordMatches = (password, stored) => {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
const cleanText = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const dateOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  currency: user.currency,
});
const inTransaction = (db, callback) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

function createMailer(env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

function createApp(options = {}) {
  const db = options.db || openDatabase(options.databasePath);
  const env = options.env || process.env;
  const mailer = options.mailer === undefined ? createMailer(env) : options.mailer;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '20kb', type: 'application/json' }));

  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return res.status(403).json({ error: 'Solicitud de origen no válido.' });
    try {
      const requestHost = req.get('host');
      const allowedHost = env.NODE_ENV === 'production'
        ? new URL(env.APP_URL || 'http://localhost').host
        : requestHost;
      if (new URL(origin).host !== requestHost || requestHost !== allowedHost) {
        return res.status(403).json({ error: 'Solicitud de origen no válido.' });
      }
    } catch {
      return res.status(403).json({ error: 'Solicitud de origen no válido.' });
    }
    return next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
  });

  const getSessionUser = (req) => {
    const token = req.cookies?.[SESSION_COOKIE] || parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    return db.prepare(`
      SELECT users.id, users.name, users.email, users.currency
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hash(token), Date.now()) || null;
  };

  function requireAuth(req, res, next) {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    req.user = user;
    return next();
  }

  function setSession(res, userId) {
    const token = createToken();
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(hash(token), userId, Date.now() + SESSION_MS);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }

  function clearSession(req, res) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/api/auth/register', authLimiter, (req, res) => {
    const name = cleanText(req.body?.name, 80);
    const email = cleanText(req.body?.email, 254).toLowerCase();
    const password = req.body?.password;
    if (name.length < 2 || !validEmail(email) || typeof password !== 'string' || password.length < 10 || password.length > 200) {
      return res.status(400).json({ error: 'Ingresa un nombre, correo válido y una contraseña de al menos 10 caracteres.' });
    }
    try {
      const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        .run(name, email, passwordHash(password));
      const user = db.prepare('SELECT id, name, email, currency FROM users WHERE id = ?').get(result.lastInsertRowid);
      setSession(res, user.id);
      return res.status(201).json({ user: safeUser(user) });
    } catch (error) {
      if (['ERR_SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_UNIQUE'].includes(error.code) || error.errcode === 2067) {
        return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
      }
      throw error;
    }
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const email = cleanText(req.body?.email, 254).toLowerCase();
    const password = req.body?.password;
    const user = db.prepare('SELECT id, name, email, currency, password_hash FROM users WHERE email = ?').get(email);
    if (!user || typeof password !== 'string' || !passwordMatches(password, user.password_hash)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').run(user.id, Date.now());
    setSession(res, user.id);
    return res.json({ user: safeUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSession(req, res);
    return res.json({ message: 'Sesión cerrada.' });
  });

  app.get('/api/auth/session', (req, res) => {
    const user = getSessionUser(req);
    return user ? res.json({ user: safeUser(user) }) : res.status(401).json({ error: 'Inicia sesión.' });
  });

  app.post('/api/auth/forgot', authLimiter, async (req, res, next) => {
    const email = cleanText(req.body?.email, 254).toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ error: 'Ingresa un correo válido.' });
    if (!mailer && env.NODE_ENV === 'production') {
      console.error('Recuperación de contraseña no disponible: configura SMTP_HOST, SMTP_USER y SMTP_PASSWORD.');
      return res.status(503).json({ error: 'La recuperación por correo no está configurada. Contacta al administrador.' });
    }
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) return res.json({ message: 'Si el correo está registrado, recibirás instrucciones para recuperar tu cuenta.' });

    db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
      .run(Date.now(), user.id);
    const token = createToken();
    const expiresAt = Date.now() + 30 * 60 * 1000;
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(hash(token), user.id, expiresAt);
    const resetUrl = new URL('/', env.APP_URL || `http://localhost:${env.PORT || 3000}`);
    resetUrl.searchParams.set('reset', token);

    try {
      if (mailer) {
        await mailer.sendMail({
          from: env.SMTP_FROM || env.SMTP_USER,
          to: user.email,
          subject: 'Recupera tu cuenta de Lyndon',
          text: `Usa este enlace en los próximos 30 minutos para cambiar tu contraseña: ${resetUrl.toString()}`,
        });
      } else if (env.NODE_ENV !== 'production') {
        console.info(`Enlace de recuperación de Lyndon: ${resetUrl.toString()}`);
      }
      return res.json({ message: 'Si el correo está registrado, recibirás instrucciones para recuperar tu cuenta.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/reset', authLimiter, (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const password = req.body?.password;
    if (!token || typeof password !== 'string' || password.length < 10 || password.length > 200) {
      return res.status(400).json({ error: 'El enlace o la contraseña no son válidos. Usa al menos 10 caracteres.' });
    }
    const reset = db.prepare(`
      SELECT user_id FROM password_resets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).get(hash(token), Date.now());
    if (!reset) return res.status(400).json({ error: 'El enlace expiró o ya fue utilizado. Solicita uno nuevo.' });

    inTransaction(db, () => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash(password), reset.user_id);
      db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(Date.now(), hash(token));
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
    });
    return res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  });

  app.get('/api/profile', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
  app.patch('/api/profile', requireAuth, (req, res) => {
    const name = cleanText(req.body?.name, 80);
    const currency = cleanText(req.body?.currency, 3).toUpperCase();
    if (name.length < 2 || !CURRENCIES.has(currency)) {
      return res.status(400).json({ error: 'Revisa tu nombre y selecciona una moneda válida.' });
    }
    db.prepare('UPDATE users SET name = ?, currency = ? WHERE id = ?').run(name, currency, req.user.id);
    const user = db.prepare('SELECT id, name, email, currency FROM users WHERE id = ?').get(req.user.id);
    return res.json({ user: safeUser(user) });
  });

  app.get('/api/items', requireAuth, (req, res) => {
    const type = cleanText(req.query.type, 20);
    const parameters = [req.user.id];
    let where = 'WHERE i.user_id = ?';
    if (type) {
      if (!ITEM_TYPES.has(type)) return res.status(400).json({ error: 'Tipo de elemento no válido.' });
      where += ' AND i.type = ?';
      parameters.push(type);
    }
    const items = db.prepare(`
      SELECT i.*,
        (SELECT MAX(ml.taken_at) FROM medication_logs ml WHERE ml.item_id = i.id AND ml.user_id = i.user_id) AS last_taken_at
      FROM items i ${where} ORDER BY i.completed ASC, i.due_at IS NULL, i.due_at ASC, i.created_at DESC LIMIT 300
    `).all(...parameters);
    return res.json({ items: items.map((item) => ({ ...item, completed: Boolean(item.completed) })) });
  });

  app.post('/api/items', requireAuth, (req, res) => {
    const input = req.body || {};
    const type = cleanText(input.type, 20);
    const title = cleanText(input.title, 120);
    const dueAt = dateOrNull(input.due_at);
    const priority = cleanText(input.priority, 12) || 'normal';
    if (!ITEM_TYPES.has(type) || title.length < 1 || dueAt === undefined || !PRIORITIES.has(priority)) {
      return res.status(400).json({ error: 'Revisa el tipo, título, fecha y prioridad.' });
    }
    const result = db.prepare(`
      INSERT INTO items (user_id, type, title, description, category, priority, due_at, frequency, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      type,
      title,
      cleanText(input.description, 1000),
      cleanText(input.category, 60),
      priority,
      dueAt,
      type === 'medication' ? cleanText(input.frequency, 30) : '',
      type === 'medication' ? cleanText(input.duration, 80) : '',
    );
    return res.status(201).json({ item: db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id) });
  });

  app.patch('/api/items/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'No se encontró el elemento.' });
    const input = req.body || {};
    const title = input.title === undefined ? current.title : cleanText(input.title, 120);
    const description = input.description === undefined ? current.description : cleanText(input.description, 1000);
    const category = input.category === undefined ? current.category : cleanText(input.category, 60);
    const priority = input.priority === undefined ? current.priority : cleanText(input.priority, 12);
    const dueAt = input.due_at === undefined ? current.due_at : dateOrNull(input.due_at);
    const frequency = input.frequency === undefined ? current.frequency : cleanText(input.frequency, 30);
    const duration = input.duration === undefined ? current.duration : cleanText(input.duration, 80);
    const completed = input.completed === undefined ? current.completed : input.completed === true ? 1 : input.completed === false ? 0 : -1;
    if (!title || dueAt === undefined || !PRIORITIES.has(priority) || ![0, 1].includes(completed)) {
      return res.status(400).json({ error: 'Revisa los datos del elemento.' });
    }
    db.prepare(`
      UPDATE items SET title = ?, description = ?, category = ?, priority = ?, due_at = ?,
        frequency = ?, duration = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(title, description, category, priority, dueAt, frequency, duration, completed, id, req.user.id);
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, req.user.id);
    return res.json({ item: { ...item, completed: Boolean(item.completed) } });
  });

  app.delete('/api/items/:id', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    return result.changes ? res.json({ message: 'Elemento eliminado.' }) : res.status(404).json({ error: 'No se encontró el elemento.' });
  });

  app.post('/api/items/:id/take', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const item = db.prepare("SELECT * FROM items WHERE id = ? AND user_id = ? AND type = 'medication'").get(id, req.user.id);
    if (!item) return res.status(404).json({ error: 'No se encontró el medicamento.' });
    const takenAt = new Date().toISOString();
    const intervals = { '8_hours': 8 * 60 * 60 * 1000, '12_hours': 12 * 60 * 60 * 1000, daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 };
    const interval = intervals[item.frequency];
    let nextDue = item.due_at;
    if (interval && item.due_at) {
      nextDue = new Date(item.due_at).getTime() + interval;
      while (nextDue <= Date.now()) nextDue += interval;
      nextDue = new Date(nextDue).toISOString();
    }
    inTransaction(db, () => {
      db.prepare('INSERT INTO medication_logs (user_id, item_id, taken_at) VALUES (?, ?, ?)')
        .run(req.user.id, id, takenAt);
      if (interval) {
        db.prepare('UPDATE items SET due_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
          .run(nextDue, id, req.user.id);
      }
    });
    return res.status(201).json({ message: 'Toma registrada.', taken_at: takenAt, next_due_at: interval ? nextDue : null });
  });

  app.get('/api/medications/:id/logs', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const medication = db.prepare("SELECT id FROM items WHERE id = ? AND user_id = ? AND type = 'medication'").get(id, req.user.id);
    if (!medication) return res.status(404).json({ error: 'No se encontró el medicamento.' });
    const logs = db.prepare('SELECT id, taken_at FROM medication_logs WHERE item_id = ? AND user_id = ? ORDER BY taken_at DESC LIMIT 50')
      .all(id, req.user.id);
    return res.json({ logs });
  });

  app.get('/api/transactions', requireAuth, (req, res) => {
    const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY occurred_at DESC, id DESC LIMIT 500')
      .all(req.user.id);
    return res.json({ transactions });
  });

  app.post('/api/transactions', requireAuth, (req, res) => {
    const input = req.body || {};
    const kind = cleanText(input.kind, 10);
    const amount = Number(input.amount);
    const category = cleanText(input.category, 60);
    const occurredAt = dateOrNull(input.occurred_at);
    if (!['income', 'expense'].includes(kind) || !Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !category || occurredAt === undefined || !occurredAt) {
      return res.status(400).json({ error: 'Ingresa tipo, valor positivo, categoría y fecha válidos.' });
    }
    const result = db.prepare('INSERT INTO transactions (user_id, kind, amount, category, description, occurred_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, kind, amount, category, cleanText(input.description, 240), occurredAt);
    return res.status(201).json({ transaction: db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id) });
  });

  app.patch('/api/transactions/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!current) return res.status(404).json({ error: 'No se encontró el movimiento.' });
    const input = req.body || {};
    const kind = input.kind === undefined ? current.kind : cleanText(input.kind, 10);
    const amount = input.amount === undefined ? current.amount : Number(input.amount);
    const category = input.category === undefined ? current.category : cleanText(input.category, 60);
    const occurredAt = input.occurred_at === undefined ? current.occurred_at : dateOrNull(input.occurred_at);
    const description = input.description === undefined ? current.description : cleanText(input.description, 240);
    if (!['income', 'expense'].includes(kind) || !Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !category || occurredAt === undefined || !occurredAt) {
      return res.status(400).json({ error: 'Revisa los datos del movimiento.' });
    }
    db.prepare('UPDATE transactions SET kind = ?, amount = ?, category = ?, description = ?, occurred_at = ? WHERE id = ? AND user_id = ?')
      .run(kind, amount, category, description, occurredAt, id, req.user.id);
    return res.json({ transaction: db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user.id) });
  });

  app.delete('/api/transactions/:id', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    return result.changes ? res.json({ message: 'Movimiento eliminado.' }) : res.status(404).json({ error: 'No se encontró el movimiento.' });
  });

  app.get('/api/budgets', requireAuth, (req, res) => {
    const month = cleanText(req.query.month, 7);
    if (month && !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Mes no válido.' });
    const budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ? AND month = ? ORDER BY category')
      .all(req.user.id, month || new Date().toISOString().slice(0, 7));
    return res.json({ budgets });
  });

  app.post('/api/budgets', requireAuth, (req, res) => {
    const input = req.body || {};
    const category = cleanText(input.category, 60);
    const amount = Number(input.amount);
    const month = cleanText(input.month, 7);
    if (!category || !Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Ingresa categoría, monto y mes válidos.' });
    }
    db.prepare(`
      INSERT INTO budgets (user_id, category, amount, month) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, category, month) DO UPDATE SET amount = excluded.amount
    `).run(req.user.id, category, amount, month);
    const budget = db.prepare('SELECT * FROM budgets WHERE user_id = ? AND category = ? AND month = ?').get(req.user.id, category, month);
    return res.status(201).json({ budget });
  });

  app.delete('/api/budgets/:id', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    return result.changes ? res.json({ message: 'Presupuesto eliminado.' }) : res.status(404).json({ error: 'No se encontró el presupuesto.' });
  });

  app.post('/api/assistant', requireAuth, (req, res) => {
    const question = cleanText(req.body?.message, 400).toLowerCase();
    if (!question) return res.status(400).json({ error: 'Escribe qué necesitas organizar.' });
    const pending = db.prepare("SELECT COUNT(*) AS count FROM items WHERE user_id = ? AND type = 'task' AND completed = 0").get(req.user.id).count;
    const dueSoon = db.prepare(`
      SELECT title, type, due_at FROM items
      WHERE user_id = ? AND completed = 0 AND due_at BETWEEN ? AND ?
      ORDER BY due_at LIMIT 5
    `).all(req.user.id, new Date().toISOString(), new Date(Date.now() + 7 * 86400000).toISOString());
    const month = new Date().toISOString().slice(0, 7);
    const finance = db.prepare(`
      SELECT kind, COALESCE(SUM(amount), 0) AS total FROM transactions
      WHERE user_id = ? AND substr(occurred_at, 1, 7) = ? GROUP BY kind
    `).all(req.user.id, month);
    const totals = Object.fromEntries(finance.map((row) => [row.kind, row.total]));
    let reply = `Tienes ${pending} ${pending === 1 ? 'tarea pendiente' : 'tareas pendientes'}.`;
    if (dueSoon.length) {
      reply += ` En los próximos 7 días: ${dueSoon.map((item) => `${item.title} (${new Date(item.due_at).toLocaleDateString('es-CO')})`).join(', ')}.`;
    } else {
      reply += ' No hay actividades próximas registradas para esta semana.';
    }
    if (/gasto|presupuesto|dinero|finanza/.test(question)) {
      reply += ` Este mes registraste ${req.user.currency} ${Number(totals.expense || 0).toLocaleString('es-CO')} en gastos y ${req.user.currency} ${Number(totals.income || 0).toLocaleString('es-CO')} en ingresos.`;
    }
    reply += ' Esta orientación se genera con tus registros y no reemplaza asesoría financiera o médica.';
    return res.json({ reply });
  });

  app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
  }));
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, _req, res, _next) => {
    console.error('Error de aplicación:', error);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Ocurrió un error inesperado. Inténtalo de nuevo.' });
  });

  app.locals.db = db;
  return app;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const key = part.slice(0, index).trim();
    try {
      return [key, decodeURIComponent(part.slice(index + 1).trim())];
    } catch {
      return [key, ''];
    }
  }).filter(([key]) => key));
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.info(`Lyndon disponible en http://localhost:${port}`);
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
      console.error('Configura SESSION_SECRET antes de publicar la aplicación.');
    }
  });
}

module.exports = { createApp };
