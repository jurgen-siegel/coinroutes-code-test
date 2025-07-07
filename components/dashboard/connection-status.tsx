'use client';

import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/hooks/use-websocket-provider';

export function ConnectionStatus() {
  const { isConnected, isConnecting, error } = useWebSocket();

  if (error) {
    return (
      <Badge
        variant="destructive"
        className="text-xs"
      >
        Error
      </Badge>
    );
  }

  if (isConnecting) {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
      >
        Connecting...
      </Badge>
    );
  }

  if (isConnected) {
    return (
      <Badge
        variant="default"
        className="bg-green-500 text-xs"
      >
        Live
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="text-xs"
    >
      Disconnected
    </Badge>
  );
}
