// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Eureka\'s blog';

export const SITE_DESCRIPTION = 'Eureka\'s blog';

export const FAVICON_SRC = '/favicon.svg';

export const AVATAR_SRC = '/avatar.svg';

export const BIO = "星に祈れど、空は答えず、堕ちるは常に、隕の石のみ。";

export const GLOBAL_STYLE: 'quartz' | 'glass' | 'lightGlass' = 'lightGlass'

export const COPYRIGHT_NAME = 'Amaki Eureka';

export function imageDeliveryUrl(id: string, variant: 'public' | 'small'): string {
  return `https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/${id}/${variant}`
}