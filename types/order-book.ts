export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface OrderBookTableProps {
  orders: OrderBookEntry[];
  isBid: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  baseCurrency: string;
  maxSize: number;
  formatPrice: (price: string) => string;
  formatSize: (size: string) => string;
  calculateTotal: (price: string, size: string) => string;
}
