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

const app = express();
const prisma = new PrismaClient();

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
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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
// Uploads
app.post('/uploads', upload.single('file'), (req, res) => {
  const url = `/uploads/${req.file?.filename}`;
  res.status(201).json({ url });
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
    const token = jwt.sign({ sub: user.id, role: user.role, clientId: user.clientId ?? undefined }, JWT_SECRET, { expiresIn: '12h' });
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

// Sectors CRUD
const sectorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

app.get('/sectors', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const where = req.user.role === 'manager' && req.user.clientId ? { clientId: req.user.clientId as string } : {};
    const data = await prisma.sector.findMany({ where, include: { client: true } });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/sectors', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = sectorSchema.parse(req.body);
    // managers can only create sector for their own client
    const clientId = req.user.role === 'manager' ? req.user.clientId : (parsed.clientId ?? null);
    const created = await prisma.sector.create({ data: { name: parsed.name, description: parsed.description ?? null, clientId } });
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
    const updated = await prisma.sector.update({ where: { id: req.params.id }, data: parsed });
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

app.get('/beds', async (_req, res, next) => {
  try {
    const data = await prisma.bed.findMany({ include: { sector: true } });
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
const itemSchema = z.object({ name: z.string().min(1), sku: z.string().min(1), unit: z.string().min(1), currentStock: z.number().int().nonnegative().default(0), minimumStock: z.number().int().nonnegative().default(0) });

app.get('/items', requireAuth(['admin','manager']), async (_req, res, next) => {
  try {
    const data = await prisma.linenItem.findMany();
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/items', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = itemSchema.parse(req.body);
    const created = await prisma.linenItem.create({ data: parsed });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/items/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const parsed = itemSchema.partial().parse(req.body);
    const updated = await prisma.linenItem.update({ where: { id: req.params.id }, data: parsed });
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
const orderSchema = z.object({ bedId: z.string().min(1), items: z.array(orderItemInput).min(1), observations: z.string().optional().nullable(), scheduledDelivery: z.string().datetime().optional().nullable() });

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
    }
    const data = await prisma.order.findMany({ where, include: { items: { include: { item: true } }, bed: { include: { sector: true } } } });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/orders', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const parsed = orderSchema.parse(req.body);
    const bed = await prisma.bed.findUnique({ where: { id: parsed.bedId }, include: { sector: true } });
    if (!bed) return res.status(400).json({ error: 'Invalid bedId' });
    if (req.user.role === 'manager' && bed.sector.clientId && req.user.clientId !== bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({ data: { bedId: parsed.bedId, status: 'pending', observations: parsed.observations ?? null, scheduledDelivery: parsed.scheduledDelivery ? new Date(parsed.scheduledDelivery) : null } });
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
    res.status(201).json(result);
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

// Stock movements
const movementSchema = z.object({ itemId: z.string().min(1), type: z.enum(['in','out']), quantity: z.number().int().positive(), reason: z.string().min(1), orderId: z.string().optional().nullable() });

app.get('/stock-movements', requireAuth(['admin','manager']), async (req: any, res, next) => {
  try {
    const data = await prisma.stockMovement.findMany({ include: { item: true } });
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
    if (!order) return res.status(404).end();
    if (req.user.role === 'manager' && order.bed.sector.clientId && req.user.clientId !== order.bed.sector.clientId) return res.status(403).json({ error: 'Forbidden' });
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
  } catch (e) { next(e); }
});

// Basic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'ValidationError', details: err.errors });
  }
  res.status(500).json({ error: 'InternalServerError' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});


