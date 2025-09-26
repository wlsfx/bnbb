import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertWalletSchema, insertLaunchPlanSchema, insertBundleExecutionSchema, 
  insertActivitySchema, insertSystemMetricsSchema, insertStealthFundingSnapshotSchema, 
  insertEnvironmentConfigSchema, insertLaunchSessionSchema, insertBundleTransactionSchema,
  wallets, activities, systemMetrics, stealthFundingSnapshots, environmentConfig, launchSessions,
  BundleExecution, BUNDLE_STATUS, TRANSACTION_STATUS
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Wallet routes
  app.get("/api/wallets", async (req, res) => {
    try {
      const wallets = await storage.getWallets();
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallets/:id", async (req, res) => {
    try {
      const wallet = await storage.getWallet(req.params.id);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  app.post("/api/wallets", async (req, res) => {
    try {
      const validatedData = insertWalletSchema.parse(req.body);
      const wallet = await storage.createWallet(validatedData);
      
      // Create activity for wallet generation
      await storage.createActivity({
        type: "wallet_generated",
        description: `Wallet ${wallet.label || wallet.id} generated`,
        walletId: wallet.id,
        status: "confirmed",
      });

      res.status(201).json(wallet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid wallet data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });

  app.post("/api/wallets/bulk", async (req, res) => {
    try {
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
        
        const wallet = await storage.createWallet(walletData);
        wallets.push(wallet);
      }

      // Create bulk activity
      await storage.createActivity({
        type: "bulk_wallet_generation",
        description: `Generated ${count} wallets`,
        status: "confirmed",
      });

      res.status(201).json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to create wallets" });
    }
  });

  app.patch("/api/wallets/:id", async (req, res) => {
    try {
      const wallet = await storage.updateWallet(req.params.id, req.body);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  app.delete("/api/wallets/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWallet(req.params.id);
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
      const result = await storage.executeInTransaction(async (tx) => {
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

  // Statistics endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const wallets = await storage.getWallets();
      const activeWallets = await storage.getWalletsByStatus("active");
      const totalBalance = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);
      
      res.json({
        totalWallets: wallets.length,
        activeWallets: activeWallets.length,
        totalBalance: totalBalance.toFixed(8),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Enhanced Wallet routes
  app.get("/api/wallets/health/:health", async (req, res) => {
    try {
      const wallets = await storage.getWalletsByHealth(req.params.health);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wallets by health" });
    }
  });

  app.post("/api/wallets/:id/heartbeat", async (req, res) => {
    try {
      const wallet = await storage.updateWalletHeartbeat(req.params.id);
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

      const totalBalance = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);
      const healthDistribution = wallets.reduce((acc, wallet) => {
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

      const filteredSnapshots = snapshots.filter(snapshot => 
        new Date(snapshot.createdAt) >= cutoffTime
      );

      const totalGross = filteredSnapshots.reduce((sum, snap) => sum + parseFloat(snap.grossAmount), 0);
      const totalNet = filteredSnapshots.reduce((sum, snap) => sum + parseFloat(snap.netAmount), 0);
      const totalTax = filteredSnapshots.reduce((sum, snap) => sum + parseFloat(snap.taxAmount), 0);

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
      const totalTransactions = analytics.reduce((sum, a) => sum + a.totalTransactions, 0);
      const successfulTransactions = analytics.reduce((sum, a) => sum + a.successfulTransactions, 0);
      const failedTransactions = analytics.reduce((sum, a) => sum + a.failedTransactions, 0);
      const avgSuccessRate = totalTransactions > 0 
        ? ((successfulTransactions / totalTransactions) * 100).toFixed(2)
        : "0";
      
      const avgConfirmationTime = analytics.reduce((sum, a) => 
        sum + (a.avgConfirmationTime || 0), 0) / (analytics.filter(a => a.avgConfirmationTime).length || 1);
      
      const totalGasUsed = analytics.reduce((sum, a) => 
        sum + parseFloat(a.totalGasUsed || "0"), 0);
      
      const totalValue = analytics.reduce((sum, a) => 
        sum + parseFloat(a.totalValue || "0"), 0);
        
      const totalFees = analytics.reduce((sum, a) => 
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
        const completedCount = totalTransactions.filter(t => 
          t.status === TRANSACTION_STATUS.CONFIRMED
        ).length;
        const failedCount = totalTransactions.filter(t => 
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

  const httpServer = createServer(app);
  return httpServer;
}
