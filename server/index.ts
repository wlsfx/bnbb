import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createProxyService } from "./proxy-service";
import { DatabaseStorage } from "./storage";
import { createBSCClient } from "./blockchain-client";
import { createStealthPatterns } from "./stealth-patterns";
import { createBundleJobQueue } from "./job-queue";
import { createBundleExecutor } from "./bundle-executor";
import { WebSocketService } from "./websocket-service";
import { PresetManager } from "./preset-manager";
import { WalletService } from "./wallet-service";

const app = express();

// Trust proxy for proper IP handling and rate limiting (trust first proxy only)
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Initialize all services in dependency order
const storage = new DatabaseStorage();
const proxyService = createProxyService(storage);
const bscClient = createBSCClient(storage, proxyService);
const stealthPatterns = createStealthPatterns(storage, proxyService);
const jobQueue = createBundleJobQueue(storage, bscClient, stealthPatterns);
const bundleExecutor = createBundleExecutor(storage, bscClient, stealthPatterns, jobQueue, proxyService);

// Initialize wallet service for secure wallet management
const walletService = new WalletService(storage, bscClient);

// Initialize preset manager and seed default presets
const presetManager = new PresetManager(storage);

// Make services available to routes (WebSocket service will be added after server creation)
app.locals.services = {
  storage,
  proxyService,
  bscClient,
  stealthPatterns,
  jobQueue,
  bundleExecutor,
  walletService,
  presetManager,
};

console.log('🚀 All bundle execution services initialized');

// Disable rate limiting for development debugging
// app.use(proxyService.createGlobalRateLimiter(1000));
// app.use('/api/*', proxyService.createWalletRateLimiter(100));

// Add proxy headers middleware
app.use(proxyService.proxyHeaderMiddleware());

// Health check endpoint with comprehensive service checks
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'disabled',
      jobQueue: 'unknown',
      network: 'unknown'
    },
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  };

  let hasFailures = false;

  try {
    // Test database connectivity
    // Test basic storage functionality
    await storage.getActiveSessions();
    healthStatus.services.database = 'healthy';
  } catch (error) {
    healthStatus.services.database = 'unhealthy';
    hasFailures = true;
  }

  try {
    // Test job queue
    if (jobQueue && jobQueue.isReady && jobQueue.isReady()) {
      healthStatus.services.jobQueue = 'healthy';
    } else {
      healthStatus.services.jobQueue = 'in-memory-fallback';
    }
  } catch (error) {
    healthStatus.services.jobQueue = 'unhealthy';
  }

  // Test network/proxy service
  try {
    const metrics = proxyService.getHealthMetrics();
    healthStatus.services.network = 'healthy';
  } catch (error) {
    healthStatus.services.network = 'degraded';
  }

  healthStatus.status = hasFailures ? 'unhealthy' : 'healthy';
  const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(healthStatus);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize WebSocket service after server creation
  const webSocketService = new WebSocketService(server, storage);
  
  // Add WebSocket service to app.locals for route access
  app.locals.services.webSocketService = webSocketService;
  
  // Make webSocketService globally accessible for bundle executor
  (global as any).webSocketService = webSocketService;

  console.log('🔌 WebSocket service initialized');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    log(`WebSocket server available at ws://localhost:${port}/ws`);
    
    // Initialize default presets after server startup
    try {
      await presetManager.initializeDefaultPresets();
      log('🎯 Default presets initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize default presets:', error);
    }
  });
})();
