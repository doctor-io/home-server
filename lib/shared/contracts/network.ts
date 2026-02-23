export type NetworkStatus = {
  connected: boolean;
  iface: string | null;
  ssid: string | null;
  ipv4: string | null;
  signalPercent: number | null;
};

export type WifiAccessPoint = {
  ssid: string;
  bssid: string | null;
  signalPercent: number | null;
  channel: number | null;
  frequencyMhz: number | null;
  security: string | null;
};

export type ConnectNetworkRequest = {
  ssid: string;
  password?: string;
};

export type DisconnectNetworkRequest = {
  iface?: string;
};

export type NetworkEventType =
  | "network.connection.changed"
  | "network.device.state.changed";

export type NetworkEvent = {
  type: NetworkEventType;
  timestamp: string;
  iface: string | null;
  ssid: string | null;
  connected: boolean;
  state?: string;
  reason?: string;
};

export type NetworkServiceErrorCode =
  | "helper_unavailable"
  | "network_manager_unavailable"
  | "auth_failed"
  | "timeout"
  | "invalid_request"
  | "internal_error";
