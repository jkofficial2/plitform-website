export interface Factory {
  demo: boolean;
  name: string;
  shortName: string;
  region: string;
  phone: string;
  email: string;
  domain: string;
  address?: string;
  hours?: string;
  directionsUrl?: string;
}

// Replace these values only with confirmed factory details. No environment overrides.
export const factory: Factory = {
  demo: true,
  name: 'Завод «ПлитФорм»',
  shortName: 'ПлитФорм',
  region: 'Ростов-на-Дону и Ростовская область',
  phone: '+7 (000) 000-00-00',
  email: 'sales@plitform.example',
  domain: 'https://plitform.example',
};

export function getLiveSite(data: Factory): string | undefined {
  if (data.demo) return undefined;
  const url = new URL(data.domain);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Укажите рабочий HTTPS-домен без пути и параметров в src/data/factory.ts.');
  }
  if (!url.hostname.includes('.') || /(^|\.)(example|test|invalid|localhost)$/.test(url.hostname)) {
    throw new Error('Рабочий режим требует настоящего домена.');
  }
  if (!/^\+\d{10,15}$/.test(data.phone.replace(/[\s()-]/g, '')) || data.phone.includes('(000)')) {
    throw new Error('Укажите подтверждённый телефон завода.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /\.(example|test|invalid)$/i.test(data.email)) {
    throw new Error('Укажите подтверждённую почту завода.');
  }
  return url.origin;
}

export const liveSite = getLiveSite(factory);
export const phoneHref = factory.demo ? undefined : `tel:${factory.phone.replace(/[\s()-]/g, '')}`;
export const emailHref = factory.demo ? undefined : `mailto:${factory.email}`;
