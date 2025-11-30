import jwt from 'jsonwebtoken';

// Read secrets dynamically to ensure .env is loaded
const getJWTSecret = () => process.env.JWT_SECRET || 'default-secret-change-me';
const getJWTRefreshSecret = () => process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // Increased to 24 hours
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJWTSecret(), { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJWTRefreshSecret(), { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJWTSecret()) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJWTRefreshSecret()) as TokenPayload;
};

export const generateTokenPair = (payload: TokenPayload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

