/**
 * SMS Platform - Authentication Routes
 * POST /auth/register
 * POST /auth/login
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client.js';
import { config } from '../config/index.js';
import { authenticate } from '../middleware/index.js';
import { RegisterInput, LoginInput, AuthResponse, ApiResponse, UserRole } from '../types/index.js';

const router = Router();

const SALT_ROUNDS = 12;

/**
 * POST /auth/register
 * Create a new user account
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: RegisterInput = req.body;

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

    // Check if user already exists
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

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Determine role (first user is admin)
    const userCount = await prisma.user.count();
    const role: UserRole = userCount === 0 ? 'ADMIN' : 'USER';

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actor: user.email,
        action: 'user_registered',
        ipAddress: req.ip,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: parseInt(config.jwtExpiresIn, 10) }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user,
      } as AuthResponse,
    } as ApiResponse<AuthResponse>);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
    } as ApiResponse);
  }
});

/**
 * POST /auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: LoginInput = req.body;

    // Validate input
    if (!input.email || !input.password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as ApiResponse);
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse);
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(input.password, user.passwordHash);

    if (!validPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse);
      return;
    }

    // Update last login (optional, for audit)
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actor: user.email,
        action: 'user_login',
        ipAddress: req.ip,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: parseInt(config.jwtExpiresIn, 10) }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      } as AuthResponse,
    } as ApiResponse<AuthResponse>);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    } as ApiResponse);
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: user,
    } as ApiResponse);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    } as ApiResponse);
  }
});

export default router;