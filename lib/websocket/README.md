# WebSocket Setup

This folder has all the code for connecting to real-time order book data.

## How it's organized

The WebSocket code is split into different files to keep things organized:

### Main Files

- **`client.ts`** - Handles connecting to the WebSocket, reconnecting when it fails, and processing messages
- **`logger.ts`** - Simple logging system to help debug issues
- **`order-book-utils.ts`** - Helper functions for working with order book data

### Settings & Types

- **`/constants/websocket.ts`** - WebSocket settings and configuration
- **`/types/websocket.ts`** - TypeScript type definitions

### How to use it

```typescript
import { useOrderBook, useWebSocket } from '@/hooks/use-websocket-provider';

// Basic WebSocket connection
const { isConnected, subscribeToProduct } = useWebSocket();

// Get order book data for a specific trading pair
const { orderBook, formatPrice, formatSize } = useOrderBook('BTC-USD');
```

## What it does

- **Auto-reconnect** - If the connection drops, it tries to reconnect automatically
- **Smart subscriptions** - Won't subscribe to the same data twice
- **Type safety** - Uses TypeScript to catch errors before they happen
- **Good logging** - Helps you see what's happening and debug problems
- **Clean code** - Each file has one job, making it easier to work with
- **Fast updates** - Efficiently handles order book changes

## Error handling

The system handles common problems:

- Connection issues with automatic retry
- Bad data from the server
- Problems with subscriptions
- Shows errors to users when needed
