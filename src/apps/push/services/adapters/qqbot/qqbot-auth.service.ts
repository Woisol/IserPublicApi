import { Injectable } from '@nestjs/common';

interface QqbotAccessTokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class QqbotAuthService {
  private accessToken?: string;
  private expiresAt = 0;
  private refreshPromise?: Promise<string>;

  async getAccessToken(): Promise<string> {
    // 回顾：60_000 ✅
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const appId = process.env.QQBOT_APP_ID;
    const clientSecret = process.env.QQBOT_APP_SECRET;
    if (!appId || !clientSecret) {
      throw new Error('QQBOT_APP_ID and QQBOT_APP_SECRET are required');
    }

    const response = await fetch(
      'https://api.bot.qq.com/app/getAppAccessToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, clientSecret }),
      },
    );
    if (!response.ok) {
      throw new Error(`QQ Bot access token HTTP error: ${response.status}`);
    }

    const result = (await response.json()) as QqbotAccessTokenResponse;
    if (!result.access_token || !result.expires_in) {
      throw new Error('QQ Bot access token response is invalid');
    }
    this.accessToken = result.access_token;
    this.expiresAt = Date.now() + result.expires_in * 1000;
    return result.access_token;
  }
}
