# JustJewIt - Stealth Bundler Platform

## Overview
JustJewIt is a sophisticated multi-wallet cryptocurrency launcher application designed for managing token launches and bundle executions across multiple wallets. The application provides a comprehensive dashboard for wallet generation, funding, monitoring, and executing coordinated trading strategies on BNB Smart Chain (BSC). Built as a full-stack web application, it features real-time monitoring capabilities, system metrics tracking, advanced stealth patterns, and a secure authentication system.

## Authentication & Access Control

### Admin Key
- Master Admin Key: Set via `MASTER_ADMIN_KEY` environment variable
- Admin keys use prefix: `WLSFX-`
- User keys use prefix: `JJIT-`
- All keys are 24 characters in length

### Routes
- `/` - Login page (public)
- `/dashboard` - Main dashboard (requires authentication)
- `/admin` - Admin panel (admin only)
  - Access key management
  - Environment configuration
  - Security audit logs
  - System monitoring

## User Preferences
- Preferred communication style: Simple, everyday language
- Key format: Admin keys with WLSFX- prefix, User keys with JJIT- prefix

## System Architecture

### Frontend Architecture
The client-side application is built using React with TypeScript, utilizing Vite as the build tool and development server. The UI framework is based on shadcn/ui components with Radix UI primitives, providing a consistent and accessible design system. The application uses Wouter for client-side routing and TanStack Query for server state management and caching.

State management is handled through Zustand stores, with separate stores for wallet management (`useWalletStore`) and system monitoring (`useSystemStore`). The architecture implements real-time updates through polling mechanisms, refreshing critical data like system metrics, activities, and wallet statuses at regular intervals.

The styling approach uses Tailwind CSS with custom CSS variables for theming, implementing a dark theme optimized for financial applications. Component organization follows a modular structure with reusable UI components, layout components, and feature-specific components.

### Backend Architecture
The server is built with Express.js using TypeScript, implementing a RESTful API architecture. The application uses a database storage pattern (`DbStorage`) that implements a comprehensive `IStorage` interface, providing methods for managing users, wallets, launch plans, bundle executions, activities, system metrics, access keys, sessions, and audit logs.

The server implements comprehensive logging middleware that captures API requests, response times, and response data for debugging and monitoring purposes. Error handling is centralized through Express middleware, providing consistent error responses across the application.

#### Core Services
- **Bundle Executor**: Orchestrates multi-wallet token launches with stealth patterns
- **Blockchain Client**: BSC integration with Quicknode RPC endpoints
- **Job Queue**: Bull/Redis with in-memory fallback for transaction processing
- **Stealth Patterns**: Randomized delays, gas variance, proxy rotation
- **RPC Resilience**: Multi-endpoint support with circuit breakers
- **Security Middleware**: Authentication, CSRF protection, rate limiting, encryption

The API structure includes dedicated routes for:
- Authentication and session management
- Wallet management (CRUD operations, status updates)
- Launch plan configuration and execution
- Bundle execution monitoring and control
- Activity logging and retrieval
- System metrics collection
- Admin functions and access control

## Data Storage Solutions
The application uses PostgreSQL database with Drizzle ORM for type-safe database operations. The schema includes comprehensive tables for all entities with proper relationships and constraints. UUID generation is handled at the database level for unique identifiers.

Key tables include:
- Users, wallets, launch plans, bundle executions
- Bundle transactions, transaction events, bundle analytics
- Access keys, user sessions, audit logs
- Environment configs, proxy configs, network health metrics

## Authentication and Authorization
The application implements a secure access key-based authentication system:
- 24-character access keys with role-based prefixes
- BCrypt hashing for secure key storage
- Session-based authentication with unique sessions per login
- Admin and user role separation
- Comprehensive audit logging
- Rate limiting on authentication attempts

## Development and Build System
The application uses a modern development setup with:
- Vite for fast development and optimized production builds
- ESBuild for server-side bundling
- TypeScript for type safety across the entire application
- Path aliases for clean import statements
- Separate build processes for client and server code

The development environment includes Replit-specific plugins for error handling and development banners, with proper environment detection for production deployments.

## External Dependencies

### Database Integration
- **Neon Database**: Configured as the primary PostgreSQL provider via `@neondatabase/serverless`
- **Drizzle ORM**: Type-safe database queries and migrations with PostgreSQL dialect
- **Drizzle Kit**: Database migration and schema management tools

### Blockchain & Web3
- **Ethers.js**: Ethereum/BSC blockchain interaction and wallet management
- **Quicknode**: BSC mainnet RPC provider (configured via environment secrets)

### Queue & Background Jobs
- **Bull**: Job queue for bundle execution orchestration
- **ioredis**: Redis client (with in-memory fallback when Redis unavailable)

### UI Framework and Styling
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives for components
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration
- **Tailwind CSS Animate**: Animation utilities for enhanced user interactions
- **Class Variance Authority**: Utility for creating variant-based component APIs
- **Lucide React**: Icon library providing consistent iconography throughout the application

### State Management and Data Fetching
- **TanStack React Query**: Powerful server state management, caching, and synchronization
- **Zustand**: Lightweight state management for client-side application state
- **React Hook Form**: Form state management and validation with Zod integration

### Security
- **BCrypt**: Password and access key hashing
- **Express Session**: Session management with PostgreSQL store
- **Connect-pg-simple**: PostgreSQL session store
- **Express Rate Limit**: API rate limiting for security

### Development and Build Tools
- **Vite**: Fast build tool and development server with React plugin support
- **TypeScript**: Static type checking across the entire application
- **ESBuild**: Fast JavaScript bundler for production server builds
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer plugins

### Utility Libraries
- **Date-fns**: Date manipulation and formatting utilities
- **Nanoid**: URL-safe unique ID generation
- **Zod**: Runtime type validation and schema definition
- **CLSX & Tailwind Merge**: Utility functions for conditional and merged CSS classes

## Recent Updates

### September 27, 2025 - BSC Testnet Configuration
- **BSC Testnet Support**: Added comprehensive testnet environment (Chain ID 97)
- **Dual Environment Setup**: Both mainnet and testnet configurations available
- **Default Environment**: Application now defaults to BSC testnet for safe testing
- **Wallet Generation**: Full wallet generation and funding tested on testnet
- **Initial Balance Funding**: Wallets can be created with testBNB balance automatically

### Wallet Funding Methods
**1. Initial Balance Parameter** ✅ **WORKING**
- Create wallets with testBNB during generation
- API: `POST /api/wallets/generate` with `{"initialBalance": "0.1"}`

**2. External Funding**
- Use BSC testnet faucets: https://testnet.binance.org/faucet-smart
- Send testBNB to generated wallet addresses
- Block explorer: https://testnet.bscscan.com

**3. Built-in Funding Systems**
- `fundWallet()` function for existing wallets
- Bulk funding with distribution strategies
- Stealth funding capabilities for advanced operations

### September 26, 2025 - Authentication System
- Implemented secure access key-based authentication
- Admin panel with environment controls and key management
- Landing page with login interface
- Session management with unique sessions per login
- Audit logging for security monitoring

### Production Enhancements
- Bundle execution engine with stealth patterns
- RPC resilience with multi-endpoint support and circuit breakers
- Proxy rotation for actual RPC transport
- In-memory queue fallback when Redis unavailable
- Enhanced network status monitoring
- Private key encryption at rest

### Stealth Bundling Features
- Multi-wallet coordinated token launches
- Randomized per-wallet delays (300ms-2000ms variance)
- Gas price variance bands (±15% randomization)
- Wallet shuffling and staggered broadcast windows
- Proxy rotation per wallet for IP stealth
- Transaction retry with exponential backoff
- Real-time progress tracking and analytics

## Environment Secrets
The following secrets are configured:
- DATABASE_URL, PGDATABASE, PGHOST, PGPASSWORD, PGPORT, PGUSER
- QUICKNODE_BSC_URL, QUICKNODE_BSC_TOKEN (for BSC mainnet access)

## Current Status
The stealth bundler platform is fully functional with:
- **✅ TRUE DATABASE PERSISTENCE** - PostgreSQL with all 36 tables created
- **✅ ADMIN KEY CONFIGURED** - WLSFX-mnzWawH4glS0oRP0lg set as master admin
- **✅ BALANCE SYNC OPERATIONAL** - BSC testnet connectivity verified  
- **✅ PRIVATE KEY ENCRYPTION** - AES-256-CBC secure storage implemented
- Complete authentication system with admin controls
- Comprehensive bundle execution engine
- Production-ready resilience features
- BSC testnet integration for safe testing
- Real-time monitoring and analytics
- Secure multi-tenant architecture
- **DATA SURVIVES RESTARTS** - No more data loss on application restarts