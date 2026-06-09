/**
 * SMS Platform - Authentication Routes
 * POST /auth/register
 * POST /auth/login
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config, isMockMode } from '../config/index.js';
import { authenticate } from '../middleware/index.js';
import { RegisterInput, LoginInput, AuthResponse, ApiResponse, UserRole } from '../types/index.js';
import mockDb from '../db/mockDatabase.js';

const router = Router();

const SALT_ROUNDS = 12;

/**
 * POST /auth/register
 * Create a new user account
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: RegisterInput & { firstName?: string; lastName?: string } = req.body;

    // Validate input
    if (!input.email || !input.password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as ApiResponse);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as ApiResponse);
      return;
    }

    // Validate password strength
    if (input.password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as ApiResponse);
      return;
    }

    // Register via mock or real database
    if (isMockMode) {
      // Check if user already exists
      const existingUser = Array.from(mockDb.users.values()).find(
        u => u.email === input.email.toLowerCase()
      );

      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'An account with this email already exists',
        } as ApiResponse);
        return;
      }

      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      const role: UserRole = mockDb.users.size === 0 ? 'ADMIN' : 'USER';
      const id = mockDb.generateId();

      const user = {
        id,
        email: input.email.toLowerCase(),
        passwordHash,
        role,
        firstName: input.firstName || '',
        lastName: input.lastName || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.users.set(id, user);

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: parseInt(config.jwtExpiresIn, 10) }
      );

      res.status(201).json({
        success: true,
        data: { token, user: { id: user.id, email: user.email, role: user.role } } as AuthResponse,
      } as ApiResponse<AuthResponse>);
      return;
    }

    // Real database registration (imported dynamically)
    const { default: prisma } = await import('../prisma/client.js');

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      } as ApiResponse);
      return;
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const userCount = await prisma.user.count();
    const role: UserRole = userCount === 0 ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role,
      },
      select: { id: true, email: true, role: true },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'user_registered', ipAddress: req.ip || '' },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: parseInt(config.jwtExpiresIn, 10) }
    );

    res.status(201).json({
      success: true,
      data: { token, user } as AuthResponse,
    } as ApiResponse<AuthResponse>);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Failed to create account' } as ApiResponse);
  }
});

/**
 * POST /auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: LoginInput = req.body;

    if (!input.email || !input.password) {
      res.status(400).json({ success: false, error: 'Email and password are required' } as ApiResponse);
      return;
    }

    if (isMockMode) {
      // Find user in mock database
      const user = Array.from(mockDb.users.values()).find(
        u => u.email === input.email.toLowerCase()
      );

      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse);
        return;
      }

      const validPassword = await bcrypt.compare(input.password, user.passwordHash);
      if (!validPassword) {
        res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse);
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: parseInt(config.jwtExpiresIn, 10) }
      );

      res.json({
        success: true,
        data: { token, user: { id: user.id, email: user.email, role: user.role } } as AuthResponse,
      } as ApiResponse<AuthResponse>);
      return;
    }

    // Real database login
    const { default: prisma } = await import('../prisma/client.js');

    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse);
      return;
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse);
      return;
    }

    await prisma.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'user_login', ipAddress: req.ip || '' },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: parseInt(config.jwtExpiresIn, 10) }
    );

    res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, role: user.role } } as AuthResponse,
    } as ApiResponse<AuthResponse>);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' } as ApiResponse);
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (isMockMode) {
      const user = mockDb.users.get(req.user!.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' } as ApiResponse);
        return;
      }
      res.json({
        success: true,
        data: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
      } as ApiResponse);
      return;
    }

    const { default: prisma } = await import('../prisma/client.js');
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: user } as ApiResponse);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' } as ApiResponse);
  }
});

export default router;