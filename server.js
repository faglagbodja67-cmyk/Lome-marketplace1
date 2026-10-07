import http from 'node:http';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8080);
const usersFile = path.join(__dirname, 'storage', 'users.json');
const adminFile = path.join(__dirname, 'storage', 'admin.json');
const newsletterFile = path.join(__dirname, 'storage', 'newsletter.json');
const vendorPaymentSettingsFile = path.join(__dirname, 'storage', 'vendor-payment-settings.json');
const paymentLedgerFile = path.join(__dirname, 'storage', 'payment-ledger.json');
const scrypt = promisify(scryptCallback);
const sessions = new Map();
const passwordResetTokens = new Map();
const adminLoginFailures = new Map();
let userWriteQueue = Promise.resolve();
let newsletterWriteQueue = Promise.resolve();
let vendorPaymentSettingsWriteQueue = Promise.resolve();

class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const data = {
  categories: [
    { icon: '📱', name: 'Électronique' },
    { icon: '📞', name: 'Téléphones' },
    { icon: '💻', name: 'Informatique' },
    { icon: '👗', name: 'Mode' },
    { icon: '🏠', name: 'Maison' },
    { icon: '🌾', name: 'Agriculture' },
  ],

  products: [
    {
      id: 1,
      name: 'Samsung Galaxy A25',
      category: 'Téléphones',
      vendor: 'Asetek Togo',
      price: 285000,
      oldPrice: 345000,
      rating: 4.8,
      reviews: 214,
      location: 'Lomé',
      verified: true,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 2,
      name: 'iPhone 14 Pro Max',
      category: 'Téléphones',
      vendor: 'MobiWorld',
      price: 690000,
      oldPrice: 760000,
      rating: 4.9,
      reviews: 146,
      location: 'Kpémé',
      verified: true,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 3,
      name: 'Ordinateur portable HP EliteBook',
      category: 'Informatique',
      vendor: 'Digitale Solutions',
      price: 520000,
      oldPrice: 610000,
      rating: 4.7,
      reviews: 96,
      location: 'Atakpamé',
      verified: false,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 4,
      name: 'Sac premium en cuir',
      category: 'Mode',
      vendor: 'Nana Style',
      price: 96000,
      oldPrice: 130000,
      rating: 4.6,
      reviews: 132,
      location: 'Lomé',
      verified: true,
      inStock: false,
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 5,
      name: 'Mixeur professionnel 800W',
      category: 'Maison',
      vendor: 'EcoHome',
      price: 44000,
      oldPrice: 56000,
      rating: 4.5,
      reviews: 88,
      location: 'Lomé',
      verified: true,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 6,
      name: 'Pompes agricoles 3HP',
      category: 'Agriculture',
      vendor: 'AgriPlus',
      price: 182000,
      oldPrice: 225000,
      rating: 4.8,
      reviews: 64,
      location: 'Sokodé',
      verified: true,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 7,
      name: 'Montre connectée Pro',
      category: 'Électronique',
      vendor: 'TopWatch',
      price: 58000,
      oldPrice: 68000,
      rating: 4.7,
      reviews: 112,
      location: 'Lomé',
      verified: false,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 8,
      name: 'Pack mode premium',
      category: 'Mode',
      vendor: 'Styled',
      price: 77000,
      oldPrice: 93000,
      rating: 4.6,
      reviews: 75,
      location: 'Lomé',
      verified: true,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
    },
  ],

  stores: [
    { name: 'Asetek Togo', sector: 'Téléphones', location: 'Lomé', products: 1, rating: 4.9, verified: true, logo: 'AT' },
    { name: 'MobiWorld', sector: 'Téléphones', location: 'Kpémé', products: 1, rating: 4.8, verified: true, logo: 'MW' },
    { name: 'AgriPlus', sector: 'Agriculture', location: 'Sokodé', products: 1, rating: 4.7, verified: true, logo: 'AP' },
    { name: 'Nana Style', sector: 'Mode & Accessoires', location: 'Lomé', products: 1, rating: 4.6, verified: true, logo: 'NS' },
  ],

  vendors: [
    'Asetek Togo',
    'MobiWorld',
    'AgriPlus',
    'Nana Style',
    'EcoHome',
    'Styled',
  ],

  faq: [
    'Comment acheter ?',
    'Comment devenir vendeur ?',
    'Comment créer une boutique ?',
    'Comment demander un devis ?',
    'Comment payer ?',
    'Comment suivre ma commande ?',
    'Comment contacter un vendeur ?',
    'Comment signaler un problème ?',
  ],
};

data.categories = data.categories.map((category) => ({
  ...category,
  count: data.products.filter((product) => product.category === category.name).length,
}));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const informationPagePaths = new Set([
  '/a-propos',
  '/contact',
  '/devenir-vendeur',
  '/centre-aide',
  '/faq',
  '/comment-acheter',
  '/paiement',
  '/livraison',
  '/retours',
  '/litiges',
  '/comment-vendre',
  '/creer-boutique',
  '/tarifs',
  '/publicite',
  '/centre-vendeur',
  '/cgu',
  '/confidentialite',
  '/cookies',
  '/conditions-vendeur',
]);

const sendJson = (res, payload, statusCode = 200) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
};

const normalizeText = (value) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16 * 1024) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (tooLarge) {
        reject(new ApiError('La requête est trop volumineuse.', 413));
        return;
      }

      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new ApiError('Le format de la requête est invalide.', 400);
        }
        resolve(body);
      } catch (error) {
        reject(error instanceof ApiError ? error : new ApiError('JSON invalide.', 400));
      }
    });
  });

const loadUsers = async () => {
  try {
    return JSON.parse(await fsPromises.readFile(usersFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const loadNewsletterSubscribers = async () => {
  try {
    return JSON.parse(await fsPromises.readFile(newsletterFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const loadVendorPaymentSettings = async () => {
  try {
    return JSON.parse(await fsPromises.readFile(vendorPaymentSettingsFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const updateVendorPaymentSettings = (update) => {
  const operation = vendorPaymentSettingsWriteQueue.then(async () => {
    const settings = await loadVendorPaymentSettings();
    const result = await update(settings);
    await fsPromises.mkdir(path.dirname(vendorPaymentSettingsFile), { recursive: true });
    const temporaryFile = path.join(path.dirname(vendorPaymentSettingsFile), `vendor-payments-${randomUUID()}.tmp`);
    await fsPromises.writeFile(temporaryFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
    await fsPromises.rename(temporaryFile, vendorPaymentSettingsFile);
    return result;
  });
  vendorPaymentSettingsWriteQueue = operation.catch(() => {});
  return operation;
};

const loadPaymentLedger = async () => {
  try {
    return JSON.parse(await fsPromises.readFile(paymentLedgerFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const normalizeTogoMobileNumber = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const digits = value.replace(/\D/g, '');
  const localNumber = digits.startsWith('228') && digits.length === 11 ? digits.slice(3) : digits;
  if (!/^\d{8}$/.test(localNumber)) {
    throw new ApiError('Saisissez un numéro mobile togolais valide de 8 chiffres, avec ou sans +228.', 400);
  }
  return `+228${localNumber}`;
};

const updateNewsletterSubscribers = (update) => {
  const operation = newsletterWriteQueue.then(async () => {
    const subscribers = await loadNewsletterSubscribers();
    const result = await update(subscribers);
    await fsPromises.mkdir(path.dirname(newsletterFile), { recursive: true });
    const temporaryFile = path.join(path.dirname(newsletterFile), `newsletter-${randomUUID()}.tmp`);
    await fsPromises.writeFile(temporaryFile, JSON.stringify(subscribers, null, 2), { mode: 0o600 });
    await fsPromises.rename(temporaryFile, newsletterFile);
    return result;
  });
  newsletterWriteQueue = operation.catch(() => {});
  return operation;
};

const loadAdminConfig = async () => {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    return {
      email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
      salt: null,
      passwordHash: null,
      environmentPassword: process.env.ADMIN_PASSWORD,
    };
  }

  if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
    throw new ApiError('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis ensemble.', 503);
  }

  try {
    return JSON.parse(await fsPromises.readFile(adminFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const updateUsers = (update) => {
  const operation = userWriteQueue.then(async () => {
    const users = await loadUsers();
    const result = await update(users);
    await fsPromises.mkdir(path.dirname(usersFile), { recursive: true });
    const temporaryFile = path.join(path.dirname(usersFile), `users-${randomUUID()}.tmp`);
    await fsPromises.writeFile(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 });
    await fsPromises.rename(temporaryFile, usersFile);
    return result;
  });
  userWriteQueue = operation.catch(() => {});
  return operation;
};

const writeFirstAdmin = async (admin) => {
  await fsPromises.mkdir(path.dirname(adminFile), { recursive: true });
  try {
    await fsPromises.writeFile(adminFile, JSON.stringify(admin, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new ApiError('Le compte administrateur est déjà configuré. Connectez-vous.', 409);
    }
    throw error;
  }
};

const getSessionUser = async (req) => {
  const cookie = req.headers.cookie || '';
  const sessionCookie = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('lome_session='));
  if (!sessionCookie) return null;

  const token = decodeURIComponent(sessionCookie.slice('lome_session='.length));
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  if (session.role === 'admin') {
    return { id: 'admin', name: session.name || 'Administrateur', email: session.email, role: 'admin' };
  }

  const users = await loadUsers();
  const user = users.find((entry) => entry.id === session.userId);
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role || 'buyer' } : null;
};

const createSession = (res, userId) => {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', `lome_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
};

const createAdminSession = (res, email, name = 'Administrateur') => {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, {
    role: 'admin',
    email,
    name,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  res.setHeader('Set-Cookie', `lome_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
};

const clearSession = (req, res) => {
  const cookie = req.headers.cookie || '';
  const sessionCookie = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('lome_session='));
  if (sessionCookie) {
    const token = decodeURIComponent(sessionCookie.slice('lome_session='.length));
    sessions.delete(token);
  }
  res.setHeader('Set-Cookie', 'lome_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
};

const hashPassword = async (password, salt = randomBytes(16)) => ({
  salt: salt.toString('hex'),
  passwordHash: (await scrypt(password, salt, 64)).toString('hex'),
});

const passwordPolicyError = (password) => {
  if (password.length < 8 || password.length > 128) {
    return 'Le mot de passe doit contenir entre 8 et 128 caractères.';
  }
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return null;
};

const handleRequest = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, { error: 'Les requêtes API doivent utiliser la même origine que le site.' }, 400);
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/health') {
      sendJson(res, { status: 'ok', app: 'LOME MARKETPLACE' });
      return;
    }

    if (pathname === '/api/newsletter/subscribe' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const action = body.action;
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError('Veuillez saisir une adresse e-mail valide.', 400);
      }
      if (action !== 'subscribe' && action !== 'unsubscribe') {
        throw new ApiError('Action newsletter invalide.', 400);
      }
      if (action === 'subscribe' && body.consent !== true) {
        throw new ApiError('Votre accord est nécessaire pour recevoir la newsletter.', 400);
      }

      const result = await updateNewsletterSubscribers((subscribers) => {
        const existingIndex = subscribers.findIndex((subscriber) => subscriber.email === email);
        if (action === 'unsubscribe') {
          if (existingIndex !== -1) subscribers.splice(existingIndex, 1);
          return {
            statusCode: 200,
            message: existingIndex === -1
              ? 'Cette adresse ne figure pas dans la liste de diffusion.'
              : 'Votre adresse a été retirée de la newsletter.',
          };
        }
        if (existingIndex !== -1) {
          return { statusCode: 200, message: 'Cette adresse est déjà inscrite à la newsletter.' };
        }
        subscribers.push({ email, subscribedAt: new Date().toISOString() });
        return { statusCode: 201, message: 'Votre inscription à la newsletter est confirmée.' };
      });
      sendJson(res, { message: result.message }, result.statusCode);
      return;
    }

    if (pathname === '/api/payments/config' && req.method === 'GET') {
      sendJson(res, {
        commissionRate: 0.035,
        collectionMethods: ['TMoney', 'Flooz'],
        checkoutAvailable: false,
        status: 'provider_setup_required',
        message: 'Le paiement sera activé après raccordement d’un prestataire agréé et validation des comptes marchands.',
      });
      return;
    }

    if (pathname === '/api/vendor/payment-settings'
      && (req.method === 'GET' || req.method === 'PUT')) {
      const user = await getSessionUser(req);
      if (!user) throw new ApiError('Connectez-vous pour accéder à vos réglages de paiement.', 401);
      if (user.role !== 'vendor') throw new ApiError('Ces réglages sont réservés aux comptes vendeurs.', 403);

      if (req.method === 'GET') {
        const settings = await loadVendorPaymentSettings();
        const ownSettings = settings.find((entry) => entry.userId === user.id);
        sendJson(res, {
          tmoneyNumber: ownSettings?.tmoneyNumber || '',
          floozNumber: ownSettings?.floozNumber || '',
          updatedAt: ownSettings?.updatedAt || null,
        });
        return;
      }

      const body = await readJsonBody(req);
      const tmoneyNumber = normalizeTogoMobileNumber(body.tmoneyNumber);
      const floozNumber = normalizeTogoMobileNumber(body.floozNumber);
      if (!tmoneyNumber && !floozNumber) {
        throw new ApiError('Renseignez au moins un numéro TMoney ou Flooz.', 400);
      }
      const savedSettings = await updateVendorPaymentSettings((settings) => {
        const nextSettings = {
          userId: user.id,
          tmoneyNumber,
          floozNumber,
          updatedAt: new Date().toISOString(),
        };
        const existingIndex = settings.findIndex((entry) => entry.userId === user.id);
        if (existingIndex === -1) settings.push(nextSettings);
        else settings[existingIndex] = nextSettings;
        return nextSettings;
      });
      sendJson(res, {
        tmoneyNumber: savedSettings.tmoneyNumber,
        floozNumber: savedSettings.floozNumber,
        updatedAt: savedSettings.updatedAt,
      });
      return;
    }

    if (pathname === '/api/payments/checkout' && req.method === 'POST') {
      const user = await getSessionUser(req);
      if (!user || user.role === 'admin') {
        throw new ApiError('Connectez-vous avec un compte acheteur pour continuer.', 401);
      }
      throw new ApiError('Le paiement TMoney/Flooz n’est pas encore connecté. Aucun montant n’a été débité.', 503);
    }

    if (pathname === '/api/admin/status' && req.method === 'GET') {
      const admin = await loadAdminConfig();
      const hasPartialEnvironmentConfig = Boolean(process.env.ADMIN_EMAIL) !== Boolean(process.env.ADMIN_PASSWORD);
      sendJson(res, {
        configured: Boolean(admin),
        canSetup: !admin && !hasPartialEnvironmentConfig && process.env.NODE_ENV !== 'production',
      });
      return;
    }

    if (pathname === '/api/admin/setup' && req.method === 'POST') {
      if (process.env.NODE_ENV === 'production' || process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
        throw new ApiError('Configurez le compte administrateur dans l’environnement du serveur.', 403);
      }

      const body = await readJsonBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (name.length < 2 || name.length > 80) {
        throw new ApiError('Le nom doit contenir entre 2 et 80 caractères.', 400);
      }
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError('Veuillez saisir une adresse e-mail valide.', 400);
      }
      const passwordError = passwordPolicyError(password);
      if (passwordError) throw new ApiError(passwordError, 400);

      const existingConfig = await loadAdminConfig();
      if (existingConfig) throw new ApiError('Le compte administrateur est déjà configuré. Connectez-vous.', 409);
      const credentials = await hashPassword(password);
      await writeFirstAdmin({ name, email, ...credentials });
      createAdminSession(res, email, name);
      sendJson(res, { user: { id: 'admin', name, email, role: 'admin' } }, 201);
      return;
    }

    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const now = Date.now();
      const failures = adminLoginFailures.get(email);
      if (failures && failures.lockedUntil > now) {
        throw new ApiError('Trop de tentatives. Réessayez dans quelques minutes.', 429);
      }

      const admin = await loadAdminConfig();
      if (!admin) throw new ApiError('Le compte administrateur n’est pas encore configuré.', 503);

      let credentialsValid = false;
      if (admin.environmentPassword !== undefined) {
        const submittedHash = createHash('sha256').update(password).digest();
        const configuredHash = createHash('sha256').update(admin.environmentPassword).digest();
        credentialsValid = timingSafeEqual(submittedHash, configuredHash);
      } else if (admin.salt && admin.passwordHash) {
        const submittedHash = await scrypt(password, Buffer.from(admin.salt, 'hex'), 64);
        const configuredHash = Buffer.from(admin.passwordHash, 'hex');
        credentialsValid = submittedHash.length === configuredHash.length
          && timingSafeEqual(submittedHash, configuredHash);
      }

      if (email !== admin.email || !credentialsValid) {
        const attempts = failures && failures.lockedUntil <= now ? failures.attempts : (failures?.attempts || 0);
        const nextAttempts = attempts + 1;
        adminLoginFailures.set(email, {
          attempts: nextAttempts,
          lockedUntil: nextAttempts >= 5 ? now + 5 * 60 * 1000 : 0,
        });
        throw new ApiError('Adresse e-mail ou mot de passe administrateur incorrect.', 401);
      }

      adminLoginFailures.delete(email);
      createAdminSession(res, admin.email);
      sendJson(res, { user: { id: 'admin', name: admin.name || 'Administrateur', email: admin.email, role: 'admin' } });
      return;
    }

    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const user = await getSessionUser(req);
      if (!user || user.role !== 'admin') {
        throw new ApiError('Accès réservé aux administrateurs.', 403);
      }
      const users = await loadUsers();
      const paymentLedger = await loadPaymentLedger();
      const confirmedPayments = paymentLedger.filter((payment) => payment.status === 'paid'
        && Number.isSafeInteger(payment.grossAmount)
        && payment.grossAmount > 0
        && Number.isSafeInteger(payment.commissionAmount)
        && payment.commissionAmount === Math.round(payment.grossAmount * 0.035)
        && ['TMoney', 'Flooz'].includes(payment.method)
        && typeof payment.id === 'string'
        && typeof payment.paidAt === 'string'
        && Number.isFinite(Date.parse(payment.paidAt))
        && typeof payment.buyerEmail === 'string');
      const grossRevenue = confirmedPayments.reduce((total, payment) => total + payment.grossAmount, 0);
      const platformRevenue = confirmedPayments.reduce((total, payment) => total + payment.commissionAmount, 0);
      const sellerPayouts = confirmedPayments.reduce((total, payment) => total + payment.grossAmount - payment.commissionAmount, 0);
      const vendorPaymentSettings = await loadVendorPaymentSettings();
      sendJson(res, {
        stats: {
          products: data.products.length,
          stores: data.stores.length,
          vendors: data.vendors.length,
          accounts: users.length,
        },
        payments: {
          currency: 'XOF',
          commissionRate: 0.035,
          confirmedCount: confirmedPayments.length,
          grossRevenue,
          platformRevenue,
          sellerPayouts,
          methods: ['TMoney', 'Flooz'],
          checkoutAvailable: false,
          vendorProfilesConfigured: vendorPaymentSettings.length,
        },
        paymentLedger: confirmedPayments.map((payment) => ({
          id: payment.id,
          paidAt: payment.paidAt,
          buyerEmail: payment.buyerEmail,
          method: payment.method,
          grossAmount: payment.grossAmount,
          commissionAmount: payment.commissionAmount,
          sellerPayout: payment.grossAmount - payment.commissionAmount,
        })),
        users: users.map(({ id, name, email, role }) => ({ id, name, email, role: role || 'buyer' })),
        products: data.products.map(({ id, name, vendor, category, price, inStock }) => ({
          id, name, vendor, category, price, inStock,
        })),
      });
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const role = body.accountType || 'buyer';
      if (name.length < 2 || name.length > 80) {
        throw new ApiError('Le nom doit contenir entre 2 et 80 caractères.', 400);
      }
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError('Veuillez saisir une adresse e-mail valide.', 400);
      }
      const passwordError = passwordPolicyError(password);
      if (passwordError) throw new ApiError(passwordError, 400);
      if (role !== 'buyer' && role !== 'vendor') {
        throw new ApiError('Le type de compte demandé est invalide.', 400);
      }

      const user = await updateUsers(async (users) => {
        if (users.some((entry) => entry.email === email)) {
          throw new ApiError('Cette adresse e-mail est déjà utilisée.', 409);
        }
        const credentials = await hashPassword(password);
        const createdUser = { id: randomUUID(), name, email, role, ...credentials };
        users.push(createdUser);
        return { id: createdUser.id, name: createdUser.name, email: createdUser.email, role: createdUser.role };
      });
      createSession(res, user.id);
      sendJson(res, { user }, 201);
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const users = await loadUsers();
      const user = users.find((entry) => entry.email === email);
      if (!user || !password) throw new ApiError('Adresse e-mail ou mot de passe incorrect.', 401);

      const salt = Buffer.from(user.salt, 'hex');
      const candidateHash = await scrypt(password, salt, 64);
      const storedHash = Buffer.from(user.passwordHash, 'hex');
      if (storedHash.length !== candidateHash.length || !timingSafeEqual(storedHash, candidateHash)) {
        throw new ApiError('Adresse e-mail ou mot de passe incorrect.', 401);
      }

      const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role || 'buyer' };
      createSession(res, user.id);
      sendJson(res, { user: publicUser });
      return;
    }

    if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError('Veuillez saisir une adresse e-mail valide.', 400);
      }

      const users = await loadUsers();
      const userExists = users.some((entry) => entry.email === email);
      const response = { message: 'Si cette adresse est associée à un compte, les instructions de réinitialisation seront disponibles.' };
      if (userExists) {
        for (const [storedEmail, reset] of passwordResetTokens) {
          if (reset.expiresAt <= Date.now()) passwordResetTokens.delete(storedEmail);
        }
        const token = randomBytes(32).toString('hex');
        passwordResetTokens.set(email, {
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: Date.now() + 15 * 60 * 1000,
        });
        if (process.env.NODE_ENV !== 'production') response.resetToken = token;
      }
      sendJson(res, response);
      return;
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const passwordError = passwordPolicyError(password);
      if (passwordError) throw new ApiError(passwordError, 400);

      const reset = passwordResetTokens.get(email);
      const tokenHash = createHash('sha256').update(token).digest();
      const expectedHash = reset ? Buffer.from(reset.tokenHash, 'hex') : Buffer.alloc(0);
      if (!reset || reset.expiresAt <= Date.now()
        || tokenHash.length !== expectedHash.length
        || !timingSafeEqual(tokenHash, expectedHash)) {
        throw new ApiError('Le code est invalide ou a expiré. Demandez un nouveau code.', 400);
      }

      const resetUserId = await updateUsers(async (users) => {
        const user = users.find((entry) => entry.email === email);
        if (!user) throw new ApiError('Le compte associé à ce code est introuvable.', 400);
        const credentials = await hashPassword(password);
        user.salt = credentials.salt;
        user.passwordHash = credentials.passwordHash;
        return user.id;
      });
      passwordResetTokens.delete(email);
      for (const [sessionToken, session] of sessions) {
        if (session.userId === resetUserId) {
          sessions.delete(sessionToken);
        }
      }
      res.setHeader('Set-Cookie', 'lome_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      sendJson(res, { message: 'Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.' });
      return;
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      sendJson(res, { user: await getSessionUser(req) });
      return;
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      clearSession(req, res);
      sendJson(res, { ok: true });
      return;
    }

    if (pathname === '/api/categories' && req.method === 'GET') {
      sendJson(res, data.categories);
      return;
    }

    if (pathname === '/api/products' && req.method === 'GET') {
      const search = normalizeText((url.searchParams.get('search') || '').trim());
      const terms = search ? search.split(/\s+/) : [];
      const filtered = !search
        ? data.products
        : data.products.filter((product) => {
            const haystack = normalizeText(`${product.name} ${product.category} ${product.vendor} ${product.location}`);
            return terms.every((term) => haystack.includes(term));
          });
      sendJson(res, filtered);
      return;
    }

    if (pathname === '/api/stores' && req.method === 'GET') {
      sendJson(res, data.stores);
      return;
    }

    if (pathname === '/api/vendors' && req.method === 'GET') {
      sendJson(res, data.vendors);
      return;
    }

    if (pathname === '/api/faq' && req.method === 'GET') {
      sendJson(res, data.faq);
      return;
    }

    if (pathname === '/preview' || pathname === '/preview.html' || pathname === '/verifie'
      || pathname === '/admin' || pathname === '/admin/login' || pathname === '/admin/dashboard'
      || pathname === '/index.html' || pathname === '/' || informationPagePaths.has(pathname)) {
      serveStaticFile(res, path.join(__dirname, 'preview.html'));
      return;
    }

    sendJson(res, { error: 'Page introuvable.' }, 404);
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, { error: error.message }, error.statusCode);
      return;
    }
    console.error('Erreur de traitement de la requête :', error);
    sendJson(res, { error: 'Une erreur interne est survenue.' }, 500);
  }
};

const serveStaticFile = (res, filePath) => {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Fichier introuvable');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const type = mimeTypes[extension] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
};

const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`LOME MARKETPLACE backend running on http://127.0.0.1:${PORT}`);
});
