export type McServerWebhookPayload = {
  event: 'server_started' | 'server_stopped' | 'player_joined' | 'player_left';
  playerName?: string;
  currentPlayers?: string[];
};
