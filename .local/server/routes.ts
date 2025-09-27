import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertWalletSchema, insertLaunchPlanSchema, insertBundleExecutionSchema, 
  insertActivitySchema, insertSystemMetricsSchema, insertStealthFundingSnapshotSchema, 
  insertEnvironmentConfigSchema, insertLaunchSessionSchema, insertBundleTransactionSchema,
  insertLaunchPresetSchema, insertUserPresetSchema,
  wallets, activities, systemMetrics, stealthFundingSnapshots, environmentConfig, launchSessions,
  BundleExecution, BUNDLE_STATUS, TRANSACTION_STATUS
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { createAuthRoutes } from './auth-routes';
import { AuthService } from './auth-service';

interface AuthRequest extends Request {
  session?: {
    accessKeyId?: string;
    role?: string;
    sessionToken?: string;
  };
}
import { z, ZodError } from "zod";
import { fromZodError } from 'zod-validation-error';

// Validation middleware factory
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationError.details
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid request data"
      });
    }
  };
}

// Enhanced health check
function createHealthCheck(storage: any, services: any) {
  return async (req: Request, res: Response) => {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'disabled',
        jobQueue: 'unknown',
        presets: 'unknown'
      },
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    };

    let hasFailures = false;

    try {
      // Test database connectivity
      await storage.getUsers();
      healthStatus.services.database = 'healthy';
    } catch (error) {
      healthStatus.services.database = 'unhealthy';
      hasFailures = true;
    }

    try {
      // Test job queue
      if (services.jobQueue && services.jobQueue.isReady && services.jobQueue.isReady()) {
        healthStatus.services.jobQueue = 'healthy';
      } else {
        healthStatus.services.jobQueue = 'in-memory';
      }
    } catch (error) {
      healthStatus.services.jobQueue = 'unhealthy';
    }

    try {
      // Test preset system (check if tables exist)
      const presets = await storage.getLaunchPresets();
      healthStatus.services.presets = 'healthy';
    } catch (error) {
      healthStatus.services.presets = 'degraded';
      // Don't mark as failure since preset seeding issues don't affect core functionality
    }

    healthStatus.status = hasFailures ? 'unhealthy' : 'healthy';
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(healthStatus);
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get services from app.locals (initialized in index.ts)
  const { storage, proxyService, bscClient, stealthPatterns, jobQueue, bundleExecutor, webSocketService, presetManager } = app.locals.services;

  // Initialize auth service and register auth routes
  const authService = new AuthService(storage);
  const { router: authRouter } = createAuthRoutes(storage, authService);
  app.use(authRouter);

  // Authentication middleware
  async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sessionToken = req.session?.sessionToken || req.headers.authorization?.replace('Bearer ', '') || req.headers['x-session-token'];
      
      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const session = await storage.getUserSessionByToken(sessionToken as string);
      
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid'
        });
      }
      
      // Update session activity
      await storage.updateSessionActivity(session.id);
      
      // Set session data
      req.session = {
        accessKeyId: session.accessKeyId,
        role: (await storage.getAccessKey(session.accessKeyId))?.role || 'user',
        sessionToken: sessionToken as string
      };
      
      next();
      
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }

  async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    await requireAuth(req, res, async () => {
      if (req.session?.role !== 'admin') {
        await storage.createAuditLog({
          action: 'access_denied',
          accessKeyId: req.session?.accessKeyId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: JSON.stringify({ route: req.path })
        });
        
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      next();
    });
  }

  // WebSocket status endpoint
  app.get("/api/websocket/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const status = webSocketService.getConnectionStatus();
      res.json({
        ...status,
        serverTime: new Date().toISOString(),
        websocketUrl: `/ws?token=${req.session?.sessionToken}`
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get WebSocket status" });
    }
  });

  // Wallet routes (user-scoped)
  app.get("/api/wallets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const wallets = await storage.getWallets(accessKeyId);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const wallet = await storage.getWallet(req.params.id, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  app.post("/api/wallets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const validatedData = insertWalletSchema.parse(req.body);
      const wallet = await storage.createWallet(validatedData, accessKeyId);
      
      // Create activity for wallet generation
      const activity = await storage.createActivity({
        type: "wallet_generated",
        description: `Wallet ${wallet.label || wallet.id} generated`,
        walletId: wallet.id,
        status: "confirmed",
      });

      // Broadcast wallet update via WebSocket
      webSocketService.broadcastWalletUpdate(wallet, accessKeyId);
      
      // Broadcast activity update via WebSocket
      webSocketService.broadcastActivityUpdate(activity, accessKeyId);

      res.status(201).json(wallet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid wallet data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });

  app.post("/api/wallets/bulk", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const { count, initialBalance, labelPrefix } = req.body;
      const wallets = [];
      
      for (let i = 0; i < count; i++) {
        // Generate mock wallet data - in production this would use ethers.js
        const walletData = {
          address: `0x${Math.random().toString(16).substring(2, 42)}`,
          privateKey: `0x${Math.random().toString(16).substring(2, 66)}`,
          publicKey: `0x${Math.random().toString(16).substring(2, 130)}`,
          balance: initialBalance || "0",
          status: "idle",
          label: `${labelPrefix || "Wallet"} #${(i + 1).toString().padStart(3, "0")}`,
        };
        
        const wallet = await storage.createWallet(walletData, accessKeyId);
        wallets.push(wallet);
      }

      // Create bulk activity
      const activity = await storage.createActivity({
        type: "bulk_wallet_generation",
        description: `Generated ${count} wallets`,
        status: "confirmed",
      });

      // Broadcast wallet updates via WebSocket
      wallets.forEach(wallet => {
        webSocketService.broadcastWalletUpdate(wallet, accessKeyId);
      });
      
      // Broadcast activity update via WebSocket
      webSocketService.broadcastActivityUpdate(activity, accessKeyId);

      res.status(201).json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to create wallets" });
    }
  });

  app.patch("/api/wallets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const wallet = await storage.updateWallet(req.params.id, req.body, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      // Broadcast wallet update via WebSocket
      webSocketService.broadcastWalletUpdate(wallet, accessKeyId);
      
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  app.delete("/api/wallets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const deleted = await storage.deleteWallet(req.params.id, accessKeyId);
      if (!deleted) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete wallet" });
    }
  });

  // Launch Plan routes
  app.get("/api/launch-plans", async (req, res) => {
    try {
      const plans = await storage.getLaunchPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch plans" });
    }
  });

  app.post("/api/launch-plans", async (req, res) => {
    try {
      const validatedData = insertLaunchPlanSchema.parse(req.body);
      const plan = await storage.createLaunchPlan(validatedData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid launch plan data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create launch plan" });
    }
  });

  // Bundle Execution routes
  app.get("/api/bundle-executions", async (req, res) => {
    try {
      const executions = await storage.getBundleExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bundle executions" });
    }
  });

  app.post("/api/bundle-executions", async (req, res) => {
    try {
      const validatedData = insertBundleExecutionSchema.parse(req.body);
      const execution = await storage.createBundleExecution(validatedData);
      
      // Create activity for bundle execution
      await storage.createActivity({
        type: "bundle_execution",
        description: `Bundle execution started for ${execution.totalWallets} wallets`,
        status: "pending",
      });

      res.status(201).json(execution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bundle execution data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create bundle execution" });
    }
  });

  // Activity routes
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // System Metrics routes
  app.get("/api/system-metrics", async (req, res) => {
    try {
      let metrics = await storage.getLatestSystemMetrics();
      
      // If no metrics exist, create default metrics
      if (!metrics) {
        const defaultMetrics = {
          latency: Math.floor(15 + Math.random() * 20),
          gasPrice: (5.0 + Math.random() * 3.0).toFixed(1),
          successRate: (95.0 + Math.random() * 5.0).toFixed(1),
          taxCollected: "0.000",
          cpuUsage: Math.floor(25 + Math.random() * 50),
          memoryUsage: Math.floor(40 + Math.random() * 40),
        };
        
        metrics = await storage.createSystemMetrics(defaultMetrics);
      }
      
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system metrics" });
    }
  });

  app.post("/api/system-metrics", async (req, res) => {
    try {
      const validatedData = insertSystemMetricsSchema.parse(req.body);
      const metrics = await storage.createSystemMetrics(validatedData);
      
      // Broadcast system metrics update via WebSocket
      webSocketService.broadcastSystemMetrics(metrics);
      
      res.status(201).json(metrics);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid system metrics data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create system metrics" });
    }
  });

  // Stealth Funding endpoint
  app.post("/api/stealth-funding", async (req, res) => {
    try {
      const { source, method, totalAmount, selectedWallets } = req.body;
      
      // Get wallets to fund (either selected ones or all idle wallets)
      const walletsToFund = selectedWallets && selectedWallets.length > 0 
        ? await Promise.all(selectedWallets.map((id: string) => storage.getWallet(id)))
        : await storage.getWalletsByStatus("idle");
      
      const validWallets = walletsToFund.filter(Boolean);
      if (validWallets.length === 0) {
        return res.status(400).json({ message: "No wallets available for funding" });
      }

      const amount = parseFloat(totalAmount);
      const amountPerWallet = amount / validWallets.length;
      const taxRate = 0.05; // 5% tax collection
      const taxCollected = amount * taxRate;
      const netAmount = amount - taxCollected;
      const netAmountPerWallet = netAmount / validWallets.length;

      // Execute all operations in a transaction for data consistency
      const result = await storage.executeInTransaction(async (tx: any) => {
        console.log(`Starting stealth funding transaction for ${validWallets.length} wallets`);
        
        // Update wallet balances and status
        const fundedWallets = [];
        for (const wallet of validWallets) {
          const currentBalance = parseFloat(wallet.balance);
          const newBalance = currentBalance + netAmountPerWallet;
          
          const updatedWallet = await tx
            .update(wallets)
            .set({
              balance: newBalance.toFixed(8),
              status: "active",
              lastActivity: new Date(),
            })
            .where(eq(wallets.id, wallet.id))
            .returning();
          
          if (updatedWallet[0]) {
            fundedWallets.push(updatedWallet[0]);
          }
        }

        // Create activity for stealth funding
        const activity = await tx
          .insert(activities)
          .values({
            type: "stealth_funding",
            description: `Stealth funding executed: ${netAmount.toFixed(4)} BNB distributed to ${fundedWallets.length} wallets (${method} method)`,
            status: "confirmed",
            amount: netAmount.toFixed(8),
          })
          .returning();

        // Update system metrics with tax collection
        const currentMetrics = await tx
          .select()
          .from(systemMetrics)
          .orderBy(desc(systemMetrics.createdAt))
          .limit(1);
          
        if (currentMetrics[0]) {
          const newTaxCollected = parseFloat(currentMetrics[0].taxCollected) + taxCollected;
          await tx
            .insert(systemMetrics)
            .values({
              latency: currentMetrics[0].latency,
              gasPrice: currentMetrics[0].gasPrice,
              successRate: "98.5", // Slightly higher after successful funding
              taxCollected: newTaxCollected.toFixed(8),
              cpuUsage: currentMetrics[0].cpuUsage,
              memoryUsage: currentMetrics[0].memoryUsage,
            });
        }

        console.log(`Stealth funding transaction completed successfully for ${fundedWallets.length} wallets`);
        return { fundedWallets, activity: activity[0] };
      });

      res.json({
        success: true,
        message: `Successfully funded ${result.fundedWallets.length} wallets`,
        totalAmount: amount,
        netAmount: netAmount,
        taxCollected: taxCollected,
        walletsUpdated: result.fundedWallets.length,
        method: method,
        source: source,
      });
    } catch (error) {
      console.error("Stealth funding failed:", error);
      res.status(500).json({ 
        message: "Failed to execute stealth funding",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Statistics endpoint (user-scoped)
  app.get("/api/stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const wallets = await storage.getWallets(accessKeyId);
      const activeWallets = await storage.getWalletsByStatus("active", accessKeyId);
      const totalBalance = wallets.reduce((sum: number, wallet: any) => sum + parseFloat(wallet.balance), 0);
      
      res.json({
        totalWallets: wallets.length,
        activeWallets: activeWallets.length,
        totalBalance: totalBalance.toFixed(8),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Enhanced Wallet routes (user-scoped)
  app.get("/api/wallets/health/:health", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const wallets = await storage.getWalletsByHealth(req.params.health, accessKeyId);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallets by health" });
    }
  });

  app.post("/api/wallets/:id/heartbeat", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const wallet = await storage.updateWalletHeartbeat(req.params.id, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to update wallet heartbeat" });
    }
  });

  // Stealth Funding Snapshot routes
  app.get("/api/stealth-funding-snapshots", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const snapshots = await storage.getStealthFundingSnapshots(limit);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stealth funding snapshots" });
    }
  });

  app.get("/api/stealth-funding-snapshots/session/:sessionId", async (req, res) => {
    try {
      const snapshots = await storage.getStealthFundingSnapshotsBySession(req.params.sessionId);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch snapshots by session" });
    }
  });

  app.get("/api/stealth-funding-snapshots/wallet/:walletId", async (req, res) => {
    try {
      const snapshots = await storage.getStealthFundingSnapshotsByWallet(req.params.walletId);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch snapshots by wallet" });
    }
  });

  app.post("/api/stealth-funding-snapshots", async (req, res) => {
    try {
      const validatedData = insertStealthFundingSnapshotSchema.parse(req.body);
      const snapshot = await storage.createStealthFundingSnapshot(validatedData);
      res.status(201).json(snapshot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid snapshot data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create stealth funding snapshot" });
    }
  });

  // Environment Configuration routes
  app.get("/api/environment-configs", async (req, res) => {
    try {
      const configs = await storage.getEnvironmentConfigs();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch environment configs" });
    }
  });

  app.get("/api/environment-configs/active", async (req, res) => {
    try {
      const activeEnv = await storage.getActiveEnvironment();
      if (!activeEnv) {
        return res.status(404).json({ message: "No active environment found" });
      }
      res.json(activeEnv);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active environment" });
    }
  });

  app.get("/api/environment-configs/:environment", async (req, res) => {
    try {
      const config = await storage.getEnvironmentConfig(req.params.environment);
      if (!config) {
        return res.status(404).json({ message: "Environment config not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch environment config" });
    }
  });

  app.post("/api/environment-configs", async (req, res) => {
    try {
      const validatedData = insertEnvironmentConfigSchema.parse(req.body);
      const config = await storage.createEnvironmentConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid environment config data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create environment config" });
    }
  });

  app.patch("/api/environment-configs/:environment", async (req, res) => {
    try {
      const config = await storage.updateEnvironmentConfig(req.params.environment, req.body);
      if (!config) {
        return res.status(404).json({ message: "Environment config not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to update environment config" });
    }
  });

  app.post("/api/environment-configs/:environment/activate", async (req, res) => {
    try {
      const config = await storage.switchActiveEnvironment(req.params.environment);
      if (!config) {
        return res.status(404).json({ message: "Environment config not found" });
      }
      res.json({ 
        message: `Successfully switched to ${req.params.environment} environment`,
        activeEnvironment: config
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to switch active environment" });
    }
  });

  // Launch Session routes
  app.get("/api/launch-sessions", async (req, res) => {
    try {
      const sessions = await storage.getLaunchSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch sessions" });
    }
  });

  app.get("/api/launch-sessions/active", async (req, res) => {
    try {
      const activeSessions = await storage.getActiveLaunchSessions();
      res.json(activeSessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active launch sessions" });
    }
  });

  app.get("/api/launch-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getLaunchSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Launch session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch session" });
    }
  });

  app.get("/api/launch-sessions/plan/:launchPlanId", async (req, res) => {
    try {
      const sessions = await storage.getLaunchSessionsByPlan(req.params.launchPlanId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launch sessions by plan" });
    }
  });

  app.post("/api/launch-sessions", async (req, res) => {
    try {
      const validatedData = insertLaunchSessionSchema.parse(req.body);
      const session = await storage.createLaunchSession(validatedData);
      
      // Create activity for launch session creation
      await storage.createActivity({
        type: "launch_session_created",
        description: `Launch session created for plan ${session.launchPlanId}`,
        status: "confirmed",
      });

      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid launch session data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create launch session" });
    }
  });

  app.patch("/api/launch-sessions/:id", async (req, res) => {
    try {
      const session = await storage.updateLaunchSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ message: "Launch session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update launch session" });
    }
  });

  // Real-time polling endpoints for dashboard updates
  app.get("/api/real-time/dashboard-summary", async (req, res) => {
    try {
      const [
        wallets,
        activeWallets,
        activeSessions,
        recentActivities,
        latestMetrics,
        recentSnapshots
      ] = await Promise.all([
        storage.getWallets(),
        storage.getWalletsByStatus("active"),
        storage.getActiveLaunchSessions(),
        storage.getActivities(10),
        storage.getLatestSystemMetrics(),
        storage.getStealthFundingSnapshots(5)
      ]);

      const totalBalance = wallets.reduce((sum: number, wallet: any) => sum + parseFloat(wallet.balance), 0);
      const healthDistribution = wallets.reduce((acc: any, wallet: any) => {
        acc[wallet.health] = (acc[wallet.health] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        walletSummary: {
          total: wallets.length,
          active: activeWallets.length,
          totalBalance: totalBalance.toFixed(8),
          healthDistribution
        },
        launchSessions: {
          active: activeSessions.length,
          sessions: activeSessions
        },
        recentActivity: recentActivities,
        systemMetrics: latestMetrics,
        recentFunding: recentSnapshots,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  // Funding metrics endpoint with real-time calculations
  app.get("/api/real-time/funding-metrics", async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '24h';
      const snapshots = await storage.getStealthFundingSnapshots(100);
      
      // Filter by timeframe
      const cutoffTime = new Date();
      switch(timeframe) {
        case '1h':
          cutoffTime.setHours(cutoffTime.getHours() - 1);
          break;
        case '24h':
          cutoffTime.setHours(cutoffTime.getHours() - 24);
          break;
        case '7d':
          cutoffTime.setDate(cutoffTime.getDate() - 7);
          break;
        default:
          cutoffTime.setHours(cutoffTime.getHours() - 24);
      }

      const filteredSnapshots = snapshots.filter((snapshot: any) => 
        new Date(snapshot.createdAt) >= cutoffTime
      );

      const totalGross = filteredSnapshots.reduce((sum: number, snap: any) => sum + parseFloat(snap.grossAmount), 0);
      const totalNet = filteredSnapshots.reduce((sum: number, snap: any) => sum + parseFloat(snap.netAmount), 0);
      const totalTax = filteredSnapshots.reduce((sum: number, snap: any) => sum + parseFloat(snap.taxAmount), 0);

      res.json({
        timeframe,
        totalTransactions: filteredSnapshots.length,
        metrics: {
          grossAmount: totalGross.toFixed(8),
          netAmount: totalNet.toFixed(8),
          taxCollected: totalTax.toFixed(8),
          averageTransactionSize: filteredSnapshots.length > 0 ? (totalGross / filteredSnapshots.length).toFixed(8) : "0"
        },
        recentSnapshots: filteredSnapshots.slice(0, 10),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch funding metrics" });
    }
  });

  // Bundle Execution API routes
  app.get("/api/bundles/:id/progress", async (req, res) => {
    try {
      const progress = await storage.getBundleProgress(req.params.id);
      
      if (!progress || !progress.bundle) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bundle progress" });
    }
  });

  app.get("/api/bundles/history", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const status = req.query.status as string;
      
      const history = await storage.getBundleHistory({
        page,
        pageSize,
        status,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });
      
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bundle history" });
    }
  });

  app.get("/api/bundles/analytics", async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || 'all_time';
      const limit = parseInt(req.query.limit as string) || 100;
      
      const analytics = await storage.getBundleAnalyticsByTimeframe(timeframe, limit);
      
      // Calculate aggregated metrics
      const totalTransactions = analytics.reduce((sum: number, a: any) => sum + a.totalTransactions, 0);
      const successfulTransactions = analytics.reduce((sum: number, a: any) => sum + a.successfulTransactions, 0);
      const failedTransactions = analytics.reduce((sum: number, a: any) => sum + a.failedTransactions, 0);
      const avgSuccessRate = totalTransactions > 0 
        ? ((successfulTransactions / totalTransactions) * 100).toFixed(2)
        : "0";
      
      const avgConfirmationTime = analytics.reduce((sum: number, a: any) => 
        sum + (a.avgConfirmationTime || 0), 0) / (analytics.filter((a: any) => a.avgConfirmationTime).length || 1);
      
      const totalGasUsed = analytics.reduce((sum: number, a: any) => 
        sum + parseFloat(a.totalGasUsed || "0"), 0);
      
      const totalValue = analytics.reduce((sum: number, a: any) => 
        sum + parseFloat(a.totalValue || "0"), 0);
        
      const totalFees = analytics.reduce((sum: number, a: any) => 
        sum + parseFloat(a.totalFees || "0"), 0);
      
      res.json({
        timeframe,
        summary: {
          totalTransactions,
          successfulTransactions,
          failedTransactions,
          successRate: avgSuccessRate,
          avgConfirmationTime: Math.round(avgConfirmationTime),
          totalGasUsed: totalGasUsed.toString(),
          totalValue: totalValue.toFixed(8),
          totalFees: totalFees.toFixed(8),
        },
        analytics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bundle analytics" });
    }
  });

  app.post("/api/bundles/:id/transactions", async (req, res) => {
    try {
      const bundleId = req.params.id;
      const transactionData = insertBundleTransactionSchema.parse({
        ...req.body,
        bundleExecutionId: bundleId
      });
      
      const transaction = await storage.createBundleTransaction(transactionData);
      
      // Record initial status event
      await storage.recordTransactionStatusChange(
        transaction.id,
        transaction.status,
        {
          eventType: 'status_change',
          description: 'Transaction created'
        }
      );
      
      // Update bundle progress
      const bundle = await storage.getBundleExecution(bundleId);
      if (bundle) {
        const totalTransactions = await storage.getBundleTransactionsByBundleId(bundleId);
        const completedCount = totalTransactions.filter((t: any) => 
          t.status === TRANSACTION_STATUS.CONFIRMED
        ).length;
        const failedCount = totalTransactions.filter((t: any) => 
          t.status === TRANSACTION_STATUS.FAILED
        ).length;
        
        await storage.updateBundleExecution(bundleId, {
          completedWallets: completedCount,
          failedWallets: failedCount,
          progressPercentage: ((completedCount / bundle.totalWallets) * 100).toFixed(2)
        });
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add transaction to bundle" });
    }
  });

  app.put("/api/bundles/:id/status", async (req, res) => {
    try {
      const { status, failureReason } = req.body;
      
      if (!Object.values(BUNDLE_STATUS).includes(status)) {
        return res.status(400).json({ 
          message: "Invalid status. Must be one of: " + Object.values(BUNDLE_STATUS).join(', ') 
        });
      }
      
      const updates: Partial<BundleExecution> = { status };
      
      if (status === BUNDLE_STATUS.EXECUTING) {
        updates.startedAt = new Date();
      } else if (status === BUNDLE_STATUS.COMPLETED || status === BUNDLE_STATUS.FAILED) {
        updates.completedAt = new Date();
        if (failureReason) {
          updates.failureReason = failureReason;
        }
      }
      
      const bundle = await storage.updateBundleExecution(req.params.id, updates);
      
      if (!bundle) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      
      // Create activity for status change
      await storage.createActivity({
        type: "bundle_status_change",
        description: `Bundle execution status changed to ${status}`,
        status: status === BUNDLE_STATUS.FAILED ? "failed" : "confirmed",
      });
      
      res.json(bundle);
    } catch (error) {
      res.status(500).json({ message: "Failed to update bundle status" });
    }
  });

  // =====================================================
  // COMPREHENSIVE BUNDLE EXECUTION API ENDPOINTS
  // =====================================================

  // Execute Bundle - Main stealth bundler endpoint
  app.post("/api/bundles/execute", async (req, res) => {
    try {
      const {
        launchPlanId,
        selectedWalletIds,
        executionMode = 'parallel',
        transactionType = 'transfer',
        parameters = {},
        stealthConfig = {}
      } = req.body;

      // Validate required fields
      if (!launchPlanId) {
        return res.status(400).json({ message: "launchPlanId is required" });
      }

      if (!['parallel', 'sequential'].includes(executionMode)) {
        return res.status(400).json({ message: "executionMode must be 'parallel' or 'sequential'" });
      }

      if (!['transfer', 'token_creation', 'liquidity_addition', 'swap'].includes(transactionType)) {
        return res.status(400).json({ 
          message: "transactionType must be one of: transfer, token_creation, liquidity_addition, swap" 
        });
      }

      console.log(`🚀 Bundle execution requested: ${launchPlanId}, mode: ${executionMode}`);

      // Execute bundle using the bundle executor service
      const bundleExecutionId = await bundleExecutor.executeBundle({
        launchPlanId,
        selectedWalletIds,
        executionMode,
        transactionType,
        parameters,
        stealthConfig,
      });

      res.status(201).json({
        success: true,
        bundleExecutionId,
        message: `Bundle execution started in ${executionMode} mode`,
        estimatedDuration: "2-5 minutes", // Would be calculated from stealth patterns
      });

    } catch (error) {
      console.error('❌ Bundle execution failed:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to start bundle execution",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Pause Bundle Execution
  app.put("/api/bundles/:id/pause", async (req, res) => {
    try {
      await bundleExecutor.pauseBundle(req.params.id);
      
      await storage.createActivity({
        type: "bundle_paused",
        description: `Bundle execution ${req.params.id} paused by user`,
        status: "confirmed",
      });

      res.json({ 
        success: true, 
        message: "Bundle execution paused",
        bundleId: req.params.id
      });

    } catch (error) {
      console.error('❌ Failed to pause bundle:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to pause bundle execution",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Resume Bundle Execution
  app.put("/api/bundles/:id/resume", async (req, res) => {
    try {
      await bundleExecutor.resumeBundle(req.params.id);
      
      await storage.createActivity({
        type: "bundle_resumed",
        description: `Bundle execution ${req.params.id} resumed by user`,
        status: "confirmed",
      });

      res.json({ 
        success: true, 
        message: "Bundle execution resumed",
        bundleId: req.params.id
      });

    } catch (error) {
      console.error('❌ Failed to resume bundle:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to resume bundle execution",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Cancel Bundle Execution
  app.put("/api/bundles/:id/cancel", async (req, res) => {
    try {
      await bundleExecutor.cancelBundle(req.params.id);
      
      await storage.createActivity({
        type: "bundle_cancelled",
        description: `Bundle execution ${req.params.id} cancelled by user`,
        status: "confirmed",
      });

      res.json({ 
        success: true, 
        message: "Bundle execution cancelled",
        bundleId: req.params.id
      });

    } catch (error) {
      console.error('❌ Failed to cancel bundle:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to cancel bundle execution",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Network Status and Health Check
  app.get("/api/network/status", async (req, res) => {
    try {
      const [networkHealth, proxyHealth] = await Promise.all([
        bscClient.healthCheck(),
        Promise.resolve(proxyService.getHealthMetrics())
      ]);

      res.json({
        blockchain: {
          ...networkHealth,
          chainId: 56,
          network: 'BSC Mainnet',
        },
        proxy: proxyHealth,
        services: {
          bundleExecutor: bundleExecutor ? 'operational' : 'unavailable',
          jobQueue: jobQueue ? 'operational' : 'unavailable',
          stealthPatterns: stealthPatterns ? 'operational' : 'unavailable',
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({ 
        message: "Failed to get network status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ================================
  // P&L TRACKING API ENDPOINTS
  // ================================

  // Portfolio Snapshot Routes
  app.get("/api/pnl/portfolio-snapshots", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const snapshots = await storage.getPortfolioSnapshots(accessKeyId, limit);
      res.json(snapshots);
    } catch (error) {
      console.error('Error fetching portfolio snapshots:', error);
      res.status(500).json({ 
        message: "Failed to fetch portfolio snapshots",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/portfolio-snapshots/timeframe", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date parameters" });
      }
      
      const snapshots = await storage.getPortfolioSnapshotsByTimeframe(accessKeyId, startDate, endDate);
      res.json(snapshots);
    } catch (error) {
      console.error('Error fetching portfolio snapshots by timeframe:', error);
      res.status(500).json({ 
        message: "Failed to fetch portfolio snapshots by timeframe",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/portfolio-snapshots/wallet/:walletId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(req.params.walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const snapshots = await storage.getPortfolioSnapshotsByWallet(req.params.walletId, limit);
      res.json(snapshots);
    } catch (error) {
      console.error('Error fetching portfolio snapshots by wallet:', error);
      res.status(500).json({ 
        message: "Failed to fetch portfolio snapshots by wallet",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Transaction P&L Routes
  app.get("/api/pnl/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const transactionPnL = await storage.getTransactionPnLByTimeframe(accessKeyId, startDate, endDate);
      res.json(transactionPnL);
    } catch (error) {
      console.error('Error fetching transaction P&L:', error);
      res.status(500).json({ 
        message: "Failed to fetch transaction P&L",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/transactions/wallet/:walletId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(req.params.walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const transactionPnL = await storage.getTransactionPnLByWallet(req.params.walletId);
      res.json(transactionPnL);
    } catch (error) {
      console.error('Error fetching transaction P&L by wallet:', error);
      res.status(500).json({ 
        message: "Failed to fetch transaction P&L by wallet",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/transactions/wallet/:walletId/token/:tokenAddress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(req.params.walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const transactionPnL = await storage.getTransactionPnLByWalletAndToken(req.params.walletId, req.params.tokenAddress);
      res.json(transactionPnL);
    } catch (error) {
      console.error('Error fetching transaction P&L by wallet and token:', error);
      res.status(500).json({ 
        message: "Failed to fetch transaction P&L by wallet and token",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Token Position Routes
  app.get("/api/pnl/positions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const positions = await storage.getAllTokenPositionsByAccessKey(accessKeyId);
      res.json(positions);
    } catch (error) {
      console.error('Error fetching token positions:', error);
      res.status(500).json({ 
        message: "Failed to fetch token positions",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/positions/wallet/:walletId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(req.params.walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const positions = await storage.getTokenPositionsByWallet(req.params.walletId);
      res.json(positions);
    } catch (error) {
      console.error('Error fetching token positions by wallet:', error);
      res.status(500).json({ 
        message: "Failed to fetch token positions by wallet",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/positions/wallet/:walletId/token/:tokenAddress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(req.params.walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const position = await storage.getTokenPosition(req.params.walletId, req.params.tokenAddress);
      if (!position) {
        return res.status(404).json({ message: "Token position not found" });
      }
      
      res.json(position);
    } catch (error) {
      console.error('Error fetching token position:', error);
      res.status(500).json({ 
        message: "Failed to fetch token position",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Performance Metrics Routes
  app.get("/api/pnl/performance", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const timeframe = req.query.timeframe as string;
      const metrics = await storage.getPerformanceMetricsByAccessKey(accessKeyId, timeframe);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      res.status(500).json({ 
        message: "Failed to fetch performance metrics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/performance/wallet/:walletId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(req.params.walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const timeframe = req.query.timeframe as string;
      const metrics = await storage.getPerformanceMetricsByWallet(req.params.walletId, timeframe);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching performance metrics by wallet:', error);
      res.status(500).json({ 
        message: "Failed to fetch performance metrics by wallet",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // P&L Alert Routes
  app.get("/api/pnl/alerts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const alerts = await storage.getPnLAlertsByAccessKey(accessKeyId);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching P&L alerts:', error);
      res.status(500).json({ 
        message: "Failed to fetch P&L alerts",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/alerts/active", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const alerts = await storage.getActivePnLAlerts(accessKeyId);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching active P&L alerts:', error);
      res.status(500).json({ 
        message: "Failed to fetch active P&L alerts",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Market Data Routes
  app.get("/api/pnl/market-data/:tokenAddress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tokenAddress = req.params.tokenAddress;
      const marketData = await storage.getMarketDataCache(tokenAddress);
      
      if (!marketData) {
        return res.status(404).json({ message: "Market data not found for token" });
      }
      
      res.json(marketData);
    } catch (error) {
      console.error('Error fetching market data:', error);
      res.status(500).json({ 
        message: "Failed to fetch market data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/market-data", requireAuth, async (req: AuthRequest, res) => {
    try {
      const marketData = await storage.getAllMarketDataCache();
      res.json(marketData);
    } catch (error) {
      console.error('Error fetching all market data:', error);
      res.status(500).json({ 
        message: "Failed to fetch all market data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Real-time P&L Calculation Routes
  app.get("/api/pnl/calculate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const { pnlService } = app.locals.services;
      
      if (!pnlService) {
        return res.status(500).json({ message: "P&L service not available" });
      }
      
      const pnlData = await pnlService.calculateRealTimePnL(accessKeyId);
      res.json(pnlData);
    } catch (error) {
      console.error('Error calculating real-time P&L:', error);
      res.status(500).json({ 
        message: "Failed to calculate real-time P&L",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/calculate/wallet/:walletId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const walletId = req.params.walletId;
      
      // Verify wallet belongs to user
      const wallet = await storage.getWallet(walletId, accessKeyId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      const { pnlService } = app.locals.services;
      
      if (!pnlService) {
        return res.status(500).json({ message: "P&L service not available" });
      }
      
      const pnlData = await pnlService.calculateWalletPnL(walletId);
      res.json(pnlData);
    } catch (error) {
      console.error('Error calculating wallet P&L:', error);
      res.status(500).json({ 
        message: "Failed to calculate wallet P&L",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/summary", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const { portfolioTracker } = app.locals.services;
      
      if (!portfolioTracker) {
        return res.status(500).json({ message: "Portfolio tracker not available" });
      }
      
      const summary = await portfolioTracker.getPortfolioSummary(accessKeyId);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching P&L summary:', error);
      res.status(500).json({ 
        message: "Failed to fetch P&L summary",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/pnl/analytics", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const timeframe = req.query.timeframe as string || '30d';
      const { performanceAnalytics } = app.locals.services;
      
      if (!performanceAnalytics) {
        return res.status(500).json({ message: "Performance analytics not available" });
      }
      
      const analytics = await performanceAnalytics.generateComprehensiveReport(accessKeyId, timeframe);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching P&L analytics:', error);
      res.status(500).json({ 
        message: "Failed to fetch P&L analytics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===== PRESET MANAGEMENT API ROUTES =====
  
  // Get all launch presets (public and user-accessible)
  app.get("/api/presets", async (req, res) => {
    try {
      const category = req.query.category as string;
      const showDefaults = req.query.defaults === 'true';
      
      let presets;
      if (category) {
        presets = await storage.getLaunchPresetsByCategory(category);
      } else if (showDefaults) {
        presets = await storage.getDefaultLaunchPresets();
      } else {
        presets = await storage.getPublicLaunchPresets();
      }
      
      res.json(presets);
    } catch (error) {
      console.error('Error fetching presets:', error);
      res.status(500).json({ message: "Failed to fetch presets" });
    }
  });

  // Get preset categories
  app.get("/api/presets/categories", async (req, res) => {
    try {
      const { PRESET_CATEGORIES } = await import('@shared/schema');
      const categories = Object.entries(PRESET_CATEGORIES).map(([key, value]) => ({
        key,
        value,
        name: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ')
      }));
      
      res.json(categories);
    } catch (error) {
      console.error('Error fetching preset categories:', error);
      res.status(500).json({ message: "Failed to fetch preset categories" });
    }
  });

  // Get specific preset by ID
  app.get("/api/presets/:id", async (req, res) => {
    try {
      const preset = await storage.getLaunchPreset(req.params.id);
      
      if (!preset) {
        return res.status(404).json({ message: "Preset not found" });
      }
      
      res.json(preset);
    } catch (error) {
      console.error('Error fetching preset:', error);
      res.status(500).json({ message: "Failed to fetch preset" });
    }
  });

  // Create new custom preset (admin only)
  app.post("/api/presets", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { insertLaunchPresetSchema } = await import('@shared/schema');
      const validatedData = insertLaunchPresetSchema.parse(req.body);
      
      // Validate configuration using preset manager
      const configValidation = presetManager.validateConfiguration(JSON.parse(validatedData.configuration));
      
      if (!configValidation.isValid) {
        return res.status(400).json({ 
          message: "Invalid preset configuration", 
          errors: configValidation.errors 
        });
      }
      
      const preset = await storage.createLaunchPreset({
        ...validatedData,
        createdBy: req.session!.accessKeyId!
      });
      
      res.status(201).json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid preset data", errors: error.errors });
      }
      console.error('Error creating preset:', error);
      res.status(500).json({ message: "Failed to create preset" });
    }
  });

  // Update preset (admin only)
  app.put("/api/presets/:id", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const updates = req.body;
      
      // Validate configuration if provided
      if (updates.configuration) {
        const configValidation = presetManager.validateConfiguration(JSON.parse(updates.configuration));
        
        if (!configValidation.isValid) {
          return res.status(400).json({ 
            message: "Invalid preset configuration", 
            errors: configValidation.errors 
          });
        }
      }
      
      const preset = await storage.updateLaunchPreset(req.params.id, updates);
      
      if (!preset) {
        return res.status(404).json({ message: "Preset not found" });
      }
      
      res.json(preset);
    } catch (error) {
      console.error('Error updating preset:', error);
      res.status(500).json({ message: "Failed to update preset" });
    }
  });

  // Delete preset (admin only)
  app.delete("/api/presets/:id", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteLaunchPreset(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Preset not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting preset:', error);
      res.status(500).json({ message: "Failed to delete preset" });
    }
  });

  // Preview preset configuration
  app.get("/api/presets/:id/preview", async (req, res) => {
    try {
      const presetConfig = await presetManager.getPresetConfiguration(req.params.id);
      
      if (!presetConfig) {
        return res.status(404).json({ message: "Preset not found" });
      }
      
      res.json(presetConfig);
    } catch (error) {
      console.error('Error previewing preset:', error);
      res.status(500).json({ message: "Failed to preview preset" });
    }
  });

  // Get preset usage statistics  
  app.get("/api/presets/:id/stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getPresetUsageStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching preset stats:', error);
      res.status(500).json({ message: "Failed to fetch preset statistics" });
    }
  });

  // ===== USER PRESET MANAGEMENT API ROUTES =====

  // Get user's saved presets
  app.get("/api/user-presets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const presets = await storage.getUserPresets(accessKeyId);
      res.json(presets);
    } catch (error) {
      console.error('Error fetching user presets:', error);
      res.status(500).json({ message: "Failed to fetch user presets" });
    }
  });

  // Get specific user preset
  app.get("/api/user-presets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const preset = await storage.getUserPreset(req.params.id, accessKeyId);
      
      if (!preset) {
        return res.status(404).json({ message: "User preset not found" });
      }
      
      res.json(preset);
    } catch (error) {
      console.error('Error fetching user preset:', error);
      res.status(500).json({ message: "Failed to fetch user preset" });
    }
  });

  // Create new user preset
  app.post("/api/user-presets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const { insertUserPresetSchema } = await import('@shared/schema');
      const validatedData = insertUserPresetSchema.parse(req.body);
      
      // Validate configuration using preset manager
      const configValidation = presetManager.validateConfiguration(JSON.parse(validatedData.configuration));
      
      if (!configValidation.isValid) {
        return res.status(400).json({ 
          message: "Invalid preset configuration", 
          errors: configValidation.errors 
        });
      }
      
      const preset = await storage.createUserPreset(validatedData, accessKeyId);
      
      res.status(201).json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid preset data", errors: error.errors });
      }
      console.error('Error creating user preset:', error);
      res.status(500).json({ message: "Failed to create user preset" });
    }
  });

  // Update user preset
  app.put("/api/user-presets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const updates = req.body;
      
      // Validate configuration if provided
      if (updates.configuration) {
        const configValidation = presetManager.validateConfiguration(JSON.parse(updates.configuration));
        
        if (!configValidation.isValid) {
          return res.status(400).json({ 
            message: "Invalid preset configuration", 
            errors: configValidation.errors 
          });
        }
      }
      
      const preset = await storage.updateUserPreset(req.params.id, updates, accessKeyId);
      
      if (!preset) {
        return res.status(404).json({ message: "User preset not found" });
      }
      
      res.json(preset);
    } catch (error) {
      console.error('Error updating user preset:', error);
      res.status(500).json({ message: "Failed to update user preset" });
    }
  });

  // Delete user preset
  app.delete("/api/user-presets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const deleted = await storage.deleteUserPreset(req.params.id, accessKeyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "User preset not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user preset:', error);
      res.status(500).json({ message: "Failed to delete user preset" });
    }
  });

  // ===== PRESET APPLICATION API ROUTES =====

  // Apply preset to launch plan
  app.post("/api/launch-plans/:id/apply-preset", requireAuth, async (req: AuthRequest, res) => {
    try {
      const launchPlanId = req.params.id;
      const { presetId, customizations } = req.body;
      
      if (!presetId) {
        return res.status(400).json({ message: "Preset ID is required" });
      }
      
      // Apply preset to launch plan
      const result = await presetManager.applyPresetToLaunchPlan(presetId, launchPlanId, customizations);
      
      // Track preset usage
      await storage.updateUserPresetUsage(presetId, req.session!.accessKeyId!);
      
      res.json({
        message: "Preset applied successfully",
        launchPlan: result.launchPlan,
        appliedConfig: result.appliedConfig
      });
    } catch (error) {
      console.error('Error applying preset:', error);
      res.status(500).json({ 
        message: "Failed to apply preset",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Validate preset configuration
  app.post("/api/presets/validate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { configuration } = req.body;
      
      if (!configuration) {
        return res.status(400).json({ message: "Configuration is required" });
      }
      
      const validation = presetManager.validateConfiguration(configuration);
      
      res.json(validation);
    } catch (error) {
      console.error('Error validating preset configuration:', error);
      res.status(500).json({ message: "Failed to validate configuration" });
    }
  });

  // Merge preset configurations
  app.post("/api/presets/merge", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { basePresetId, customizations } = req.body;
      
      if (!basePresetId) {
        return res.status(400).json({ message: "Base preset ID is required" });
      }
      
      const baseConfig = await presetManager.getPresetConfiguration(basePresetId);
      
      if (!baseConfig) {
        return res.status(404).json({ message: "Base preset not found" });
      }
      
      const mergedConfig = presetManager.mergeConfigurations(baseConfig, customizations || {});
      
      res.json({
        mergedConfig,
        validation: presetManager.validateConfiguration(mergedConfig)
      });
    } catch (error) {
      console.error('Error merging preset configurations:', error);
      res.status(500).json({ 
        message: "Failed to merge configurations",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===== PRESET ANALYTICS API ROUTES =====

  // Get preset analytics
  app.get("/api/presets/:id/analytics", requireAuth, async (req: AuthRequest, res) => {
    try {
      const analytics = await storage.getPresetAnalytics(req.params.id);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching preset analytics:', error);
      res.status(500).json({ message: "Failed to fetch preset analytics" });
    }
  });

  // Get user's preset analytics
  app.get("/api/user-presets/:id/analytics", requireAuth, async (req: AuthRequest, res) => {
    try {
      const analytics = await storage.getUserPresetAnalytics(req.params.id);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching user preset analytics:', error);
      res.status(500).json({ message: "Failed to fetch user preset analytics" });
    }
  });

  // Get all analytics for user
  app.get("/api/analytics/presets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const analytics = await storage.getPresetAnalyticsByUser(accessKeyId);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Create preset analytics record
  app.post("/api/analytics/presets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const accessKeyId = req.session!.accessKeyId!;
      const { insertPresetAnalyticsSchema } = await import('@shared/schema');
      const validatedData = insertPresetAnalyticsSchema.parse({
        ...req.body,
        accessKeyId
      });
      
      const analytics = await storage.createPresetAnalytics(validatedData);
      
      res.status(201).json(analytics);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid analytics data", errors: error.errors });
      }
      console.error('Error creating preset analytics:', error);
      res.status(500).json({ message: "Failed to create analytics record" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
