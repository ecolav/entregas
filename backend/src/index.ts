import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import webpush from 'web-push';

const app = express();
const FALLBACK_DB_URL = 'mysql://root:@localhost:3306/main';
const effectiveDbUrl = (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')) ? process.env.DATABASE_URL : FALLBACK_DB_URL;
const prisma = new PrismaClient({ datasources: { db: { url: effectiveDbUrl } } });

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ensure uploads dir exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});
// Aumentar limite de upload para 10MB para fotos de recebimento/expedição
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:ti@textilecolav.com.br';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); } catch {}
}

// Definir ordem sequencial das etapas dos ROLs Especiais
const SPECIAL_ROLL_FLOW_ORDER = [
  'received',        // 1. Recebido
  'washing',         // 2. Lavagem  
  'drying',          // 3. Secagem
  'quality_check',   // 4. Controle de Qualidade
  'ready',           // 5. Pronto
  'dispatched'       // 6. Expedido
];

// Função para validar se uma transição de status é permitida
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  // Status especiais que podem ser acessados a qualquer momento
  const specialStatuses = ['cancelled', 'returned'];
  if (specialStatuses.includes(newStatus)) {
    return true;
  }
  
  const currentIndex = SPECIAL_ROLL_FLOW_ORDER.indexOf(currentStatus);
  const newIndex = SPECIAL_ROLL_FLOW_ORDER.indexOf(newStatus);
  
  // Se não encontrar os status na ordem, não permitir
  if (currentIndex === -1 || newIndex === -1) {
    return false;
  }
  
  // Só permitir ir para a próxima etapa ou voltar para a anterior
  return newIndex === currentIndex + 1 || newIndex === currentIndex - 1;
}

// Função para obter os próximos status válidos
function getValidNextStatuses(currentStatus: string): string[] {
  const validStatuses = ['cancelled', 'returned']; // Status especiais sempre permitidos
  
  const currentIndex = SPECIAL_ROLL_FLOW_ORDER.indexOf(currentStatus);
  if (currentIndex === -1) return validStatuses;
  
  // Adicionar próxima etapa se existir
  if (currentIndex + 1 < SPECIAL_ROLL_FLOW_ORDER.length) {
    validStatuses.push(SPECIAL_ROLL_FLOW_ORDER[currentIndex + 1]);
  }
  
  // Adicionar etapa anterior se existir
  if (currentIndex - 1 >= 0) {
    validStatuses.push(SPECIAL_ROLL_FLOW_ORDER[currentIndex - 1]);
  }
  
  return validStatuses;
}

// Auth middleware
function requireAuth(roles?: Array<'admin' | 'manager'>) {
  return async (req: express.Request & { user?: any }, res: express.Response, next: express.NextFunction) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: 'admin' | 'manager'; clientId?: string };
      req.user = payload;
      if (roles && roles.length > 0 && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
// Auth verification endpoint
app.get('/auth/me', requireAuth(), async (req: any, res, next) => {
  try {
    // Return user info from JWT payload (including name)
    res.json({
      id: req.user.sub,
      name: req.user.name || req.user.email?.split('@')[0] || 'Usuário',
      email: req.user.email,
      role: req.user.role,
      clientId: req.user.clientId
    });
  } catch (e) { next(e); }
});

// Uploads (authenticated)
app.post('/uploads', requireAuth(), upload.single('file'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(201).json({ url });
});

// Public uploads (for QR flow)
app.post('/public/uploads', upload.single('file'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(201).json({ url });
});

// ==============================
// Web Push (Service Worker subscriptions)
// ==============================
const subscriptionsPath = path.join(process.cwd(), 'public', 'push_subscriptions.json');
function readSubscriptions(): Array<webpush.PushSubscription> {
  try {
    const raw = fs.readFileSync(subscriptionsPath, 'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}
function writeSubscriptions(list: Array<webpush.PushSubscription>) {
  try {
    fs.mkdirSync(path.dirname(subscriptionsPath), { recursive: true });
    fs.writeFileSync(subscriptionsPath, JSON.stringify(list, null, 2));
  } catch {}
}

// Lightweight audit store for distributed items (avoid DB migration)
const distributionAuditPath = path.join(process.cwd(), 'public', 'distributed_audit.json');
type DistributionAudit = Record<string, { name?: string; email?: string; at?: string }>;
function readDistributionAudit(): DistributionAudit {
  try {
    const raw = fs.readFileSync(distributionAuditPath, 'utf-8');
    return JSON.parse(raw);
  } catch { return {}; }
}
function writeDistributionAudit(map: DistributionAudit) {
  try {
    fs.mkdirSync(path.dirname(distributionAuditPath), { recursive: true });
    fs.writeFileSync(distributionAuditPath, JSON.stringify(map, null, 2));
  } catch {}
}

app.get('/push/public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/push/subscribe', express.json(), (req, res) => {
  const sub = req.body as webpush.PushSubscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'InvalidSubscription' });
  const list = readSubscriptions();
  if (!list.find(s => s.endpoint === sub.endpoint)) {
    list.push(sub);
    writeSubscriptions(list);
  }
  res.status(201).json({ ok: true });
});

app.post('/push/unsubscribe', express.json(), (req, res) => {
  const sub = req.body as webpush.PushSubscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'InvalidSubscription' });
  const list = readSubscriptions().filter(s => s.endpoint !== sub.endpoint);
  writeSubscriptions(list);
  res.status(204).end();
});

app.post('/push/test', requireAuth(['admin']), async (req, res) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(503).json({ error: 'VapidNotConfigured' });
  const list = readSubscriptions();
  const payload = JSON.stringify({ title: 'ECOLAV', body: 'Teste de notificação', url: '/' });
  const results = await Promise.allSettled(list.map(s => webpush.sendNotification(s, payload)));
  res.json({ sent: results.filter(r => r.status === 'fulfilled').length, total: list.length });
});

// Public app base URL (used by QR generation on clients)
app.get('/public/app-base', async (req, res) => {
  const explicit = process.env.APP_BASE_URL;
  if (explicit && explicit.trim().length > 0) {
    return res.json({ appBaseUrl: explicit.trim() });
  }
  const host = req.get('host') || '';
  const hasSpa = fs.existsSync(path.join(process.cwd(), 'public', 'index.html'));
  if (process.env.SERVE_SPA === 'true' && hasSpa) {
    return res.json({ appBaseUrl: `${req.protocol}://${host}` });
  }
  const hostnameOnly = host.includes(':') ? host.split(':')[0] : host;
  const guess = `${req.protocol}://${hostnameOnly}:5173`;
  return res.json({ appBaseUrl: guess });
});

// Public endpoints for QR-based flow (no auth)
app.get('/public/beds/:token', async (req, res, next) => {
  try {
    const bed = await prisma.bed.findUnique({ where: { token: req.params.token }, include: { sector: { include: { client: true } } } as any });
    if (!bed) return res.status(404).json({ error: 'NotFound' });
    res.json(bed);
  } catch (e: any) {
    if (e?.code === 'BAD_REQUEST_EXPECTED_RETURN') return res.status(400).json({ error: 'ExpectedReturnAtRequired', message: 'Data prevista é obrigatória no recebimento.' });
    if (e?.code === 'BAD_REQUEST_DISPATCH_REQUIRED') return res.status(400).json({ error: 'DispatchFieldsRequired', message: 'Peso final e responsável pela expedição são obrigatórios.' });
    next(e);
  }
});

app.post('/public/orders', async (req, res, next) => {
  try {
    const parsed = z.object({
      token: z.string().min(1),
      items: z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
      observations: z.string().optional().nullable(),
      scheduledDelivery: z.string().optional().nullable(),
    }).parse(req.body);

    const bed = await prisma.bed.findFirst({ where: { token: parsed.token }, include: { sector: true } });
    if (!bed) return res.status(400).json({ error: 'InvalidBedToken' });

    const created = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({ data: { bedId: bed.id, status: 'pending', observations: parsed.observations ?? null, scheduledDelivery: parseMaybeDate(parsed.scheduledDelivery) } });
      for (const it of parsed.items) {
        await tx.orderItem.create({ data: { orderId: createdOrder.id, itemId: it.itemId, quantity: it.quantity } });
        const item = await tx.linenItem.findUnique({ where: { id: it.itemId } });
        if (item) {
          const newStock = Math.max(0, item.currentStock - it.quantity);
          await tx.linenItem.update({ where: { id: item.id }, data: { currentStock: newStock } });
          await tx.stockMovement.create({ data: { itemId: item.id, type: 'out', quantity: it.quantity, reason: `Pedido ${createdOrder.id}` } });
        }
      }
      return createdOrder;
    });
    const full = await prisma.order.findUnique({ where: { id: created.id }, include: { items: true, bed: true } });
    res.status(201).json(full);
  } catch (e) { next(e); }
});

// Get latest pending order for a bed token (public)
app.get('/public/orders', async (req, res, next) => {
  try {
    const token = String(req.query.token || '').trim();
    if (token.length === 0) return res.status(400).json({ error: 'MissingToken' });
    const bed = await prisma.bed.findFirst({ where: { token }, select: { id: true } });
    if (!bed) return res.status(404).json({ error: 'NotFound' });
    const order = await prisma.order.findFirst({
      where: { bedId: bed.id, NOT: { status: { in: ['delivered','cancelled'] } } },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { item: true } }, bed: true }
    });
    if (!order) return res.status(404).json({ error: 'NotFound' });
    res.json(order);
  } catch (e) { next(e); }
});

app.put('/public/beds/:token/status', async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['free','occupied']) }).parse(req.body);
    const existing = await prisma.bed.findFirst({ where: { token: req.params.token } });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    const updated = await prisma.bed.update({ where: { id: existing.id }, data: { status: parsed.status } });
    res.json(updated);
  } catch (e) { next(e); }
});

// Confirm delivery (public) guarded by bed token
app.put('/public/orders/:id/confirm-delivery', async (req, res, next) => {
  try {
    const parsed = z.object({
      token: z.string().min(1),
      receiverName: z.string().min(1),
      confirmationType: z.enum(['signature','photo']),
      confirmationUrl: z.string().url(),
      deliveredByUserId: z.string().optional().nullable(),
    }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { bed: true } });
    if (!order) return res.status(404).json({ error: 'NotFound' });
    const bed = await prisma.bed.findFirst({ where: { token: parsed.token } });
    if (!bed || bed.id !== order.bedId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        deliveredByUserId: parsed.deliveredByUserId || null,
        receiverName: parsed.receiverName,
        confirmationType: parsed.confirmationType,
        confirmationUrl: parsed.confirmationUrl,
      }
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// Public items listing for QR flow (no auth)
app.get('/public/items', async (req, res, next) => {
  try {
    const clientId = (req.query.clientId ? String(req.query.clientId) : '').trim();
    let where: any = { OR: [{ clientId: null }] };
    if (clientId.length > 0) {
      where = { OR: [{ clientId: null }, { clientId }] };
    }
    const data = await prisma.linenItem.findMany({ where } as any);
    res.json(data);
  } catch (e) { next(e); }
});

// Auth (login)
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
app.post('/auth/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await prisma.systemUser.findUnique({ where: { email: parsed.email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ 
      sub: user.id, 
      name: user.name,
      email: user.email,
      role: user.role, 
      clientId: user.clientId ?? undefined 
    }, JWT_SECRET, { expiresIn: '12h' });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.clientId ?? undefined,
      token
    });
  } catch (e) { next(e); }
});

// Bootstrap first admin if no users exist
const bootstrapSchema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(6) });
app.post('/auth/bootstrap-admin', async (req, res, next) => {
  try {
    const count = await prisma.systemUser.count();
    if (count > 0) return res.status(400).json({ error: 'Users already exist' });
    const parsed = bootstrapSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const created = await prisma.systemUser.create({ data: { name: parsed.name, email: parsed.email, role: 'admin', passwordHash } });
    res.status(201).json({ id: created.id, name: created.name, email: created.email, role: created.role });
  } catch (e) { next(e); }
});

// Clients
const clientSchema = z.object({
  name: z.string().min(1),
  document: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  whatsappNumber: z.string().regex(/^\d+$/).optional().nullable(),
});

app.get('/clients', requireAuth(['admin']), async (_req, res, next) => {
  try {
    const data = await prisma.client.findMany();
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/clients', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = clientSchema.parse(req.body);
    const created = await prisma.client.create({ data: parsed });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/clients/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = clientSchema.partial().parse(req.body);
    const updated = await prisma.client.update({ where: { id: req.params.id }, data: parsed });
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/clients/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// System Users
const systemUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin','manager']),
  clientId: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
});

app.get('/users', requireAuth(['admin']), async (_req, res, next) => {
  try {
    const data = await prisma.systemUser.findMany({ select: { id: true, name: true, email: true, role: true, clientId: true, createdAt: true } });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/users', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = systemUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password || crypto.randomUUID(), 10);
    const created = await prisma.systemUser.create({ data: { name: parsed.name, email: parsed.email, role: parsed.role, clientId: parsed.clientId || null, passwordHash } });
    res.status(201).json({ id: created.id, name: created.name, email: created.email, role: created.role, clientId: created.clientId ?? undefined, createdAt: created.createdAt });
  } catch (e) { next(e); }
});

app.put('/users/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = systemUserSchema.partial().parse(req.body);
    const data: any = { name: parsed.name, email: parsed.email, role: parsed.role, clientId: parsed.clientId ?? undefined };
    if (parsed.password) data.passwordHash = await bcrypt.hash(parsed.password, 10);
    const updated = await prisma.systemUser.update({ where: { id: req.params.id }, data });
    res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, clientId: updated.clientId ?? undefined, createdAt: updated.createdAt });
  } catch (e) { next(e); }
});

app.delete('/users/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    await prisma.systemUser.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ==============================
// Weighing: Cages (Gaiolas)
// ==============================
const cageSchema = z.object({
  codigo_barras: z.string().min(1),
  peso_tara: z.number().nonnegative()
});

app.get('/gaiolas', requireAuth(['admin','manager']), async (_req, res, next) => {
  try {
    const data = await prisma.cage.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/gaiolas', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const parsed = cageSchema.parse(req.body);
    const created = await prisma.cage.create({ data: { barcode: parsed.codigo_barras, tareWeight: String(parsed.peso_tara) } as any });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'DuplicateBarcode' });
    }
    next(e);
  }
});

app.put('/gaiolas/:id', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const parsed = cageSchema.partial().parse(req.body);
    const data: any = {};
    if (parsed.codigo_barras !== undefined) data.barcode = parsed.codigo_barras;
    if (parsed.peso_tara !== undefined) data.tareWeight = String(parsed.peso_tara);
    const updated = await prisma.cage.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'DuplicateBarcode' });
    }
    next(e);
  }
});

app.delete('/gaiolas/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    await prisma.cage.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ==============================
// Weighing: Control and Entries
// ==============================
const controlCreateSchema = z.object({
  peso_bruto_lavanderia: z.number().nonnegative().optional(),
  tipo: z.enum(['suja','limpa']).default('limpa').optional(),
  data: z.string().optional(), // YYYY-MM-DD
  prevista: z.string().optional(), // YYYY-MM-DD (apenas para suja)
  clientId: z.string().optional()
});

app.post('/controles', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const parsed = controlCreateSchema.parse(req.body);
    const tipo = parsed.tipo ?? 'limpa';
    let gross = parsed.peso_bruto_lavanderia;
    if (tipo === 'limpa') {
      if (gross === undefined || Number(gross) <= 0) return res.status(400).json({ error: 'Missing gross weight for clean control' });
    } else {
      gross = 0; // será apurado pelas entradas
    }

    const isAdmin = (req as any).user?.role === 'admin';
    const clientIdForControl = isAdmin && parsed.clientId ? parsed.clientId : ((req as any).user?.clientId ?? null);

    // Get today's date in Brazil timezone (UTC-3)
    // Pega a data/hora atual no Brasil (UTC-3)
    const now = new Date();
    const todayBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayLocal = `${todayBrazil.getFullYear()}-${String(todayBrazil.getMonth() + 1).padStart(2, '0')}-${String(todayBrazil.getDate()).padStart(2, '0')}`;
    const startToday = new Date(`${todayLocal}T03:00:00.000Z`); // 00:00 BRT = 03:00 UTC

    // FECHAR automaticamente controles abertos de dias anteriores (meia-noite)
    await prisma.weighingControl.updateMany({
      where: {
        clientId: clientIdForControl,
        kind: tipo,
        status: 'open',
        referenceDate: { lt: startToday } // Antes de hoje
      },
      data: {
        status: 'closed'
      }
    } as any);
    
    const created = await prisma.weighingControl.create({
      data: {
        laundryGrossWeight: String(gross ?? 0),
        clientTotalNetWeight: '0',
        differenceWeight: '0',
        differencePercent: '0',
        kind: tipo,
        clientId: clientIdForControl,
        referenceDate: parsed.data && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data) ? new Date(`${parsed.data}T03:00:00Z`) : new Date(`${todayLocal}T03:00:00Z`),
        expectedDeliveryDate: (tipo === 'suja' && parsed.prevista && /^\d{4}-\d{2}-\d{2}$/.test(parsed.prevista)) ? new Date(`${parsed.prevista}T03:00:00Z`) : null
      } as any
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

async function recalcControl(controlId: string) {
  const control = await prisma.weighingControl.findUnique({ where: { id: controlId } });
  if (!control) return null;
  const agg = await prisma.weighingEntry.aggregate({ _sum: { netWeight: true }, where: { controlId } });
  const totalNet = Number(agg._sum.netWeight || 0);
  const gross = Number(control.laundryGrossWeight as any);
  const diff = Number((gross - totalNet).toFixed(2));
  const percent = gross > 0 ? Number(((Math.abs(diff) / gross) * 100).toFixed(2)) : 0;
  const updated = await prisma.weighingControl.update({
    where: { id: controlId },
    data: {
      clientTotalNetWeight: String(totalNet),
      differenceWeight: String(diff),
      differencePercent: String(percent)
    } as any
  });
  return updated;
}

app.get('/controles/:id', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const data = await prisma.weighingControl.findUnique({
      where: { id: req.params.id },
      include: { entries: { include: { cage: true }, orderBy: { createdAt: 'desc' } } }
    } as any);
    if (!data) return res.status(404).json({ error: 'NotFound' });
    res.json(data);
  } catch (e) { next(e); }
});

const weighingEntrySchema = z.object({
  control_id: z.string().min(1),
  cage_id: z.string().min(1).optional(),
  peso_tara: z.number().nonnegative().optional(),
  peso_total: z.number().nonnegative()
});

app.post('/pesagens', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const parsed = weighingEntrySchema.parse(req.body);
    const control = await prisma.weighingControl.findUnique({ where: { id: parsed.control_id } });
    if (!control) return res.status(400).json({ error: 'Invalid control_id' });
    
    // Validar se o controle está aberto
    if ((control as any).status !== 'open') {
      return res.status(400).json({ error: 'Control is closed' });
    }
    
    // Validar permissão do manager
    if ((req as any).user?.role === 'manager' && (req as any).user?.clientId) {
      if ((control as any).clientId !== (req as any).user.clientId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    let tare = 0;
    let cageId: string | null = null;
    if (parsed.cage_id) {
      const cage = await prisma.cage.findUnique({ where: { id: parsed.cage_id } });
      if (!cage) return res.status(400).json({ error: 'Invalid cage_id' });
      cageId = cage.id;
      tare = Number(cage.tareWeight as any);
    } else if (parsed.peso_tara !== undefined) {
      tare = parsed.peso_tara;
    } else {
      return res.status(400).json({ error: 'Provide cage_id or peso_tara' });
    }

    const total = parsed.peso_total;
    const net = Math.max(0, Number((total - tare).toFixed(2)));
    
    // Usar transaction para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.weighingEntry.create({
        data: {
          controlId: parsed.control_id,
          cageId,
          tareWeight: String(tare),
          totalWeight: String(total),
          netWeight: String(net)
        } as any
      });
      
      // Recalcular peso inline
      const agg = await tx.weighingEntry.aggregate({
        _sum: { netWeight: true },
        where: { controlId: parsed.control_id }
      });
      const totalNet = Number(agg._sum.netWeight || 0);
      const gross = Number((control as any).laundryGrossWeight);
      const diff = Number((gross - totalNet).toFixed(2));
      const percent = gross > 0 ? Number(((Math.abs(diff) / gross) * 100).toFixed(2)) : 0;
      
      const updatedControl = await tx.weighingControl.update({
        where: { id: parsed.control_id },
        data: {
          clientTotalNetWeight: String(totalNet),
          differenceWeight: String(diff),
          differencePercent: String(percent)
        } as any
      });
      
      return { created, updatedControl };
    });

    const full = await prisma.weighingControl.findUnique({
      where: { id: parsed.control_id },
      include: { entries: { include: { cage: true }, orderBy: { createdAt: 'desc' } } }
    } as any);
    res.status(201).json({ entry: result.created, control: result.updatedControl, full });
  } catch (e) { next(e); }
});

// Finalize a control
app.put('/controles/:id/finalizar', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const existing = await prisma.weighingControl.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    // recalc before closing
    await recalcControl(existing.id);
    const updated = await prisma.weighingControl.update({ where: { id: existing.id }, data: { status: 'closed', closedAt: new Date() } as any });
    res.json(updated);
  } catch (e) { next(e); }
});

// Daily report: aggregates per day and kind (suja/limpa)
app.get('/pesagens/relatorio', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const start = String(req.query.start || '').trim();
    const end = String(req.query.end || '').trim();
    const where: any = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) where.createdAt = Object.assign(where.createdAt || {}, { gte: new Date(`${start}T00:00:00-03:00`) });
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) where.createdAt = Object.assign(where.createdAt || {}, { lte: new Date(`${end}T23:59:59-03:00`) });

    // Role-aware filter by client
    if ((req as any).user?.role === 'manager' && (req as any).user?.clientId) {
      (where as any).clientId = (req as any).user.clientId;
    } else if (req.query.clientId) {
      (where as any).clientId = String(req.query.clientId);
    }
    const controls = await prisma.weighingControl.findMany({ where, select: { id: true, referenceDate: true, expectedDeliveryDate: true, kind: true, clientTotalNetWeight: true, laundryGrossWeight: true } });
    // Aggregate by day:
    // - Clean laundry: use referenceDate (day it was received/weighed)
    // - Dirty laundry weighed today: use referenceDate (new field for reporting)
    // - Dirty laundry for comparison: use expectedDeliveryDate (day it's expected to return clean)
    const map = new Map<string, { date: string; suja: number; limpa: number; bruto_lavanderia: number; pesado_liquido: number; suja_pesada_hoje: number }>();
    for (const c of controls) {
      const totalNet = Number(c.clientTotalNetWeight as any) || 0;
      const grossLaundry = Number(c.laundryGrossWeight as any) || 0;
      
      if (c.kind === 'suja') {
        // Dirty weighed today: use reference date (when it was weighed)
        const refDate = new Date(c.referenceDate as any).toISOString().split('T')[0];
        if (!map.has(refDate)) map.set(refDate, { date: refDate, suja: 0, limpa: 0, bruto_lavanderia: 0, pesado_liquido: 0, suja_pesada_hoje: 0 });
        map.get(refDate)!.suja_pesada_hoje += totalNet;
        
        // Dirty for comparison: use expected delivery date (when it will come back clean)
        const expectedDate = (c.expectedDeliveryDate ?? c.referenceDate) as any;
        const date = new Date(expectedDate).toISOString().split('T')[0];
        if (!map.has(date)) map.set(date, { date, suja: 0, limpa: 0, bruto_lavanderia: 0, pesado_liquido: 0, suja_pesada_hoje: 0 });
        map.get(date)!.suja += totalNet;
      } else {
        // Clean: use reference date (day it was received/weighed)
        const date = new Date(c.referenceDate as any).toISOString().split('T')[0];
        if (!map.has(date)) map.set(date, { date, suja: 0, limpa: 0, bruto_lavanderia: 0, pesado_liquido: 0, suja_pesada_hoje: 0 });
        map.get(date)!.limpa += totalNet;
        // For clean laundry, add comparison with laundry gross weight
        map.get(date)!.bruto_lavanderia += grossLaundry;
        map.get(date)!.pesado_liquido += totalNet;
      }
    }
    const result = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(r => {
      const suja = r.suja;
      const limpa = r.limpa;
      const diff = suja - limpa;
      const perc = limpa > 0 ? Number(((diff / limpa) * 100).toFixed(2)) : 0;
      // Laundry comparison (gross vs weighed)
      const bruto = r.bruto_lavanderia;
      const pesado = r.pesado_liquido;
      const diffLav = bruto - pesado;
      const percLav = bruto > 0 ? Number(((Math.abs(diffLav) / bruto) * 100).toFixed(2)) : 0;
      return { 
        date: r.date, 
        peso_suja: Number(suja.toFixed(2)), 
        peso_limpa: Number(limpa.toFixed(2)), 
        diferenca: Number(diff.toFixed(2)), 
        sujidade_percentual: perc,
        peso_bruto_lavanderia: Number(bruto.toFixed(2)),
        peso_pesado_liquido: Number(pesado.toFixed(2)),
        diferenca_lavanderia: Number(diffLav.toFixed(2)),
        percentual_diferenca_lavanderia: percLav,
        peso_suja_pesada_hoje: Number(r.suja_pesada_hoje.toFixed(2))
      };
    });
    res.json(result);
  } catch (e) { next(e); }
});


// ==============================
// Totem helper endpoints
// ==============================
const openControlSchema = z.object({
  tipo: z.enum(['limpa','suja']),
  clientId: z.string().optional()
});

app.post('/totem/controls/open', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = openControlSchema.parse(req.body);
    const isAdmin = req.user.role === 'admin';
    const clientIdForControl = isAdmin && parsed.clientId ? parsed.clientId : (req.user.clientId ?? null);
    if (!clientIdForControl) return res.status(400).json({ error: 'Missing clientId' });

    // Dia atual em horário de Brasília (UTC-3)
    const now = new Date();
    const todayBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayLocal = `${todayBrazil.getFullYear()}-${String(todayBrazil.getMonth() + 1).padStart(2, '0')}-${String(todayBrazil.getDate()).padStart(2, '0')}`;
    const startToday = new Date(`${todayLocal}T03:00:00.000Z`); // 00:00 BRT = 03:00 UTC
    const endToday = new Date(`${todayLocal}T02:59:59.999Z`);
    endToday.setDate(endToday.getDate() + 1); // 23:59 BRT do mesmo dia

    // FECHAR automaticamente controles abertos de dias anteriores (meia-noite)
    await prisma.weighingControl.updateMany({
      where: {
        clientId: clientIdForControl,
        kind: parsed.tipo,
        status: 'open',
        referenceDate: { lt: startToday } // Antes de hoje
      },
      data: {
        status: 'closed'
      }
    } as any);

    // Se já existir controle aberto hoje para o cliente/tipo, retornar
    const existingOpen = await prisma.weighingControl.findFirst({
      where: {
        clientId: clientIdForControl,
        kind: parsed.tipo,
        status: 'open',
        referenceDate: { gte: startToday, lte: endToday }
      }
    } as any);
    if (existingOpen) return res.json(existingOpen);

    // Calcular peso bruto para 'limpa' com base no peso_limpa de ontem; 'suja' = 0
    let gross = 0;
    if (parsed.tipo === 'limpa') {
      // Ontem em horário de Brasília
      const yesterdayBrazil = new Date(todayBrazil);
      yesterdayBrazil.setDate(yesterdayBrazil.getDate() - 1);
      const yesterdayLocal = `${yesterdayBrazil.getFullYear()}-${String(yesterdayBrazil.getMonth() + 1).padStart(2, '0')}-${String(yesterdayBrazil.getDate()).padStart(2, '0')}`;
      const startY = new Date(`${yesterdayLocal}T03:00:00.000Z`);
      const endY = new Date(`${yesterdayLocal}T02:59:59.999Z`);
      endY.setDate(endY.getDate() + 1);
      const controlsYesterday = await prisma.weighingControl.findMany({
        where: { clientId: clientIdForControl, kind: 'limpa', referenceDate: { gte: startY, lte: endY } },
        select: { clientTotalNetWeight: true }
      } as any);
      const sum = controlsYesterday.reduce((acc, c) => acc + (Number((c as any).clientTotalNetWeight) || 0), 0);
      gross = Number(sum.toFixed(2));
    }

    // Calculate tomorrow in Brazil timezone for dirty laundry expected delivery
    const tomorrowBrazil = new Date(todayBrazil);
    tomorrowBrazil.setDate(tomorrowBrazil.getDate() + 1);
    const tomorrowLocal = `${tomorrowBrazil.getFullYear()}-${String(tomorrowBrazil.getMonth() + 1).padStart(2, '0')}-${String(tomorrowBrazil.getDate()).padStart(2, '0')}`;
    
    const created = await prisma.weighingControl.create({
      data: {
        laundryGrossWeight: String(gross),
        clientTotalNetWeight: '0',
        differenceWeight: '0',
        differencePercent: '0',
        kind: parsed.tipo,
        clientId: clientIdForControl,
        referenceDate: startToday,
        expectedDeliveryDate: parsed.tipo === 'suja' ? new Date(`${tomorrowLocal}T03:00:00.000Z`) : null
      } as any
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

const totemDistributeSchema = z.object({
  linenItemId: z.string().min(1),
  bedId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().optional().nullable()
});

app.post('/totem/distribute', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = totemDistributeSchema.parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: parsed.bedId }, include: { sector: true } });
    if (!bed) return res.status(400).json({ error: 'Invalid bedId' });
    const item = await prisma.linenItem.findUnique({ where: { id: parsed.linenItemId } });
    if (!item) return res.status(400).json({ error: 'Invalid linenItemId' });

    // Autorização por cliente quando manager
    if (req.user.role === 'manager') {
      const clientIdOfBed = bed.sector?.clientId ?? null;
      const clientIdOfUser = req.user.clientId ?? null;
      if (clientIdOfBed && clientIdOfUser && clientIdOfBed !== clientIdOfUser) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      // Criar registros de distribuição (um por peça)
      for (let i = 0; i < parsed.quantity; i++) {
        await tx.distributedItem.create({ data: {
          linenItemId: parsed.linenItemId,
          bedId: parsed.bedId,
          status: 'allocated',
          clientId: bed.sector?.clientId ?? null
        } as any });
      }

      // Abater estoque
      const freshItem = await tx.linenItem.findUnique({ where: { id: parsed.linenItemId } });
      const current = freshItem ? freshItem.currentStock : (item as any).currentStock;
      const newStock = Math.max(0, Number(current) - parsed.quantity);
      await tx.linenItem.update({ where: { id: parsed.linenItemId }, data: { currentStock: newStock } });

      // Registrar movimento de estoque (auditoria)
      const reason = (parsed.reason && parsed.reason.trim().length > 0) ? parsed.reason.trim() : 'Distribuição via Totem';
      await tx.stockMovement.create({ data: {
        itemId: parsed.linenItemId,
        type: 'out',
        quantity: parsed.quantity,
        reason,
        clientId: bed.sector?.clientId ?? null
      } });

      return { newStock };
    });

    res.status(201).json({ ok: true, itemId: parsed.linenItemId, bedId: parsed.bedId, quantity: parsed.quantity, newStock: (created as any).newStock });
  } catch (e) { next(e); }
});

app.get('/me/client', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const clientId = req.user.clientId ?? null;
    if (!clientId) return res.status(400).json({ error: 'NoClientForUser' });
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'NotFound' });
    res.json(client);
  } catch (e) { next(e); }
});

// ==============================
// Distributed Items (enxoval alocado)
// ==============================
const distributedItemSchema = z.object({ linenItemId: z.string().min(1), bedId: z.string().min(1), status: z.enum(['allocated','pendingCollection','collected']).default('allocated'), orderId: z.string().optional().nullable(), allocatedAt: z.string().optional().nullable() });

app.get('/distributed-items', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const where: any = {};
    if (req.user.role === 'manager' && req.user.clientId) where.clientId = req.user.clientId;
    else if (req.query.clientId) where.clientId = String(req.query.clientId);
    if (req.query.sectorId) where.bed = { sectorId: String(req.query.sectorId) };

    const list = await prisma.distributedItem.findMany({ where, include: { linenItem: true, bed: { include: { sector: true } } } } as any);

    // Try to enrich with distributor name inferred from stockMovements reason
    const itemIds = Array.from(new Set(list.map(d => d.linenItemId)));
    let movements: Array<{ id: string; itemId: string; type: string; reason: string; createdAt: Date }>; 
    if (itemIds.length > 0) {
      // Limit to recent movements to keep query light
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
      movements = await prisma.stockMovement.findMany({
        where: { itemId: { in: itemIds }, type: 'out', createdAt: { gte: since } },
        select: { id: true, itemId: true, type: true, reason: true, createdAt: true }
      }) as any;
    } else {
      movements = [] as any;
    }

    function extractDistributorName(reason: string): string | null {
      try {
        if (!reason) return null;
        // expected fragments contain "por Nome (email)"
        const m = reason.match(/por\s+([^\(]+)\s*\(/i);
        if (m && m[1]) return m[1].trim();
        return null;
      } catch { return null; }
    }

    const windowMs = 5 * 60 * 1000; // 5 minutes
    const audit = readDistributionAudit();
    const enriched = list.map(d => {
      const fromAudit = audit[d.id]?.name;
      const allocated = new Date(d.allocatedAt as any).getTime();
      const cands = movements
        .filter(m => m.itemId === d.linenItemId)
        .map(m => ({ m, dt: Math.abs(new Date(m.createdAt as any).getTime() - allocated) }))
        .filter(x => x.dt <= windowMs)
        .sort((a, b) => a.dt - b.dt);
      const candidate = cands.length > 0 ? cands[0].m : null;
      const inferred = candidate ? extractDistributorName(candidate.reason) : null;
      const distributedByName = fromAudit || inferred || null;
      return Object.assign({}, d as any, { distributedByName });
    });

    res.json(enriched);
  } catch (e) { next(e); }
});

app.post('/distributed-items', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = distributedItemSchema.parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: parsed.bedId }, include: { sector: true } });
    if (!bed) return res.status(400).json({ error: 'Invalid bedId' });
    if (req.user.role === 'manager' && bed.sector.clientId && req.user.clientId !== bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const created = await prisma.distributedItem.create({ data: { linenItemId: parsed.linenItemId, bedId: parsed.bedId, status: parsed.status, orderId: parsed.orderId ?? null, clientId: bed.sector.clientId ?? null, allocatedAt: parsed.allocatedAt ? new Date(parsed.allocatedAt) : new Date() } as any });
    try {
      const userRec = await prisma.systemUser.findUnique({ where: { id: req.user.sub } });
      const audit = readDistributionAudit();
      audit[created.id] = { name: userRec?.name, email: userRec?.email, at: new Date().toISOString() };
      writeDistributionAudit(audit);
    } catch {}
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/distributed-items/:id', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = distributedItemSchema.partial().parse(req.body);
    const existing = await prisma.distributedItem.findUnique({ where: { id: req.params.id }, include: { bed: { include: { sector: true } } } });
    if (!existing) return res.status(404).end();
    if (req.user.role === 'manager' && existing.clientId && req.user.clientId !== existing.clientId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.distributedItem.update({ where: { id: existing.id }, data: parsed as any });
    res.json(updated);
  } catch (e) { next(e); }
});
// List entries for a given date (YYYY-MM-DD)
app.get('/pesagens/por-dia', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const date = String(req.query.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' });
    const start = new Date(`${date}T00:00:00-03:00`);
    const end = new Date(`${date}T23:59:59-03:00`);
    const whereCtrl: any = { referenceDate: { gte: start, lte: end } };
    if ((req as any).user?.role === 'manager' && (req as any).user?.clientId) whereCtrl.clientId = (req as any).user.clientId;
    else if (req.query.clientId) whereCtrl.clientId = String(req.query.clientId);
    const controls = await prisma.weighingControl.findMany({ where: whereCtrl, select: { id: true, kind: true } });
    const controlIds = controls.map(c => c.id);
    if (controlIds.length === 0) return res.json({ entries: [] });
    const entries = (await prisma.weighingEntry.findMany({ where: { controlId: { in: controlIds } }, include: { cage: true } as any, orderBy: { createdAt: 'desc' } })) as any[];
    const kindById = new Map<string, 'suja' | 'limpa'>(controls.map(c => [c.id, (c.kind as any) || 'limpa']));
    const response = entries.map((e: any) => ({ id: e.id, controlId: e.controlId, kind: (kindById.get(e.controlId) as any) || 'limpa', tareWeight: e.tareWeight, totalWeight: e.totalWeight, netWeight: e.netWeight, createdAt: e.createdAt, cage: e.cage ? { id: e.cage.id, barcode: e.cage.barcode } : null }));
    res.json({ entries: response });
  } catch (e) { next(e); }
});

// Delete an entry
app.delete('/pesagens/:id', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.weighingEntry.findUnique({
      where: { id },
      include: { control: true }
    });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    
    // Validar se o controle está aberto
    if ((existing.control as any).status !== 'open') {
      return res.status(400).json({ error: 'Cannot delete from closed control' });
    }
    
    // Validar permissão do manager
    if ((req as any).user?.role === 'manager' && (req as any).user?.clientId) {
      if ((existing.control as any).clientId !== (req as any).user.clientId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    
    // Usar transaction para garantir consistência
    await prisma.$transaction(async (tx) => {
      await tx.weighingEntry.delete({ where: { id } });
      
      // Recalcular peso inline
      const agg = await tx.weighingEntry.aggregate({
        _sum: { netWeight: true },
        where: { controlId: existing.controlId }
      });
      const totalNet = Number(agg._sum.netWeight || 0);
      const gross = Number((existing.control as any).laundryGrossWeight);
      const diff = Number((gross - totalNet).toFixed(2));
      const percent = gross > 0 ? Number(((Math.abs(diff) / gross) * 100).toFixed(2)) : 0;
      
      await tx.weighingControl.update({
        where: { id: existing.controlId },
        data: {
          clientTotalNetWeight: String(totalNet),
          differenceWeight: String(diff),
          differencePercent: String(percent)
        } as any
      });
    });
    
    res.status(204).end();
  } catch (e) { next(e); }
});

// Sectors CRUD
const sectorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

app.get('/sectors', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    let where: any = {};
    if (req.user.role === 'manager' && req.user.clientId) {
      where = { clientId: req.user.clientId as string };
    } else if (req.query.clientId) {
      where = { clientId: String(req.query.clientId) };
    }
    const data = await prisma.sector.findMany({ where, include: { client: true } });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/sectors', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = sectorSchema.parse(req.body);
    // managers can only create sector for their own client
    const selectedClientId = req.user.role === 'manager' ? req.user.clientId : (parsed.clientId ?? null);
    const clientId = selectedClientId && String(selectedClientId).trim() !== '' ? selectedClientId : null;
    if (clientId !== null) {
      const exists = await prisma.client.findUnique({ where: { id: clientId as string } });
      if (!exists) return res.status(400).json({ error: 'Invalid clientId' });
    }
    const data: any = { name: parsed.name, description: parsed.description ?? null };
    if (clientId !== null) data.clientId = clientId;
    const created = await prisma.sector.create({ data });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/sectors/:id', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = sectorSchema.partial().parse(req.body);
    // restrict managers to their client sectors
    const existing = await prisma.sector.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).end();
    if (req.user.role === 'manager' && existing.clientId && req.user.clientId !== existing.clientId) return res.status(403).json({ error: 'Forbidden' });
    const data: any = { ...parsed };
    if (parsed.clientId !== undefined) {
      const normalized = String(parsed.clientId).trim();
      data.clientId = normalized.length > 0 ? normalized : null;
      if (data.clientId !== null) {
        const exists = await prisma.client.findUnique({ where: { id: data.clientId } });
        if (!exists) return res.status(400).json({ error: 'Invalid clientId' });
      }
    }
    const updated = await prisma.sector.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/sectors/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    await prisma.sector.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Beds CRUD + status
const bedSchema = z.object({ number: z.string().min(1), sectorId: z.string().min(1), status: z.enum(['free','occupied']).optional() });

app.get('/beds', requireAuth(['admin','manager']), async (req: any, _res, next) => {
  try {
    // handled via sectors filter; beds by client id through sector relation would need join; for MVP return all
    next();
  } catch (e) { next(e); }
});

app.get('/beds', async (req: any, res, next) => {
  try {
    let where: any = {};
    if (req.user?.role === 'manager' && req.user?.clientId) {
      where = { sector: { clientId: req.user.clientId } };
    } else if (req.query.clientId) {
      where = { sector: { clientId: String(req.query.clientId) } };
    }
    const data = await prisma.bed.findMany({ where, include: { sector: true } } as any);
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/beds', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = bedSchema.parse(req.body);
    const sector = await prisma.sector.findUnique({ where: { id: parsed.sectorId } });
    if (!sector) return res.status(400).json({ error: 'Invalid sectorId' });
    if (req.user.role === 'manager' && sector.clientId && req.user.clientId !== sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const created = await prisma.bed.create({ data: { number: parsed.number, sectorId: parsed.sectorId, status: parsed.status ?? 'free', token: crypto.randomUUID() } });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/beds/:id', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = bedSchema.partial().parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: req.params.id }, include: { sector: true } });
    if (!bed) return res.status(404).end();
    if (req.user.role === 'manager' && bed.sector.clientId && req.user.clientId !== bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.bed.update({ where: { id: req.params.id }, data: parsed });
    res.json(updated);
  } catch (e) { next(e); }
});

app.put('/beds/:id/status', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['free','occupied']) }).parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: req.params.id }, include: { sector: true } });
    if (!bed) return res.status(404).end();
    if (req.user.role === 'manager' && bed.sector.clientId && req.user.clientId !== bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.bed.update({ where: { id: req.params.id }, data: { status: parsed.status } });
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/beds/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    await prisma.bed.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Items CRUD
const itemSchema = z.object({ name: z.string().min(1), sku: z.string().min(1), unit: z.string().min(1), currentStock: z.number().int().nonnegative().default(0), minimumStock: z.number().int().nonnegative().default(0), clientId: z.string().optional().nullable() });

app.get('/items', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    let where: any = {};
    if (req.user.role === 'manager' && req.user.clientId) {
      where = { clientId: req.user.clientId };
    } else if (req.query.clientId) {
      where = { clientId: String(req.query.clientId) };
    }
    const data = await prisma.linenItem.findMany({ where } as any);
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/items', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = itemSchema.parse(req.body);
    let clientId = req.user.role === 'manager' ? (req.user.clientId ?? null) : (parsed.clientId ?? null);
    // Se admin não enviar clientId, recusar para evitar item global nesta nova regra
    if (req.user.role === 'admin' && clientId === null) {
      return res.status(400).json({ error: 'Missing clientId for admin-created item' });
    }
    if (clientId !== null) {
      const exists = await prisma.client.findUnique({ where: { id: clientId } });
      if (!exists) return res.status(400).json({ error: 'Invalid clientId' });
    }
    const created = await prisma.linenItem.create({ data: { name: parsed.name, sku: parsed.sku, unit: parsed.unit, currentStock: parsed.currentStock, minimumStock: parsed.minimumStock, clientId } as any });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/items/:id', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = itemSchema.partial().parse(req.body);
    const data: any = { ...parsed };
    if (req.user.role === 'manager') {
      delete data.clientId; // managers cannot move items across clients
    } else if (parsed.clientId !== undefined) {
      data.clientId = parsed.clientId ?? null;
    }
    const existing = await prisma.linenItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).end();
    const existingClientId = (existing as any).clientId as string | null | undefined;
    if (req.user.role === 'manager' && existingClientId && existingClientId !== req.user.clientId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.linenItem.update({ where: { id: req.params.id }, data: data as any });
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/items/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    await prisma.linenItem.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Orders
const orderItemInput = z.object({ itemId: z.string().min(1), quantity: z.number().int().positive() });
const orderSchema = z.object({ bedId: z.string().min(1), items: z.array(orderItemInput).min(1), observations: z.string().optional().nullable(), scheduledDelivery: z.string().optional().nullable() });

function parseMaybeDate(input?: string | null): Date | null {
  if (!input) return null;
  let value = String(input).trim();
  if (value.length === 0) return null;
  // Support HTML datetime-local without seconds: YYYY-MM-DDTHH:MM
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    value = `${value}:00`;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

app.get('/orders', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const where: any = {};
    // if manager, filter by beds whose sector belongs to manager's client
    if (req.user.role === 'manager' && req.user.clientId) {
      const sectors = await prisma.sector.findMany({ where: { clientId: req.user.clientId }, select: { id: true } });
      const sectorIds = sectors.map(s => s.id);
      const beds = await prisma.bed.findMany({ where: { sectorId: { in: sectorIds } }, select: { id: true } });
      const bedIds = beds.map(b => b.id);
      where.bedId = { in: bedIds };
    } else if (req.query.clientId) {
      const clientId = String(req.query.clientId);
      const sectors = await prisma.sector.findMany({ where: { clientId }, select: { id: true } });
      const sectorIds = sectors.map(s => s.id);
      const beds = await prisma.bed.findMany({ where: { sectorId: { in: sectorIds } }, select: { id: true } });
      const bedIds = beds.map(b => b.id);
      where.bedId = { in: bedIds };
    }
    const data = await prisma.order.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { updatedAt: 'desc' }
      ],
      include: {
        items: { include: { item: true } },
        bed: { include: { sector: true } }
      }
    });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/orders', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = orderSchema.parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: parsed.bedId }, include: { sector: true } });
    if (!bed) return res.status(400).json({ error: 'Invalid bedId' });
    if (req.user.role === 'manager' && bed.sector.clientId && req.user.clientId !== bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({ data: { bedId: parsed.bedId, status: 'pending', observations: parsed.observations ?? null, scheduledDelivery: parseMaybeDate(parsed.scheduledDelivery) } });
      for (const it of parsed.items) {
        await tx.orderItem.create({ data: { orderId: created.id, itemId: it.itemId, quantity: it.quantity } });
        const item = await tx.linenItem.findUnique({ where: { id: it.itemId } });
        if (item) {
          const newStock = Math.max(0, item.currentStock - it.quantity);
          await tx.linenItem.update({ where: { id: item.id }, data: { currentStock: newStock } });
          await tx.stockMovement.create({ data: { itemId: item.id, type: 'out', quantity: it.quantity, reason: `Pedido ${created.id}` } });
        }
      }
      return created;
    });
    const full = await prisma.order.findUnique({ where: { id: created.id }, include: { items: true, bed: true } });
    res.status(201).json(full);
  } catch (e) { next(e); }
});

app.put('/orders/:id/status', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['pending','preparing','delivered','cancelled']) }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { bed: { include: { sector: true } } } });
    if (!order) return res.status(404).end();
    if (req.user.role === 'manager' && order.bed.sector.clientId && req.user.clientId !== order.bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.order.update({ where: { id: req.params.id }, data: { status: parsed.status } });
    res.json(updated);
  } catch (e) { next(e); }
});

// Delete order (admin only)
app.delete('/orders/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const id = req.params.id;
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) return;
      for (const it of order.items) {
        const item = await tx.linenItem.findUnique({ where: { id: it.itemId } });
        if (item) {
          await tx.linenItem.update({ where: { id: item.id }, data: { currentStock: item.currentStock + it.quantity } });
          // Registrar movimento sem referenciar o pedido para evitar violação de FK
          await tx.stockMovement.create({ data: { itemId: item.id, type: 'in', quantity: it.quantity, reason: `Rollback pedido ${id}`, clientId: (item as any).clientId ?? null } as any });
        }
      }
      // Remover itens do pedido explicitamente antes de excluir o pedido
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Stock movements
const movementSchema = z.object({ itemId: z.string().min(1), type: z.enum(['in','out']), quantity: z.number().int().positive(), reason: z.string().min(1), orderId: z.string().optional().nullable() });

app.get('/stock-movements', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    let where: any = {};
    if (req.user.role === 'manager' && req.user.clientId) where = { clientId: req.user.clientId };
    else if (req.query.clientId) where = { clientId: String(req.query.clientId) };
    const data = await prisma.stockMovement.findMany({ where, include: { item: true } } as any);
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/stock-movements', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = movementSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({ data: { itemId: parsed.itemId, type: parsed.type, quantity: parsed.quantity, reason: parsed.reason, orderId: parsed.orderId ?? null } });
      const item = await tx.linenItem.findUnique({ where: { id: parsed.itemId } });
      if (item) {
        const newStock = parsed.type === 'in' ? item.currentStock + parsed.quantity : Math.max(0, item.currentStock - parsed.quantity);
        await tx.linenItem.update({ where: { id: item.id }, data: { currentStock: newStock } });
        // stamp clientId on movement
        await tx.stockMovement.update({ where: { id: created.id }, data: { clientId: (item as any).clientId ?? null } as any });
      }
      return created;
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Confirm delivery
const confirmSchema = z.object({
  receiverName: z.string().min(1),
  confirmationType: z.enum(['signature', 'photo']),
  confirmationUrl: z.string().url(),
  deliveredByUserId: z.string().optional().nullable(),
});

app.put('/orders/:id/confirm-delivery', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = confirmSchema.parse(req.body);
    
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { bed: { include: { sector: true } } } });
    if (!order) {
      return res.status(404).end();
    }
    
    if (req.user.role === 'manager' && order.bed.sector.clientId && req.user.clientId !== order.bed.sector.clientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        deliveredByUserId: parsed.deliveredByUserId || null,
        receiverName: parsed.receiverName,
        confirmationType: parsed.confirmationType,
        confirmationUrl: parsed.confirmationUrl,
      }
    });
    res.json(updated);
  } catch (e) { 
    next(e); 
  }
});

// ==============================
// Special ROL (itens especiais)
// ==============================
const specialRollCreateSchema = z.object({
  clientId: z.string().optional().nullable(),
  linenItemId: z.string().optional().nullable(),
  itemName: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().int().optional().nullable(),
  weight: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(5).optional().nullable(),
  senderName: z.string().optional().nullable()
});

const specialRollUpdateSchema = z.object({
  description: z.string().optional().nullable(),
  expectedReturnAt: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(5).optional().nullable()
});

const specialRollStatusSchema = z.object({
  status: z.enum(['received','washing','drying','quality_check','ready','dispatched','returned','cancelled']),
  note: z.string().optional().nullable(),
  currentLocation: z.string().optional().nullable(),
  expectedReturnAt: z.string().optional().nullable(),
  qualityNotes: z.string().optional().nullable(),
  finalWeight: z.string().optional().nullable(),
  dispatchedBy: z.string().optional().nullable()
});

function generateSpecialRollNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000);
  const suffix = String(rand).padStart(4, '0');
  return `ROL-${yyyy}${mm}-${suffix}`;
}

app.post('/special-rolls', requireAuth(['admin','manager']), upload.single('attachment'), async (req: any, res, next) => {
  try {
    // Convert FormData fields to proper types
    const body = {
      ...req.body,
      priority: req.body.priority ? parseInt(req.body.priority) : null,
      quantity: req.body.quantity ? parseInt(req.body.quantity) : null
    };
    const parsed = specialRollCreateSchema.parse(body);
    const isManager = req.user.role === 'manager';
    const clientId = isManager ? (req.user.clientId ?? null) : (parsed.clientId ?? null);
    if (clientId !== null) {
      const exists = await prisma.client.findUnique({ where: { id: clientId } });
      if (!exists) return res.status(400).json({ error: 'Invalid clientId' });
    }
    if (parsed.linenItemId) {
      const item = await prisma.linenItem.findUnique({ where: { id: parsed.linenItemId } });
      if (!item) return res.status(400).json({ error: 'Invalid linenItemId' });
    }

    let number = '';
    for (let i = 0; i < 5; i++) {
      number = generateSpecialRollNumber();
      const exists = await (prisma as any).specialRoll.findUnique({ where: { number } });
      if (!exists) break;
    }

    const created = await prisma.$transaction(async (tx) => {
      // Montar dados com relações aninhadas para compatibilidade de schema
      const data: any = {
        number,
        itemName: parsed.itemName,
        description: parsed.description ?? null,
        quantity: parsed.quantity ?? null,
        weight: parsed.weight ?? null,
        priority: parsed.priority ?? null,
        status: 'received',
        attachments: req.file ? req.file.filename : null,
        senderName: parsed.senderName ?? null
      };
      if (clientId) data.client = { connect: { id: clientId } };
      if (parsed.linenItemId) data.linenItem = { connect: { id: parsed.linenItemId } };

      const created = await (tx as any).specialRoll.create({ data });
      await (tx as any).specialRollEvent.create({
        data: {
          rollId: created.id,
          eventType: 'enviado',
          note: 'Item enviado para lavanderia',
          location: 'recepção',
          userId: req.user.sub ?? null,
          timestamp: new Date()
        }
      });
      return created;
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.get('/special-rolls', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const clientIdFilter = String(req.query.clientId ?? '').trim();
    const dateStart = String(req.query.dateStart ?? '').trim();
    const dateEnd = String(req.query.dateEnd ?? '').trim();

    const where: any = {};
    if (q) where.OR = [{ number: { contains: q } }, { itemName: { contains: q } }];
    if (status) where.status = status;
    if (dateStart) where.createdAt = Object.assign(where.createdAt || {}, { gte: new Date(`${dateStart}T00:00:00Z`) });
    if (dateEnd) where.createdAt = Object.assign(where.createdAt || {}, { lte: new Date(`${dateEnd}T23:59:59Z`) });
    if (req.user.role === 'manager' && req.user.clientId) where.clientId = req.user.clientId;
    else if (clientIdFilter) where.clientId = clientIdFilter;

    const prismaAny = prisma as any;
    const [total, data] = await Promise.all([
      prismaAny.specialRoll.count({ where }),
      prismaAny.specialRoll.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          itemName: true,
          description: true,
          expectedReturnAt: true,
          status: true,
          currentLocation: true,
          priority: true,
          createdAt: true,
          clientId: true,
          linenItemId: true,
        }
      })
    ]);
    res.json({ page, pageSize, total, data });
  } catch (e) { next(e); }
});

app.get('/special-rolls/:id', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const prismaAny = prisma as any;
    const data = await prismaAny.specialRoll.findUnique({ 
      where: { id: req.params.id }, 
      include: { 
        client: true, 
        linenItem: true 
      }
    });
    if (!data) return res.status(404).json({ error: 'NotFound' });
    res.json(data);
  } catch (e) { next(e); }
});

app.get('/special-rolls/by-number/:number', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const prismaAny = prisma as any;
    const data = await prismaAny.specialRoll.findUnique({ where: { number: req.params.number } });
    if (!data) return res.status(404).json({ error: 'NotFound' });
    res.json(data);
  } catch (e) { next(e); }
});

app.put('/special-rolls/:id', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = specialRollUpdateSchema.parse(req.body);
    const existing = await (prisma as any).specialRoll.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    if (req.user.role === 'manager' && existing.clientId && req.user.clientId !== existing.clientId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await (prisma as any).specialRoll.update({ where: { id: existing.id }, data: {
      description: parsed.description ?? null,
      expectedReturnAt: parseMaybeDate(parsed.expectedReturnAt),
      priority: parsed.priority ?? null
    } });
    res.json(updated);
  } catch (e) { next(e); }
});

app.put('/special-rolls/:id/status', requireAuth(['admin','manager']), upload.fields([
  { name: 'receivedPhoto', maxCount: 1 },
  { name: 'dispatchedPhoto', maxCount: 1 }
]), async (req: any, res, next) => {
  try {
    const parsed = specialRollStatusSchema.parse(req.body);
    const existing = await (prisma as any).specialRoll.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    if (req.user.role === 'manager' && existing.clientId && req.user.clientId !== existing.clientId) return res.status(403).json({ error: 'Forbidden' });

    // VALIDAÇÃO DE FLUXO SEQUENCIAL (permitir regravar 'received' para preencher dados)
    if (!(existing.status === 'received' && parsed.status === 'received') && !isValidStatusTransition(existing.status, parsed.status)) {
      return res.status(400).json({ 
        error: 'InvalidStatusTransition',
        message: `Não é possível alterar de "${existing.status}" para "${parsed.status}". Siga a ordem sequencial: ${SPECIAL_ROLL_FLOW_ORDER.join(' → ')}`,
        currentStatus: existing.status,
        requestedStatus: parsed.status,
        validNextStatuses: getValidNextStatuses(existing.status)
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: parsed.status,
        currentLocation: parsed.currentLocation ?? existing.currentLocation
      };

      // Adicionar campos específicos baseados no status
      if (parsed.status === 'received') {
        // Validar obrigatórios de recebimento
        const expected = parseMaybeDate(parsed.expectedReturnAt);
        if (!expected) {
          throw Object.assign(new Error('ExpectedReturnAtRequired'), { code: 'BAD_REQUEST_EXPECTED_RETURN' });
        }
        if (parsed.expectedReturnAt) updateData.expectedReturnAt = parseMaybeDate(parsed.expectedReturnAt);
        if (parsed.qualityNotes) updateData.qualityNotes = parsed.qualityNotes;
        if (req.files?.receivedPhoto?.[0]) updateData.receivedPhoto = req.files.receivedPhoto[0].filename;
      } else if (parsed.status === 'dispatched') {
        // Validar obrigatórios de expedição
        if (!parsed.finalWeight || String(parsed.finalWeight).trim() === '' || !parsed.dispatchedBy || String(parsed.dispatchedBy).trim() === '') {
          throw Object.assign(new Error('FinalWeightAndDispatchedByRequired'), { code: 'BAD_REQUEST_DISPATCH_REQUIRED' });
        }
        if (parsed.finalWeight) updateData.finalWeight = parsed.finalWeight;
        if (parsed.dispatchedBy) updateData.dispatchedBy = parsed.dispatchedBy;
        if (req.files?.dispatchedPhoto?.[0]) updateData.dispatchedPhoto = req.files.dispatchedPhoto[0].filename;
      }

      const updated = await (tx as any).specialRoll.update({ where: { id: existing.id }, data: updateData });
      await (tx as any).specialRollEvent.create({ data: {
        rollId: existing.id,
        eventType: parsed.status,
        note: parsed.note ?? null,
        location: parsed.currentLocation ?? null,
        userId: req.user.sub ?? null,
        timestamp: new Date()
      } });
      return updated;
    });
    res.json(updated);
  } catch (e) { next(e); }
});

app.get('/special-rolls/:id/events', requireAuth(['admin','manager']), async (req, res, next) => {
  try {
    const prismaAny = prisma as any;
    const data = await prismaAny.specialRollEvent.findMany({ where: { rollId: req.params.id }, orderBy: { timestamp: 'asc' } });
    res.json(data);
  } catch (e) { next(e); }
});

// Excluir ROL Especial (remove eventos primeiro)
app.delete('/special-rolls/:id', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const prismaAny = prisma as any;
    const existing = await prismaAny.specialRoll.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    if (req.user.role === 'manager' && existing.clientId && req.user.clientId !== existing.clientId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.$transaction(async (tx) => {
      await (tx as any).specialRollEvent.deleteMany({ where: { rollId: existing.id } });
      await (tx as any).specialRoll.delete({ where: { id: existing.id } });
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Excluir por número (fallback quando cliente só tem o número)
app.delete('/special-rolls/by-number/:number', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const prismaAny = prisma as any;
    const existing = await prismaAny.specialRoll.findUnique({ where: { number: req.params.number } });
    if (!existing) return res.status(404).json({ error: 'NotFound' });
    if (req.user.role === 'manager' && existing.clientId && req.user.clientId !== existing.clientId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.$transaction(async (tx) => {
      await (tx as any).specialRollEvent.deleteMany({ where: { rollId: existing.id } });
      await (tx as any).specialRoll.delete({ where: { id: existing.id } });
    });
    res.status(204).end();
  } catch (e) { next(e); }
});
// Serve SPA (frontend) if enabled and available
console.log('SERVE_SPA value:', process.env.SERVE_SPA);
if (true) { // Force enable static files
  const publicDir = path.join(process.cwd(), 'public');
  console.log('SERVE_SPA enabled, public directory:', publicDir);
  if (fs.existsSync(publicDir)) {
    console.log('Public directory exists, serving static files');
    app.use(express.static(publicDir));
    
    // Test endpoint for static files
    app.get('/test-static', (req, res) => {
      res.json({ message: 'Static files are working', publicDir });
    });
    
    // Serve track.html directly
    app.get('/track.html', (req, res) => {
      const trackPath = path.join(publicDir, 'track.html');
      if (fs.existsSync(trackPath)) {
        res.sendFile(trackPath);
      } else {
        res.status(404).send('Track page not found');
      }
    });
    
    // Test endpoint
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
    });
    
    // Serve track page as HTML
    app.get('/track', (req, res) => {
      const rollNumber = req.query.roll;
      if (!rollNumber) {
        return res.status(400).send('Número do ROL não fornecido');
      }
      
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acompanhamento ROL Especial - ECOLAV</title>
    <link rel="icon" type="image/png" href="/ecolav.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <style>
        @media print {
            .no-print { display: none !important; }
            .print-break { page-break-before: always; }
            body { background: white !important; }
            .shadow-md { box-shadow: none !important; }
        }
        .ecolav-gradient {
            background: linear-gradient(135deg, #1e40af 0%, #059669 100%);
        }
    </style>
    <script>
      // Wait for QRCode library to load
      window.addEventListener('load', function() {
        if (typeof QRCode === 'undefined') {
          console.error('QRCode library failed to load');
          const qrContainer = document.getElementById('qrcode');
          if (qrContainer) {
            qrContainer.innerHTML = '<div class="text-red-500 text-sm">Erro ao carregar QR Code</div>';
          }
        }
      });
    </script>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header com Logo -->
    <div class="ecolav-gradient text-white py-4 mb-8">
        <div class="container mx-auto px-4">
            <div class="flex items-center justify-center gap-4">
                <img src="/ecolav.png" alt="ECOLAV" class="h-12 w-12">
                <div class="text-center">
                    <h1 class="text-2xl font-bold">ECOLAV</h1>
                    <p class="text-sm opacity-90">Sistema de Gestão de Lavanderia</p>
                </div>
            </div>
        </div>
    </div>

    <div class="container mx-auto px-4 py-8 max-w-6xl">
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-2">Acompanhamento ROL Especial</h2>
            <p class="text-gray-600">Acompanhe o status do seu item em tempo real</p>
        </div>

        <!-- Busca -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
            <div class="flex flex-col md:flex-row gap-4">
                <input 
                    type="text" 
                    id="rollNumber" 
                    placeholder="Digite o número do ROL"
                    value="${rollNumber}"
                    class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                <button 
                    onclick="trackRoll()" 
                    class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                    Buscar
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div id="loading" class="hidden text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Buscando informações...</p>
        </div>

        <!-- Error -->
        <div id="error" class="hidden bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">Erro</h3>
                    <div class="mt-2 text-sm text-red-700" id="errorMessage"></div>
                </div>
            </div>
        </div>

        <!-- Results -->
        <div id="results" class="hidden">
            <!-- Botão de Impressão -->
            <div class="text-right mb-4 no-print">
                <button 
                    onclick="window.print()" 
                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                    </svg>
                    Imprimir
                </button>
            </div>

            <!-- Informações Principais -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900" id="rollNumberTitle"></h2>
                        <p class="text-gray-600" id="itemName"></p>
                    </div>
                    <span id="statusBadge" class="px-4 py-2 rounded-full text-sm font-medium"></span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Informações do Item -->
                    <div>
                        <h3 class="font-semibold text-gray-900 mb-3 text-lg">📦 Informações do Item</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Descrição:</span>
                                <span id="description" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Peso Inicial:</span>
                                <span id="weight" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Quantidade:</span>
                                <span id="quantity" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Peso Final:</span>
                                <span id="finalWeight" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Cliente:</span>
                                <span id="clientName" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Enviado por:</span>
                                <span id="senderName" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Expedido por:</span>
                                <span id="dispatchedBy" class="text-right"></span>
                            </div>
                        </div>
                    </div>

                    <!-- Status e Localização -->
                    <div>
                        <h3 class="font-semibold text-gray-900 mb-3 text-lg">📍 Status e Localização</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Status Atual:</span>
                                <span id="currentStatus" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Local Atual:</span>
                                <span id="currentLocation" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Retorno Previsto:</span>
                                <span id="expectedReturn" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Data de Criação:</span>
                                <span id="createdAt" class="text-right"></span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Prioridade:</span>
                                <span id="priority" class="text-right"></span>
                            </div>
                        </div>
                    </div>

                    <!-- QR Code -->
                    <div>
                        <h3 class="font-semibold text-gray-900 mb-3 text-lg">🔗 QR Code</h3>
                        <div class="text-center">
                            <canvas id="qrcode" class="mx-auto border border-gray-200 rounded-lg"></canvas>
                            <p class="text-sm text-gray-500 mt-2">Compartilhe este QR Code</p>
                            <p class="text-xs text-gray-400 mt-1" id="qrUrl"></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Controle de Qualidade -->
            <div id="qualitySection" class="hidden bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">🔍 Controle de Qualidade</h3>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p class="text-gray-700" id="qualityNotes"></p>
                </div>
            </div>

            <!-- Fotos -->
            <div id="photosSection" class="hidden bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">📸 Fotos do Processo</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="photosGrid">
                </div>
            </div>

            <!-- Histórico de Eventos -->
            <div class="bg-white rounded-lg shadow-md p-6 print-break">
                <h3 class="text-xl font-bold text-gray-900 mb-4">📋 Histórico de Eventos</h3>
                <div id="timeline" class="space-y-4"></div>
            </div>
        </div>

        <!-- Footer -->
        <div class="text-center mt-8 text-gray-500 text-sm">
            <p>&copy; 2025 ECOLAV - Sistema de Gestão de Lavanderia</p>
            <p class="mt-1">Documento gerado em: <span id="generatedAt"></span></p>
        </div>
    </div>

    <script>
        const STATUS_LABELS = {
            received: 'Recebido',
            enviado: 'Enviado',
            washing: 'Lavagem',
            drying: 'Secagem',
            quality_check: 'Controle de Qualidade',
            ready: 'Pronto',
            dispatched: 'Expedido',
            returned: 'Devolvido',
            cancelled: 'Cancelado'
        };

        const STATUS_COLORS = {
            received: 'bg-blue-100 text-blue-800',
            enviado: 'bg-cyan-100 text-cyan-800',
            washing: 'bg-yellow-100 text-yellow-800',
            drying: 'bg-orange-100 text-orange-800',
            quality_check: 'bg-purple-100 text-purple-800',
            ready: 'bg-green-100 text-green-800',
            dispatched: 'bg-indigo-100 text-indigo-800',
            returned: 'bg-emerald-100 text-emerald-800',
            cancelled: 'bg-red-100 text-red-800'
        };

        async function trackRoll() {
            const rollNumber = document.getElementById('rollNumber').value.trim();
            if (!rollNumber) {
                showError('Por favor, digite o número do ROL');
                return;
            }

            showLoading();
            hideError();
            hideResults();

            try {
                const response = await fetch(\`/api/public/special-rolls/track/\${encodeURIComponent(rollNumber)}\`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('ROL não encontrado. Verifique o número digitado.');
                    } else {
                        throw new Error('Erro ao buscar informações do ROL.');
                    }
                }

                const data = await response.json();
                showResults(data);
            } catch (error) {
                showError(error.message);
            } finally {
                hideLoading();
            }
        }

        function showLoading() {
            document.getElementById('loading').classList.remove('hidden');
        }

        function hideLoading() {
            document.getElementById('loading').classList.add('hidden');
        }

        function showError(message) {
            document.getElementById('errorMessage').textContent = message;
            document.getElementById('error').classList.remove('hidden');
        }

        function hideError() {
            document.getElementById('error').classList.add('hidden');
        }

        function showResults(data) {
            const { roll, events } = data;

            // Informações básicas
            document.getElementById('rollNumberTitle').textContent = roll.number;
            document.getElementById('itemName').textContent = roll.itemName;
            document.getElementById('description').textContent = roll.description || 'Não informado';
            document.getElementById('weight').textContent = roll.weight ? roll.weight + ' kg' : 'Não informado';
            document.getElementById('quantity').textContent = (typeof roll.quantity === 'number') ? String(roll.quantity) : 'Não informado';
            document.getElementById('finalWeight').textContent = roll.finalWeight ? roll.finalWeight + ' kg' : 'Não informado';
            document.getElementById('clientName').textContent = roll.client?.name || 'Não informado';
            document.getElementById('senderName').textContent = roll.senderName || 'Não informado';
            document.getElementById('dispatchedBy').textContent = roll.dispatchedBy || 'Não informado';
            document.getElementById('currentLocation').textContent = roll.currentLocation || 'Não informado';
            document.getElementById('expectedReturn').textContent = roll.expectedReturnAt 
                ? new Date(roll.expectedReturnAt).toLocaleDateString('pt-BR') 
                : 'Não definido';
            document.getElementById('createdAt').textContent = new Date(roll.createdAt).toLocaleDateString('pt-BR');
            document.getElementById('priority').textContent = roll.priority ? 'Prioridade ' + roll.priority : 'Normal';

            // Status
            const statusBadge = document.getElementById('statusBadge');
            const currentStatus = document.getElementById('currentStatus');
            const statusText = STATUS_LABELS[roll.status] || roll.status;
            statusBadge.textContent = statusText;
            currentStatus.textContent = statusText;
            statusBadge.className = \`px-4 py-2 rounded-full text-sm font-medium \${STATUS_COLORS[roll.status] || 'bg-gray-100 text-gray-800'}\`;

            // QR Code
            const qrCanvas = document.getElementById('qrcode');
            const qrUrl = \`\${window.location.origin}/track?roll=\${encodeURIComponent(roll.number)}\`;
            document.getElementById('qrUrl').textContent = qrUrl;
            
            if (typeof QRCode !== 'undefined') {
                QRCode.toCanvas(qrCanvas, qrUrl, { width: 200, margin: 2 }, function (error) {
                    if (error) {
                        console.error('Erro ao gerar QR Code:', error);
                        qrCanvas.innerHTML = '<div class="text-red-500 text-sm">Erro ao gerar QR Code</div>';
                    }
                });
            } else {
                console.error('QRCode library not available');
                qrCanvas.innerHTML = '<div class="text-red-500 text-sm">Biblioteca QR Code não disponível</div>';
            }

            // Controle de Qualidade
            if (roll.qualityNotes) {
                document.getElementById('qualityNotes').textContent = roll.qualityNotes;
                document.getElementById('qualitySection').classList.remove('hidden');
            }

            // Fotos
            const photosGrid = document.getElementById('photosGrid');
            const photos = [];
            if (roll.attachments) photos.push({ type: 'Foto do Item', url: roll.attachments });
            if (roll.receivedPhoto) photos.push({ type: 'Foto do Recebimento', url: roll.receivedPhoto });
            if (roll.dispatchedPhoto) photos.push({ type: 'Foto da Expedição', url: roll.dispatchedPhoto });

            if (photos.length > 0) {
                // Em produção, as fotos estão em /api/uploads/ (via proxy Nginx)
                const getPhotoUrl = (path) => {
                    const origin = window.location.origin;
                    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                        return \`/uploads/\${path}\`;
                    }
                    return \`/api/uploads/\${path}\`;
                };
                photosGrid.innerHTML = photos.map(photo => \`
                    <div class="text-center">
                        <h4 class="font-medium text-gray-700 mb-2">\${photo.type}</h4>
                        <img src="\${getPhotoUrl(photo.url)}" alt="\${photo.type}" class="w-full h-48 object-cover rounded-lg border border-gray-200">
                    </div>
                \`).join('');
                document.getElementById('photosSection').classList.remove('hidden');
            }

            // Timeline
            const timeline = document.getElementById('timeline');
            if (events.length > 0) {
                timeline.innerHTML = events.map((event, index) => \`
                    <div class="flex gap-4 p-4 bg-gray-50 rounded-lg">
                        <div class="flex-shrink-0">
                            <div class="w-4 h-4 rounded-full \${index === events.length - 1 ? 'bg-green-500' : 'bg-gray-300'}"></div>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="px-2 py-1 rounded text-xs font-medium \${STATUS_COLORS[event.eventType] || 'bg-gray-100 text-gray-800'}">
                                    \${STATUS_LABELS[event.eventType] || event.eventType}
                                </span>
                                <span class="text-xs text-gray-500">
                                    \${new Date(event.timestamp).toLocaleString('pt-BR')}
                                </span>
                            </div>
                            \${event.note ? \`<p class="text-sm text-gray-600">\${event.note}</p>\` : ''}
                            \${event.location ? \`<div class="text-xs text-gray-500 mt-1">📍 \${event.location}</div>\` : ''}
                        </div>
                    </div>
                \`).join('');
            } else {
                timeline.innerHTML = '<div class="text-center py-8 text-gray-500">Nenhum evento registrado ainda</div>';
            }

            // Data de geração
            document.getElementById('generatedAt').textContent = new Date().toLocaleString('pt-BR');

            document.getElementById('results').classList.remove('hidden');
        }

        function hideResults() {
            document.getElementById('results').classList.add('hidden');
        }

        window.addEventListener('load', function() {
            const rollNumber = document.getElementById('rollNumber').value;
            if (rollNumber) {
                trackRoll();
            }
        });

        document.getElementById('rollNumber').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                trackRoll();
            }
        });
    </script>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
    
    // Simple test endpoint
    app.get('/ping', (req, res) => {
      res.json({ message: 'pong', timestamp: new Date().toISOString() });
    });
    
    // Test endpoint for static files
    app.get('/test-static', (req, res) => {
      res.json({ message: 'Static files are working', publicDir });
    });
    
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') return next();
      // Não capturar rotas de API públicas/privadas
      if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/gaiolas') || req.path.startsWith('/controles') || req.path.startsWith('/pesagens') || req.path.startsWith('/distributed-items')) {
        return next();
      }
      const indexPath = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
      return next();
    });
  } else {
    console.log('Public directory does not exist:', publicDir);
  }
} else {
  console.log('SERVE_SPA not enabled, value:', process.env.SERVE_SPA);
}

// Basic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'ValidationError', details: err.errors });
  }
  res.status(500).json({ error: 'InternalServerError' });
});

// Public API (x-api-key) — read-only for external apps
const PUBLIC_API_KEYS = (process.env.PUBLIC_API_KEYS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (PUBLIC_API_KEYS.length === 0) return res.status(503).json({ error: 'PublicAPIUnavailable' });
  const key = String(req.headers['x-api-key'] || '');
  if (!PUBLIC_API_KEYS.includes(key)) return res.status(401).json({ error: 'InvalidApiKey' });
  next();
}

// GET /api/public/clients?q=&page=&pageSize=
app.get('/api/public/clients', requireApiKey, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
    const where: any = q
      ? { OR: [
          { name: { contains: q } },
          { document: { contains: q } },
          { contactName: { contains: q } },
          { contactEmail: { contains: q } },
          { contactPhone: { contains: q } },
          { whatsappNumber: { contains: q } },
        ] }
      : {};

    const prismaAny = prisma as any;
    const [total, data] = await Promise.all([
      prismaAny.client.count({ where }),
      prismaAny.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, document: true,
          contactName: true, contactEmail: true, contactPhone: true,
          whatsappNumber: true, createdAt: true,
        },
      }),
    ]);
    res.json({ page, pageSize, total, data });
  } catch (e) { next(e); }
});

// GET /api/public/clients/:id
app.get('/api/public/clients/:id', requireApiKey, async (req, res, next) => {
  try {
    const prismaAny = prisma as any;
    const client = await prismaAny.client.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, document: true,
        contactName: true, contactEmail: true, contactPhone: true,
        whatsappNumber: true, createdAt: true,
      },
    });
    if (!client) return res.status(404).json({ error: 'NotFound' });
    res.json(client);
  } catch (e) { next(e); }
});

// GET /api/public/linens?clientId=&q=&page=&pageSize=
app.get('/api/public/linens', requireApiKey, async (req, res, next) => {
  try {
    const clientId = String(req.query.clientId ?? '').trim();
    const q = String(req.query.q ?? '').trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 100)));
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (q) where.OR = [{ name: { contains: q } }, { sku: { contains: q } }];
    const prismaAny = prisma as any;
    const [total, data] = await Promise.all([
      prismaAny.linenItem.count({ where }),
      prismaAny.linenItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, sku: true, unit: true,
          currentStock: true, minimumStock: true, createdAt: true, clientId: true,
        },
      }),
    ]);
    res.json({ page, pageSize, total, data });
  } catch (e) { next(e); }
});

// GET /api/public/linens/:id
app.get('/api/public/linens/:id', requireApiKey, async (req, res, next) => {
  try {
    const prismaAny = prisma as any;
    const item = await prismaAny.linenItem.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, sku: true, unit: true,
        currentStock: true, minimumStock: true, createdAt: true, clientId: true,
      },
    });
    if (!item) return res.status(404).json({ error: 'NotFound' });
    res.json(item);
  } catch (e) { next(e); }
});

// Public Special ROLs (read-only)
app.get('/api/public/special-rolls', requireApiKey, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
    const q = String(req.query.q ?? '').trim();
    const clientId = String(req.query.clientId ?? '').trim();
    const number = String(req.query.number ?? '').trim();
    const where: any = {};
    if (number) where.number = number;
    if (q) where.OR = [{ number: { contains: q } }, { itemName: { contains: q } }];
    if (clientId) where.clientId = clientId;
    const prismaAny = prisma as any;
    const [total, data] = await Promise.all([
      prismaAny.specialRoll.count({ where }),
      prismaAny.specialRoll.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, number: true, itemName: true, description: true,
          expectedReturnAt: true, status: true, currentLocation: true,
          priority: true, createdAt: true, clientId: true, linenItemId: true,
        }
      })
    ]);
    res.json({ page, pageSize, total, data });
  } catch (e) { next(e); }
});

// Public Special ROL tracking by number (no API key required for QR Code access)
app.get('/api/public/special-rolls/track/:number', async (req, res, next) => {
  try {
    const number = String(req.params.number).trim();
    if (!number) return res.status(400).json({ error: 'InvalidNumber' });

    const prismaAny = prisma as any;
    const roll = await prismaAny.specialRoll.findUnique({
      where: { number },
      select: {
        id: true, number: true, itemName: true, description: true,
        quantity: true, weight: true, finalWeight: true, senderName: true, dispatchedBy: true,
        expectedReturnAt: true, status: true, currentLocation: true,
        priority: true, createdAt: true,
        attachments: true, receivedPhoto: true, dispatchedPhoto: true,
        client: { select: { id: true, name: true } }
      }
    });

    if (!roll) return res.status(404).json({ error: 'NotFound' });

    // Get events for this roll
    const events = await prismaAny.specialRollEvent.findMany({
      where: { rollId: roll.id },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true, eventType: true, note: true, location: true, timestamp: true
      }
    });

    res.json({ roll, events });
  } catch (e) { next(e); }
});

app.get('/api/public/special-rolls/:id', requireApiKey, async (req, res, next) => {
  try {
    const prismaAny = prisma as any;
    const data = await prismaAny.specialRoll.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, number: true, itemName: true, description: true,
        expectedReturnAt: true, status: true, currentLocation: true,
        priority: true, createdAt: true, clientId: true, linenItemId: true,
      }
    });
    if (!data) return res.status(404).json({ error: 'NotFound' });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/public/beds?clientId=&q=&page=&pageSize=
app.get('/api/public/beds', requireApiKey, async (req, res, next) => {
  try {
    const clientId = String(req.query.clientId ?? '').trim();
    const q = String(req.query.q ?? '').trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 100)));
    const where: any = {};
    if (clientId) where.sector = { clientId };
    if (q) where.OR = [ { number: { contains: q } } ];
    const [total, data] = await Promise.all([
      prisma.bed.count({ where } as any),
      prisma.bed.findMany({
        where: where as any,
        orderBy: { number: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, number: true, status: true, sectorId: true }
      } as any)
    ]);
    res.json({ page, pageSize, total, data });
  } catch (e) { next(e); }
});

// GET /api/public/sectors?clientId=&q=&page=&pageSize=
app.get('/api/public/sectors', requireApiKey, async (req, res, next) => {
  try {
    const clientId = String(req.query.clientId ?? '').trim();
    const q = String(req.query.q ?? '').trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 100)));
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (q) where.OR = [{ name: { contains: q } }, { description: { contains: q } }];
    const [total, data] = await Promise.all([
      prisma.sector.count({ where }),
      prisma.sector.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, description: true, clientId: true, createdAt: true }
      })
    ]);
    res.json({ page, pageSize, total, data });
  } catch (e) { next(e); }
});

// ==============================
// Public Totem API (x-api-key)
// ==============================
const publicOpenControlSchema = z.object({
  tipo: z.enum(['limpa','suja']),
  clientId: z.string().min(1)
});

app.get('/api/public/totem/gaiolas', requireApiKey, async (_req, res, next) => {
  try {
    const data = await prisma.cage.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/api/public/totem/controls/open', requireApiKey, async (req, res, next) => {
  try {
    const parsed = publicOpenControlSchema.parse(req.body);

    // Dia atual em horário de Brasília (UTC-3)
    const now = new Date();
    const todayBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayLocal = `${todayBrazil.getFullYear()}-${String(todayBrazil.getMonth() + 1).padStart(2, '0')}-${String(todayBrazil.getDate()).padStart(2, '0')}`;
    const startToday = new Date(`${todayLocal}T03:00:00.000Z`); // 00:00 BRT = 03:00 UTC
    const endToday = new Date(`${todayLocal}T02:59:59.999Z`);
    endToday.setDate(endToday.getDate() + 1); // 23:59 BRT do mesmo dia

    // FECHAR automaticamente controles abertos de dias anteriores (meia-noite)
    await prisma.weighingControl.updateMany({
      where: {
        clientId: parsed.clientId,
        kind: parsed.tipo,
        status: 'open',
        referenceDate: { lt: startToday } // Antes de hoje
      },
      data: {
        status: 'closed'
      }
    } as any);

    const existing = await prisma.weighingControl.findFirst({
      where: { clientId: parsed.clientId, kind: parsed.tipo, status: 'open', referenceDate: { gte: startToday, lte: endToday } }
    } as any);
    if (existing) return res.json(existing);

    let gross = 0;
    if (parsed.tipo === 'limpa') {
      // Ontem em horário de Brasília
      const yesterdayBrazil = new Date(todayBrazil);
      yesterdayBrazil.setDate(yesterdayBrazil.getDate() - 1);
      const yesterdayLocal = `${yesterdayBrazil.getFullYear()}-${String(yesterdayBrazil.getMonth() + 1).padStart(2, '0')}-${String(yesterdayBrazil.getDate()).padStart(2, '0')}`;
      const startY = new Date(`${yesterdayLocal}T03:00:00.000Z`);
      const endY = new Date(`${yesterdayLocal}T02:59:59.999Z`);
      endY.setDate(endY.getDate() + 1);
      const controlsYesterday = await prisma.weighingControl.findMany({
        where: { clientId: parsed.clientId, kind: 'limpa', referenceDate: { gte: startY, lte: endY } },
        select: { clientTotalNetWeight: true }
      } as any);
      const sum = controlsYesterday.reduce((acc, c) => acc + (Number((c as any).clientTotalNetWeight) || 0), 0);
      gross = Number(sum.toFixed(2));
    }

    // Amanhã em horário de Brasília
    const tomorrowBrazil = new Date(todayBrazil);
    tomorrowBrazil.setDate(tomorrowBrazil.getDate() + 1);
    const tomorrowLocal = `${tomorrowBrazil.getFullYear()}-${String(tomorrowBrazil.getMonth() + 1).padStart(2, '0')}-${String(tomorrowBrazil.getDate()).padStart(2, '0')}`;

    const created = await prisma.weighingControl.create({
      data: {
        laundryGrossWeight: String(gross),
        clientTotalNetWeight: '0',
        differenceWeight: '0',
        differencePercent: '0',
        kind: parsed.tipo,
        clientId: parsed.clientId,
        referenceDate: startToday,
        expectedDeliveryDate: parsed.tipo === 'suja' ? new Date(`${tomorrowLocal}T03:00:00.000Z`) : null
      } as any
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

const publicWeighingEntrySchema = z.object({
  control_id: z.string().min(1),
  cage_id: z.string().min(1).optional(),
  peso_tara: z.number().nonnegative().optional(),
  peso_total: z.number().nonnegative()
});

app.post('/api/public/totem/pesagens', requireApiKey, async (req, res, next) => {
  try {
    // LOG: Ver dados brutos que chegam
    console.log('📡 [TOTEM] Pesagem recebida:', JSON.stringify(req.body));
    
    const parsed = publicWeighingEntrySchema.parse(req.body);
    const control = await prisma.weighingControl.findUnique({ where: { id: parsed.control_id } });
    if (!control) return res.status(400).json({ error: 'Invalid control_id' });
    
    // ⚠️ PROTEÇÃO: Validar se o controle está aberto
    if ((control as any).status !== 'open') {
      console.log('🚫 [TOTEM] Controle fechado:', parsed.control_id);
      return res.status(400).json({ error: 'Control is closed' });
    }

    let tare = 0;
    let cageId: string | null = null;
    if (parsed.cage_id) {
      const cage = await prisma.cage.findUnique({ where: { id: parsed.cage_id } });
      if (!cage) return res.status(400).json({ error: 'Invalid cage_id' });
      cageId = cage.id;
      tare = Number(cage.tareWeight as any);
    } else if (parsed.peso_tara !== undefined) {
      tare = parsed.peso_tara;
    } else {
      return res.status(400).json({ error: 'Provide cage_id or peso_tara' });
    }

    const total = parsed.peso_total;
    const net = Math.max(0, Number((total - tare).toFixed(2)));
    
    // ⚠️ PROTEÇÃO CRÍTICA: Verificar se já existem pesagens no controle
    const existingEntries = await prisma.weighingEntry.count({
      where: { controlId: parsed.control_id }
    });
    
    if (existingEntries > 0) {
      console.log('🚫 [TOTEM] CONTROLE já possui pesagens - bloqueando para evitar sobrescrita:', {
        controlId: parsed.control_id,
        existingCount: existingEntries
      });
      return res.status(400).json({ error: 'Control already has entries - cannot add more to prevent data loss' });
    }
    
    // ⚠️ PROTEÇÃO: Verificar duplicação (mesma gaiola/peso nos últimos 5 segundos)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await prisma.weighingEntry.findFirst({
      where: {
        controlId: parsed.control_id,
        cageId: cageId,
        totalWeight: String(total),
        netWeight: String(net),
        createdAt: { gte: fiveSecondsAgo }
      }
    });
    
    if (recentDuplicate) {
      console.log('🚫 [TOTEM] DUPLICATA detectada e bloqueada:', {
        controlId: parsed.control_id,
        cageId,
        total,
        net,
        existingId: recentDuplicate.id
      });
      return res.status(400).json({ error: 'Duplicate entry detected (same cage/weight in last 5 seconds)' });
    }
    
    // Usar transaction para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.weighingEntry.create({
        data: {
          controlId: parsed.control_id,
          cageId,
          tareWeight: String(tare),
          totalWeight: String(total),
          netWeight: String(net)
        } as any
      });
      
      console.log('✅ [TOTEM] Pesagem criada:', created.id);
      
      // Recalcular peso inline
      const agg = await tx.weighingEntry.aggregate({
        _sum: { netWeight: true },
        where: { controlId: parsed.control_id }
      });
      const totalNet = Number(agg._sum.netWeight || 0);
      const gross = Number((control as any).laundryGrossWeight);
      const diff = Number((gross - totalNet).toFixed(2));
      const percent = gross > 0 ? Number(((Math.abs(diff) / gross) * 100).toFixed(2)) : 0;
      
      const updatedControl = await tx.weighingControl.update({
        where: { id: parsed.control_id },
        data: {
          clientTotalNetWeight: String(totalNet),
          differenceWeight: String(diff),
          differencePercent: String(percent)
        } as any
      });
      
      return { created, updatedControl };
    });

    res.status(201).json({ entry: result.created });
  } catch (e) { next(e); }
});

app.get('/api/public/totem/pesagens/relatorio', requireApiKey, async (req, res, next) => {
  try {
    const start = String(req.query.start || '').trim();
    const end = String(req.query.end || '').trim();
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

    const where: any = { clientId };
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) where.referenceDate = Object.assign(where.referenceDate || {}, { gte: new Date(`${start}T00:00:00-03:00`) });
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) where.referenceDate = Object.assign(where.referenceDate || {}, { lte: new Date(`${end}T23:59:59-03:00`) });

    const controls = await prisma.weighingControl.findMany({ where, select: { id: true, referenceDate: true, expectedDeliveryDate: true, kind: true, clientTotalNetWeight: true } });
    const map = new Map<string, { date: string; suja: number; limpa: number }>();
    for (const c of controls) {
      const totalNet = Number(c.clientTotalNetWeight as any) || 0;
      if (c.kind === 'suja') {
        const d = (c.expectedDeliveryDate ?? c.referenceDate) as any;
        const date = new Date(d).toISOString().split('T')[0];
        if (!map.has(date)) map.set(date, { date, suja: 0, limpa: 0 });
        map.get(date)!.suja += totalNet;
      } else {
        const date = new Date(c.referenceDate as any).toISOString().split('T')[0];
        if (!map.has(date)) map.set(date, { date, suja: 0, limpa: 0 });
        map.get(date)!.limpa += totalNet;
      }
    }
    const result = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(r => {
      const suja = r.suja;
      const limpa = r.limpa;
      const diff = suja - limpa;
      const perc = limpa > 0 ? Number(((diff / limpa) * 100).toFixed(2)) : 0;
      return { date: r.date, peso_suja: Number(suja.toFixed(2)), peso_limpa: Number(limpa.toFixed(2)), diferenca: Number(diff.toFixed(2)), sujidade_percentual: perc };
    });
    res.json(result);
  } catch (e) { next(e); }
});

const publicDistributeSchema = z.object({
  linenItemId: z.string().min(1),
  bedId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().optional().nullable()
});

app.post('/api/public/totem/distribute', requireApiKey, async (req, res, next) => {
  try {
    const parsed = publicDistributeSchema.parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: parsed.bedId }, include: { sector: true } });
    if (!bed) return res.status(400).json({ error: 'Invalid bedId' });
    const item = await prisma.linenItem.findUnique({ where: { id: parsed.linenItemId } });
    if (!item) return res.status(400).json({ error: 'Invalid linenItemId' });

    const created = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < parsed.quantity; i++) {
        await tx.distributedItem.create({ data: { linenItemId: parsed.linenItemId, bedId: parsed.bedId, status: 'allocated', clientId: bed.sector?.clientId ?? null } as any });
      }
      const freshItem = await tx.linenItem.findUnique({ where: { id: parsed.linenItemId } });
      const current = freshItem ? freshItem.currentStock : (item as any).currentStock;
      const newStock = Math.max(0, Number(current) - parsed.quantity);
      await tx.linenItem.update({ where: { id: parsed.linenItemId }, data: { currentStock: newStock } });
      const reason = (parsed.reason && parsed.reason.trim().length > 0) ? parsed.reason.trim() : 'Distribuição via Totem (API pública)';
      await tx.stockMovement.create({ data: { itemId: parsed.linenItemId, type: 'out', quantity: parsed.quantity, reason, clientId: bed.sector?.clientId ?? null } });
      return { newStock };
    });
    res.status(201).json({ ok: true, itemId: parsed.linenItemId, bedId: parsed.bedId, quantity: parsed.quantity, newStock: (created as any).newStock });
  } catch (e) { next(e); }
});

// POST /api/public/totem/orders - Create order from totem
const publicOrderSchema = z.object({
  bedId: z.string().min(1),
  items: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().int().positive()
  })).min(1),
  observations: z.string().optional().nullable()
});

app.post('/api/public/totem/orders', requireApiKey, async (req, res, next) => {
  try {
    const parsed = publicOrderSchema.parse(req.body);
    
    // Validate bed exists
    const bed = await prisma.bed.findUnique({
      where: { id: parsed.bedId },
      include: { sector: true }
    });
    if (!bed) return res.status(400).json({ error: 'Invalid bedId' });

    // Validate all items exist
    for (const item of parsed.items) {
      const exists = await prisma.linenItem.findUnique({
        where: { id: item.itemId }
      });
      if (!exists) {
        return res.status(400).json({
          error: 'Invalid itemId',
          itemId: item.itemId
        });
      }
    }

    // Create order with items
    const order = await prisma.order.create({
      data: {
        bedId: parsed.bedId,
        observations: parsed.observations ?? null,
        status: 'pending',
        items: {
          create: parsed.items.map(item => ({
            itemId: item.itemId,
            quantity: item.quantity
          }))
        }
      },
      include: {
        items: {
          include: {
            item: {
              select: { id: true, name: true, sku: true, unit: true }
            }
          }
        },
        bed: {
          include: {
            sector: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.status(201).json(order);
  } catch (e) { next(e); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});


