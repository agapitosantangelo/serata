// Tiny DOM helpers. User-provided strings always go in as text nodes.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'svg') node.innerHTML = value; // trusted static markup from art.js only
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const AVATARS = ['🦊', '🐼', '🐸', '🦉', '🐙', '🦄', '🐯', '🐨', '🐵', '🐧', '🦁', '🐷', '🐻', '🐰', '🐲', '👻', '🤖', '👽', '🐢', '🦖'];

export function safeName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Anonimo';
}

export function safeAvatar(value) {
  return AVATARS.includes(value) ? value : AVATARS[0];
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported (iOS) */ }
}
