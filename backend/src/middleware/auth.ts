import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('[AUTH] Verifying token with secret:', JWT_SECRET.substring(0, 10) + '...');
        console.log('[AUTH] Token (first 20 chars):', token.substring(0, 20) + '...');
      }
      
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      const user = await User.findById(decoded.userId);
      
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      req.user = user;
      req.userId = decoded.userId;
      next();
    } catch (jwtError: any) {
      console.error('JWT verification error:', jwtError.name, jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please login again.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token.' 
        });
      } else {
        res.status(401).json({ 
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
          message: 'Invalid or expired token' 
        });
      }
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'default-secret-change-me'
        ) as JwtPayload;

        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
          req.userId = decoded.userId;
        }
      } catch {
        // Token invalid, continue without auth
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

