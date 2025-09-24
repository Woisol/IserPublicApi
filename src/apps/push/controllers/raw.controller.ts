import { Controller, Get, Req, Redirect } from '@nestjs/common';
import { type Request } from 'express';

@Controller('push')
export class RawMessageController {
  /**
   * 发送文本消息 - 重定向到默认渠道(保留query参数)
   */
  // ! 纯 @Redirect 会抛弃 query 参数
  @Get('msg')
  @Redirect()
  redirectToGeneralText(@Req() req: Request) {
    const queryString = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const redirectUrl = `/push/general/msg${queryString ? `?${queryString}` : ''}`;
    return { url: redirectUrl, statusCode: 302 };
  }

  /**
   * markdown 消息 - 重定向到默认渠道(保留query参数)
   */
  @Get('msg/md')
  @Redirect()
  redirectToGeneralMarkdown(@Req() req: Request) {
    const queryString = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const redirectUrl = `/push/general/md${queryString ? `?${queryString}` : ''}`;
    return { url: redirectUrl, statusCode: 302 };
  }
}
