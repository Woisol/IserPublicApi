export interface ComfyUiPushQuery {
  status: 'success' | 'error';
  seed: number;
  elapsed: number;
  res: number;
  scale: number;
  duration: number;
  filename: string;
  path: string;
}
