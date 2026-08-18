export { WxworkAdapter } from './wxwork/wxwork.adapter';
export {
  QqbotAdapter,
  QqbotAuthService,
  QqbotMessageService,
  QqbotMarkdownMessageHelper,
} from './qqbot';
export type { PushAdapter } from '@app/apps/push/types/push-adapter';

export const PUSH_ADAPTERS = Symbol('PUSH_ADAPTERS');
