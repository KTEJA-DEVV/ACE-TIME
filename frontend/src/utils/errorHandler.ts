// Error types from API
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE = 'DUPLICATE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
  NETWORK = 'NETWORK_ERROR',
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    type: ErrorType;
    details?: any;
  };
}

export interface AppError {
  message: string;
  type: ErrorType;
  details?: any;
  originalError?: any;
}

// Parse API error response
export const parseApiError = (error: any): AppError => {
  // Network error (no response)
  if (!error.response && error.message) {
    return {
      message: 'Network error. Please check your connection.',
      type: ErrorType.NETWORK,
      originalError: error,
    };
  }

  // Fetch error
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      message: 'Unable to connect to server. Please try again.',
      type: ErrorType.NETWORK,
      originalError: error,
    };
  }

  // API error response
  if (error.error) {
    return {
      message: error.error.message || 'An error occurred',
      type: error.error.type || ErrorType.INTERNAL,
      details: error.error.details,
    };
  }

  // Generic error
  return {
    message: error.message || 'An unexpected error occurred',
    type: ErrorType.INTERNAL,
    originalError: error,
  };
};

// Get user-friendly error message
export const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.AUTHENTICATION:
      return 'Please log in to continue.';
    case ErrorType.AUTHORIZATION:
      return 'You don\'t have permission to perform this action.';
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    case ErrorType.VALIDATION:
      if (error.details && Array.isArray(error.details)) {
        return error.details.map((d: any) => d.message).join(', ');
      }
      return error.message;
    case ErrorType.DUPLICATE:
      return error.message;
    case ErrorType.RATE_LIMIT:
      return 'Too many requests. Please wait a moment and try again.';
    case ErrorType.EXTERNAL_SERVICE:
      return 'A service is temporarily unavailable. Please try again later.';
    case ErrorType.NETWORK:
      return 'Connection error. Please check your internet connection.';
    case ErrorType.DATABASE:
    case ErrorType.INTERNAL:
    default:
      return 'Something went wrong. Please try again later.';
  }
};

// Handle API response
export const handleApiResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: response.statusText, type: ErrorType.INTERNAL } };
    }

    // Handle specific status codes
    if (response.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    throw parseApiError(errorData);
  }

  return response.json();
};

// API fetch wrapper with error handling
export const apiFetch = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const accessToken = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    return handleApiResponse<T>(response);
  } catch (error: any) {
    // Re-throw if already parsed
    if (error.type) {
      throw error;
    }
    throw parseApiError(error);
  }
};

// Retry wrapper for transient errors
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on auth errors or validation errors
      if (
        error.type === ErrorType.AUTHENTICATION ||
        error.type === ErrorType.AUTHORIZATION ||
        error.type === ErrorType.VALIDATION ||
        error.type === ErrorType.NOT_FOUND
      ) {
        throw error;
      }

      // Wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }

  throw lastError;
};

