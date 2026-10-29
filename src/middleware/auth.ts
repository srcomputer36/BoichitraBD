import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';
import { adminSessions, auditLogs, users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name: string;
  };
  adminRecord?: typeof users.$inferSelect;
  sessionTokenHash?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('bbd_admin_session=')) {
        return decodeURIComponent(c.slice('bbd_admin_session='.length));
      }
    }
  }
  return null;
}

export async function createAdminSession(userId: number): Promise<string> {
  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(adminSessions).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return rawToken;
  } catch (error) {
    console.error('Failed to create admin session:', error);
    throw new Error('অ্যাডমিন সেশন তৈরি করতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function getAdminUserBySessionToken(rawToken: string | null) {
  if (!rawToken) return null;
  try {
    const tokenHash = hashSessionToken(rawToken);
    const sessions = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.tokenHash, tokenHash));

    const session = sessions[0];
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
      return null;
    }

    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId));

    const adminUser = foundUsers[0];
    if (!adminUser || !adminUser.isActive) return null;

    return { adminUser, tokenHash };
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return null;
  }
}

export const requireAdminAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const rawToken = extractTokenFromRequest(req);
  if (!rawToken) {
    return res
      .status(401)
      .json({ error: 'অনুমোদনহীন অ্যাক্সেস: অনুগ্রহ করে অ্যাডমিন প্যানেলে লগইন করুন।' });
  }

  const verified = await getAdminUserBySessionToken(rawToken);
  if (!verified) {
    return res
      .status(401)
      .json({ error: 'আপনার লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।' });
  }

  req.adminRecord = verified.adminUser;
  req.sessionTokenHash = verified.tokenHash;
  req.user = {
    uid: verified.adminUser.uid,
    email: verified.adminUser.email,
    name: verified.adminUser.name || 'Admin',
  };
  next();
};

export async function checkAdminSetupStatus() {
  try {
    const allAdmins = await db.select().from(users);
    const configuredAdmins = allAdmins.filter(
      (u) => u.passwordHash && u.passwordHash.includes(':') && u.isActive
    );
    return {
      isSetupComplete: configuredAdmins.length > 0,
    };
  } catch (error) {
    console.error('Failed to check admin setup status:', error);
    throw new Error('অ্যাডমিন স্ট্যাটাস যাচাই করা যায়নি।', { cause: error });
  }
}

export async function setupInitialAdminAccount(payload: {
  email: string;
  name: string;
  password: string;
}) {
  try {
    const status = await checkAdminSetupStatus();
    if (status.isSetupComplete) {
      throw new Error('অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যে সেটআপ করা হয়েছে। অনুগ্রহ করে লগইন করুন।');
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim() || 'Boichitra Admin';
    const passwordHash = hashPassword(payload.password);
    const uid = `admin-${Date.now()}`;

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: cleanName,
        passwordHash,
        role: 'admin',
        isActive: true,
        lastLoginAt: new Date(),
      })
      .returning();

    const admin = inserted[0];
    const token = await createAdminSession(admin.id);

    await db.insert(auditLogs).values({
      actorEmail: admin.email,
      actorUid: admin.uid,
      action: 'ADMIN_INITIAL_SETUP',
      entityType: 'AdminUser',
      entityId: String(admin.id),
      details: `Initial admin account created for ${admin.email}`,
    });

    return { admin, token };
  } catch (error: any) {
    console.error('Failed to setup initial admin:', error);
    throw new Error(error.message || 'অ্যাডমিন অ্যাকাউন্ট তৈরি করা যায়নি।', { cause: error });
  }
}

export async function loginAdminWithPassword(identifier: string, password: string) {
  try {
    const cleanId = identifier.trim().toLowerCase();
    const allAdmins = await db.select().from(users);
    const matchingAdmin = allAdmins.find(
      (u) =>
        u.isActive &&
        (u.email.toLowerCase() === cleanId ||
          (u.name && u.name.toLowerCase() === cleanId))
    );

    if (!matchingAdmin || !matchingAdmin.passwordHash) {
      throw new Error('ইমেইল/ইউজারনেম অথবা পাসওয়ার্ড সঠিক নয়।');
    }

    const isValid = verifyPassword(password, matchingAdmin.passwordHash);
    if (!isValid) {
      throw new Error('ইমেইল/ইউজারনেম অথবা পাসওয়ার্ড সঠিক নয়।');
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, matchingAdmin.id));

    const token = await createAdminSession(matchingAdmin.id);

    await db.insert(auditLogs).values({
      actorEmail: matchingAdmin.email,
      actorUid: matchingAdmin.uid,
      action: 'ADMIN_LOGIN',
      entityType: 'AdminUser',
      entityId: String(matchingAdmin.id),
      details: 'Admin logged in via site password auth',
    });

    return { admin: matchingAdmin, token };
  } catch (error: any) {
    throw new Error(error.message || 'লগইন সম্পন্ন করা যায়নি।', { cause: error });
  }
}

export async function changeAdminCredentials(
  adminId: number,
  payload: {
    currentPassword: string;
    newEmail?: string;
    newName?: string;
    newPassword: string;
  }
) {
  try {
    const found = await db.select().from(users).where(eq(users.id, adminId));
    const admin = found[0];
    if (!admin || !admin.passwordHash) {
      throw new Error('অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।');
    }

    if (!verifyPassword(payload.currentPassword, admin.passwordHash)) {
      throw new Error('বর্তমান পাসওয়ার্ডটি সঠিক নয়।');
    }

    const updatedHash = hashPassword(payload.newPassword);
    const updatedEmail = payload.newEmail?.trim().toLowerCase() || admin.email;
    const updatedName = payload.newName?.trim() || admin.name || 'Admin';

    const updated = await db
      .update(users)
      .set({
        email: updatedEmail,
        name: updatedName,
        passwordHash: updatedHash,
      })
      .where(eq(users.id, adminId))
      .returning();

    await db.insert(auditLogs).values({
      actorEmail: updatedEmail,
      actorUid: admin.uid,
      action: 'CHANGE_ADMIN_PASSWORD',
      entityType: 'AdminUser',
      entityId: String(admin.id),
      details: `Updated admin password & profile (${updatedEmail})`,
    });

    return updated[0];
  } catch (error: any) {
    throw new Error(error.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি।', { cause: error });
  }
}
