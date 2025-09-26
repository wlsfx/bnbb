# Overview

JustJewIt is a sophisticated multi-wallet cryptocurrency launcher application designed for managing token launches and bundle executions across multiple wallets. The application provides a comprehensive dashboard for wallet generation, funding, monitoring, and executing coordinated trading strategies. Built as a full-stack web application, it features real-time monitoring capabilities, system metrics tracking, and a modern React-based user interface optimized for financial operations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side application is built using React with TypeScript, utilizing Vite as the build tool and development server. The UI framework is based on shadcn/ui components with Radix UI primitives, providing a consistent and accessible design system. The application uses Wouter for client-side routing and TanStack Query for server state management and caching.

State management is handled through Zustand stores, with separate stores for wallet management (`useWalletStore`) and system monitoring (`useSystemStore`). The architecture implements real-time updates through polling mechanisms, refreshing critical data like system metrics, activities, and wallet statuses at regular intervals.

The styling approach uses Tailwind CSS with custom CSS variables for theming, implementing a dark theme optimized for financial applications. Component organization follows a modular structure with reusable UI components, layout components, and feature-specific components.

## Backend Architecture
The server is built with Express.js using TypeScript, implementing a RESTful API architecture. The application uses an in-memory storage pattern (`MemStorage`) that implements a comprehensive `IStorage` interface, providing methods for managing users, wallets, launch plans, bundle executions, activities, and system metrics.

The server implements comprehensive logging middleware that captures API requests, response times, and response data for debugging and monitoring purposes. Error handling is centralized through Express middleware, providing consistent error responses across the application.

The API structure includes dedicated routes for:
- Wallet management (CRUD operations, status updates)
- Launch plan configuration and execution
- Bundle execution monitoring and control
- Activity logging and retrieval
- System metrics collection

## Data Storage Solutions
The application currently uses an in-memory storage solution implemented through the `MemStorage` class. However, the architecture is designed with database abstraction through the `IStorage` interface, making it easy to swap to persistent storage solutions.

The data models are defined using Drizzle ORM schemas with PostgreSQL dialect configuration. The schema includes tables for users, wallets, launch plans, bundle executions, activities, and system metrics, all with proper relationships and constraints. UUID generation is handled at the database level for unique identifiers.

## Authentication and Authorization
The current implementation includes basic user management infrastructure with password-based authentication, though the authentication middleware is not fully implemented in the visible codebase. The foundation is laid for session-based authentication with user creation and retrieval methods.

## Development and Build System
The application uses a modern development setup with:
- Vite for fast development and optimized production builds
- ESBuild for server-side bundling
- TypeScript for type safety across the entire application
- Path aliases for clean import statements
- Separate build processes for client and server code

The development environment includes Replit-specific plugins for error handling and development banners, with proper environment detection for production deployments.

# External Dependencies

## Database Integration
- **Neon Database**: Configured as the primary PostgreSQL provider via `@neondatabase/serverless`
- **Drizzle ORM**: Type-safe database queries and migrations with PostgreSQL dialect
- **Drizzle Kit**: Database migration and schema management tools

## UI Framework and Styling
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives for components like dialogs, dropdowns, navigation, and form controls
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration
- **Tailwind CSS Animate**: Animation utilities for enhanced user interactions
- **Class Variance Authority**: Utility for creating variant-based component APIs
- **Lucide React**: Icon library providing consistent iconography throughout the application

## State Management and Data Fetching
- **TanStack React Query**: Powerful server state management, caching, and synchronization
- **Zustand**: Lightweight state management for client-side application state
- **React Hook Form**: Form state management and validation with Zod integration

## Development and Build Tools
- **Vite**: Fast build tool and development server with React plugin support
- **TypeScript**: Static type checking across the entire application
- **ESBuild**: Fast JavaScript bundler for production server builds
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer plugins

## Utility Libraries
- **Date-fns**: Date manipulation and formatting utilities
- **Nanoid**: URL-safe unique ID generation
- **Zod**: Runtime type validation and schema definition
- **CLSX & Tailwind Merge**: Utility functions for conditional and merged CSS classes

## Session Management
- **Connect-pg-simple**: PostgreSQL session store for Express sessions
- **Express Session**: Session middleware for user authentication (prepared for implementation)