import { ENV } from '../config/env.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const response = {
    message: err.message || 'Internal server error',
  };

  if (!ENV.isProduction) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};
