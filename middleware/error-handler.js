export function errorHandler(err, req, res, next) {
  console.error('API Error:', err);
  
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: 'API Error',
    message: err.message || 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}