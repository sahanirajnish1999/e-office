import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import apiRoutes from './routes/api.routes.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';
import { appConfig } from './config/app.config.js';

const app = express();

// HTTP request logger
app.use(morgan('dev'));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve(process.cwd(), appConfig.uploadDir)));

// Root health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Express API Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api', apiRoutes);

// Error handling middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
