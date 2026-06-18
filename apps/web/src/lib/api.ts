import axios from 'axios';

/**
 * URL base del API. En la app de escritorio (Electron) la web va empaquetada y
 * se configura en runtime cuál es el API del tenant (window.electronAPI.apiUrl).
 * En la web normal se hornea en build (VITE_API_URL); en dev va vacía y el
 * proxy de Vite reenvía /api a la API.
 */
export const apiBaseUrl = (
  window.electronAPI?.apiUrl ||
  import.meta.env.VITE_API_URL ||
  ''
).replace(/\/+$/, '');

/**
 * Cliente HTTP centralizado. withCredentials: true → manda/recibe la cookie
 * httpOnly de sesión.
 */
export const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  withCredentials: true,
});

/**
 * Guarda anti-HTML: si VITE_API_URL falta o el backend no responde, la request
 * puede caer en el dev server y volver index.html (status 200). Sin esto, ese
 * string HTML se cuela como "datos" y rompe los componentes. Lo convertimos
 * en error de query visible.
 */
api.interceptors.response.use((response) => {
  const contentType = String(response.headers?.['content-type'] ?? '');
  const looksLikeHtml =
    contentType.includes('text/html') ||
    (typeof response.data === 'string' && /^\s*<(?:!doctype|html)/i.test(response.data));

  if (looksLikeHtml) {
    throw new Error(
      'API devolvió HTML en vez de JSON. Falta VITE_API_URL o el backend no responde.',
    );
  }
  return response;
});
