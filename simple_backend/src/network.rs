use ethers::prelude::*;
use ethers::providers::{Provider, Http, Middleware};
use ethers::types::{U256, Address};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use chrono::{DateTime, Utc};
use anyhow::{Result, Context};
use backoff::{ExponentialBackoff, future::retry};
use std::str::FromStr;

// Network configuration for optimized connectivity
#[derive(Debug, Clone)]
pub struct NetworkConfig {
    pub request_timeout: Duration,
    pub connection_timeout: Duration,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub keep_alive_timeout: Duration,
    pub proxy_url: Option<String>,
    pub proxy_rotation_interval: Option<Duration>,
    pub circuit_breaker_threshold: u32,
    pub circuit_breaker_timeout: Duration,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        NetworkConfig {
            request_timeout: Duration::from_secs(30),
            connection_timeout: Duration::from_secs(10),
            max_retries: 3,
            retry_delay_ms: 1000,
            keep_alive_timeout: Duration::from_secs(60),
            proxy_url: std::env::var("PROXY_URL").ok(),
            proxy_rotation_interval: None,
            circuit_breaker_threshold: 5,
            circuit_breaker_timeout: Duration::from_secs(60),
        }
    }
}

// Health status for monitoring
#[derive(Debug, Clone)]
pub struct HealthStatus {
    pub is_healthy: bool,
    pub last_check: DateTime<Utc>,
    pub avg_latency_ms: f64,
    pub success_rate: f64,
    pub last_error: Option<String>,
    pub circuit_breaker_status: CircuitBreakerStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerStatus {
    Closed,
    Open,
    HalfOpen,
}

// Circuit breaker implementation
pub struct CircuitBreaker {
    status: Arc<std::sync::Mutex<CircuitBreakerStatus>>,
    failure_count: Arc<AtomicU64>,
    last_failure_time: Arc<std::sync::Mutex<Option<DateTime<Utc>>>>,
    threshold: u32,
    timeout: Duration,
}

impl CircuitBreaker {
    pub fn new(threshold: u32, timeout: Duration) -> Self {
        CircuitBreaker {
            status: Arc::new(std::sync::Mutex::new(CircuitBreakerStatus::Closed)),
            failure_count: Arc::new(AtomicU64::new(0)),
            last_failure_time: Arc::new(std::sync::Mutex::new(None)),
            threshold,
            timeout,
        }
    }

    pub fn record_success(&self) {
        self.failure_count.store(0, Ordering::Relaxed);
        *self.status.lock().unwrap() = CircuitBreakerStatus::Closed;
    }

    pub fn record_failure(&self) {
        let count = self.failure_count.fetch_add(1, Ordering::Relaxed) + 1;
        *self.last_failure_time.lock().unwrap() = Some(Utc::now());
        
        if count >= self.threshold as u64 {
            *self.status.lock().unwrap() = CircuitBreakerStatus::Open;
            println!("⚠️ Circuit breaker opened after {} failures", count);
        }
    }

    pub fn can_execute(&self) -> bool {
        let mut status = self.status.lock().unwrap();
        match *status {
            CircuitBreakerStatus::Closed => true,
            CircuitBreakerStatus::Open => {
                let last_failure = self.last_failure_time.lock().unwrap();
                if let Some(time) = *last_failure {
                    if Utc::now().signed_duration_since(time).num_seconds() > self.timeout.as_secs() as i64 {
                        *status = CircuitBreakerStatus::HalfOpen;
                        println!("🔄 Circuit breaker moving to half-open state");
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            },
            CircuitBreakerStatus::HalfOpen => true,
        }
    }

    pub fn get_status(&self) -> CircuitBreakerStatus {
        self.status.lock().unwrap().clone()
    }
}

// Enhanced blockchain service with retry logic and health monitoring
pub struct EnhancedBlockchainService {
    provider: Provider<Http>,
    chain_id: u64,
    network_config: NetworkConfig,
    health_status: Arc<std::sync::Mutex<HealthStatus>>,
    request_count: Arc<AtomicU64>,
    failure_count: Arc<AtomicU64>,
    circuit_breaker: CircuitBreaker,
}

impl EnhancedBlockchainService {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let network_config = NetworkConfig::default();
        let quicknode_url = std::env::var("QUICKNODE_BSC_URL")
            .unwrap_or_else(|_| "https://bsc-mainnet.core.chainstack.com".to_string());
        
        let quicknode_token = std::env::var("QUICKNODE_BSC_TOKEN").ok();
        
        let provider_url = if let Some(token) = quicknode_token {
            format!("{}?token={}", quicknode_url, token)
        } else {
            quicknode_url
        };
        
        println!("🔗 Connecting to BNB Smart Chain with enhanced network configuration...");
        println!("🔄 Retry policy: {} retries with exponential backoff", network_config.max_retries);
        println!("🚦 Circuit breaker: threshold={}, timeout={:?}", 
            network_config.circuit_breaker_threshold, 
            network_config.circuit_breaker_timeout);
        
        // Create provider with retry
        let provider = Self::retry_with_backoff(|| async {
            Provider::<Http>::try_from(provider_url.clone())
                .map_err(|e| anyhow::anyhow!("Failed to create provider: {}", e))
        }, network_config.max_retries).await?;
        
        // BSC Mainnet Chain ID
        let chain_id = 56u64;
        
        // Test connection with retry
        let block_number = Self::retry_with_backoff(|| async {
            provider.get_block_number().await
                .map_err(|e| anyhow::anyhow!("Failed to get block number: {}", e))
        }, network_config.max_retries).await?;
        
        println!("✅ Connected to BNB Smart Chain (BSC) Mainnet");
        println!("📊 Current block number: {}", block_number);
        
        let health_status = Arc::new(std::sync::Mutex::new(HealthStatus {
            is_healthy: true,
            last_check: Utc::now(),
            avg_latency_ms: 0.0,
            success_rate: 100.0,
            last_error: None,
            circuit_breaker_status: CircuitBreakerStatus::Closed,
        }));
        
        let circuit_breaker = CircuitBreaker::new(
            network_config.circuit_breaker_threshold,
            network_config.circuit_breaker_timeout,
        );
        
        Ok(EnhancedBlockchainService {
            provider,
            chain_id,
            network_config,
            health_status,
            request_count: Arc::new(AtomicU64::new(0)),
            failure_count: Arc::new(AtomicU64::new(0)),
            circuit_breaker,
        })
    }
    
    // Helper function for retry with exponential backoff
    async fn retry_with_backoff<T, F, Fut>(
        operation: F,
        max_retries: u32,
    ) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let mut backoff = ExponentialBackoff::default();
        backoff.max_elapsed_time = Some(Duration::from_secs(60));
        backoff.max_interval = Duration::from_secs(30);
        
        let mut attempt = 0;
        loop {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) if attempt < max_retries => {
                    attempt += 1;
                    let delay = backoff.next_backoff()
                        .unwrap_or(Duration::from_secs(30));
                    
                    println!("⚠️ Request failed (attempt {}/{}): {}. Retrying in {:?}...", 
                        attempt, max_retries, e, delay);
                        
                    tokio::time::sleep(delay).await;
                },
                Err(e) => {
                    println!("❌ Request failed after {} attempts: {}", max_retries, e);
                    return Err(e);
                }
            }
        }
    }
    
    // Execute with circuit breaker
    async fn execute_with_circuit_breaker<T, F, Fut>(&self, operation: F) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        if !self.circuit_breaker.can_execute() {
            return Err(anyhow::anyhow!("Circuit breaker is open"));
        }
        
        match operation().await {
            Ok(result) => {
                self.circuit_breaker.record_success();
                Ok(result)
            },
            Err(e) => {
                self.circuit_breaker.record_failure();
                Err(e)
            }
        }
    }
    
    // Perform health check
    pub async fn health_check(&self) -> Result<bool> {
        let start = std::time::Instant::now();
        
        match self.provider.get_block_number().await {
            Ok(_) => {
                let latency = start.elapsed().as_millis() as f64;
                let mut status = self.health_status.lock().unwrap();
                
                // Update average latency (exponential moving average)
                status.avg_latency_ms = status.avg_latency_ms * 0.9 + latency * 0.1;
                status.is_healthy = true;
                status.last_check = Utc::now();
                status.last_error = None;
                status.circuit_breaker_status = self.circuit_breaker.get_status();
                
                // Update success rate
                let total = self.request_count.load(Ordering::Relaxed) as f64;
                let failures = self.failure_count.load(Ordering::Relaxed) as f64;
                if total > 0.0 {
                    status.success_rate = ((total - failures) / total) * 100.0;
                }
                
                Ok(true)
            },
            Err(e) => {
                let mut status = self.health_status.lock().unwrap();
                status.is_healthy = false;
                status.last_check = Utc::now();
                status.last_error = Some(format!("{:?}", e));
                status.circuit_breaker_status = self.circuit_breaker.get_status();
                
                self.failure_count.fetch_add(1, Ordering::Relaxed);
                Ok(false)
            }
        }
    }
    
    // Get gas price with retry and circuit breaker
    pub async fn get_gas_price(&self) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
        self.request_count.fetch_add(1, Ordering::Relaxed);
        
        let result = self.execute_with_circuit_breaker(|| {
            Self::retry_with_backoff(|| async {
                self.provider.get_gas_price().await
                    .map_err(|e| anyhow::anyhow!("Failed to get gas price: {}", e))
            }, self.network_config.max_retries)
        }).await;
        
        match result {
            Ok(gas_price) => Ok(gas_price),
            Err(e) => {
                self.failure_count.fetch_add(1, Ordering::Relaxed);
                Err(Box::new(e))
            }
        }
    }
    
    // Get network stats with retry and circuit breaker
    pub async fn get_network_stats(&self) -> Result<(u64, U256), Box<dyn std::error::Error + Send + Sync>> {
        self.request_count.fetch_add(1, Ordering::Relaxed);
        
        let block_result = self.execute_with_circuit_breaker(|| {
            Self::retry_with_backoff(|| async {
                self.provider.get_block_number().await
                    .map_err(|e| anyhow::anyhow!("Failed to get block number: {}", e))
            }, self.network_config.max_retries)
        }).await;
        
        match block_result {
            Ok(block_number) => {
                let gas_price = self.get_gas_price().await?;
                Ok((block_number.as_u64(), gas_price))
            },
            Err(e) => {
                self.failure_count.fetch_add(1, Ordering::Relaxed);
                Err(Box::new(e))
            }
        }
    }
    
    // Get balance with retry and circuit breaker
    pub async fn get_balance(&self, address: &str) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
        self.request_count.fetch_add(1, Ordering::Relaxed);
        
        let addr = Address::from_str(address)?;
        
        let result = self.execute_with_circuit_breaker(|| {
            Self::retry_with_backoff(|| async {
                self.provider.get_balance(addr, None).await
                    .map_err(|e| anyhow::anyhow!("Failed to get balance: {}", e))
            }, self.network_config.max_retries)
        }).await;
        
        match result {
            Ok(balance) => Ok(balance),
            Err(e) => {
                self.failure_count.fetch_add(1, Ordering::Relaxed);
                Err(Box::new(e))
            }
        }
    }
    
    // Get current health metrics
    pub fn get_health_metrics(&self) -> HealthStatus {
        self.health_status.lock().unwrap().clone()
    }
    
    // Get request statistics
    pub fn get_stats(&self) -> (u64, u64, f64) {
        let total = self.request_count.load(Ordering::Relaxed);
        let failures = self.failure_count.load(Ordering::Relaxed);
        let success_rate = if total > 0 {
            ((total - failures) as f64 / total as f64) * 100.0
        } else {
            100.0
        };
        (total, failures, success_rate)
    }
    
    // Get provider for direct usage
    pub fn get_provider(&self) -> &Provider<Http> {
        &self.provider
    }
    
    // Get chain ID
    pub fn get_chain_id(&self) -> u64 {
        self.chain_id
    }
}