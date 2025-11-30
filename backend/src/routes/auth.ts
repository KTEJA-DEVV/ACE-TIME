import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { generateTokenPair, verifyRefreshToken } from '../services/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation middleware
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

// POST /api/auth/register
router.post(
  '/register',
  registerValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Create user
    const user = new User({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save hook
    });

    await user.save();

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
    });

    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      settings: user.settings,
    };

    res.status(201).json({
      message: 'Registration successful',
      user: userResponse,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  loginValidation,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('[AUTH] Login request received:', { email: req.body.email });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[AUTH] Validation errors:', errors.array());
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    console.log('[AUTH] Looking up user:', email);

    // Find user with timeout protection
    let user;
    try {
      const findUserPromise = User.findOne({ email }).maxTimeMS(3000); // 3 second MongoDB timeout
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 3000)
      );
      
      user = await Promise.race([findUserPromise, timeoutPromise]);
    } catch (error: any) {
      console.error('[AUTH] Database query error:', error.message);
      res.status(500).json({ error: 'Database error. Please try again.' });
      return;
    }
    
    if (!user) {
      console.log('[AUTH] User not found:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.log('[AUTH] User found, checking password...');
    // Check password with timeout protection
    let isMatch;
    try {
      const comparePromise = user.comparePassword(password);
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Password comparison timeout')), 3000)
      );
      
      isMatch = await Promise.race([comparePromise, timeoutPromise]) as boolean;
    } catch (error: any) {
      console.error('[AUTH] Password comparison error:', error.message);
      res.status(500).json({ error: 'Authentication error. Please try again.' });
      return;
    }
    
    if (!isMatch) {
      console.log('[AUTH] Password mismatch for:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    console.log('[AUTH] Password verified, generating tokens...');

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
    });

    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      settings: user.settings,
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  })
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      
      const user = await User.findById(payload.userId);
      if (!user || user.refreshToken !== refreshToken) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Generate new tokens
      const tokens = generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
      });

      // Update refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      res.json({
        message: 'Tokens refreshed',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  })
);

// GET /api/auth/verify - Verify current token
router.get(
  '/verify',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userResponse = {
      _id: req.user!._id,
      name: req.user!.name,
      email: req.user!.email,
      settings: req.user!.settings,
    };
    
    res.json({
      valid: true,
      user: userResponse,
    });
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user) {
      req.user.refreshToken = undefined;
      await req.user.save();
    }

    res.json({ message: 'Logged out successfully' });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ user: req.user?.toJSON() });
  })
);

export default router;

