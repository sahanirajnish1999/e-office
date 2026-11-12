import app from './app.js';
import { appConfig } from './config/app.config.js';
import { connectDatabase } from './config/db.config.js';

const PORT = appConfig.port;

const startServer = async () => {
  // Connect to MongoDB
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Static files at http://localhost:${PORT}/uploads`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  });
};

startServer();
