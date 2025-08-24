import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
// Uploads
app.post('/uploads', upload.single('file'), (req, res) => {
  const url = `/uploads/${req.file?.filename}`;
  res.status(201).json({ url });
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

app.get('/clients', async (_req, res, next) => {
  try {
    const data = await prisma.client.findMany();
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/clients', async (req, res, next) => {
  try {
    const parsed = clientSchema.parse(req.body);
    const created = await prisma.client.create({ data: parsed });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

app.put('/clients/:id', async (req, res, next) => {
  try {
    const parsed = clientSchema.partial().parse(req.body);
    const updated = await prisma.client.update({ where: { id: req.params.id }, data: parsed });
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/clients/:id', async (req, res, next) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Confirm delivery
const confirmSchema = z.object({
  receiverName: z.string().min(1),
  confirmationType: z.enum(['signature', 'photo']),
  confirmationUrl: z.string().url(),
  deliveredByUserId: z.string().optional().nullable(),
});

app.put('/orders/:id/confirm-delivery', async (req, res, next) => {
  try {
    const parsed = confirmSchema.parse(req.body);
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


