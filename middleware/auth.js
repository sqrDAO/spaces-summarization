import dotenv from 'dotenv';

dotenv.config();

/**
 * Middleware to verify API key authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // If API key is not required in config, skip authentication
  if (!process.env.API_KEY_REQUIRED || process.env.API_KEY_REQUIRED.toLowerCase() !== 'true') {
    return next();
  }
  
  // Get authorized API keys
  const authorizedKeys = process.env.AUTHORIZED_API_KEYS ? 
    process.env.AUTHORIZED_API_KEYS.split(',').map(key => key.trim()) : 
    [];
  
  // Check if API key is provided and valid
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'API key is required' 
    });
  }
  
  if (!authorizedKeys.includes(apiKey)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid API key' 
    });
  }
  
  // API key is valid, continue to the next middleware/route handler
  next();
};

export default apiKeyAuth;