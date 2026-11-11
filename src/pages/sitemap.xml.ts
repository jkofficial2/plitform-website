import type { APIRoute } from 'astro';
import { liveSite } from '../data/factory';
import { products, productHref } from '../data/products';
export const GET: APIRoute = () => {
  if (!liveSite) return new Response(null, { status: 404 });
  const paths = ['/', '/produktsiya/', ...products.map(product => productHref(product.slug)), '/kontakty/'];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${new URL(path, liveSite).href}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
