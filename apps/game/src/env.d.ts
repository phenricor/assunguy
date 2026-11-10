declare module '*.css';
declare module '*.png' { const url: string; export default url; }
declare module './legacy/render.js' { export const hooks: Record<string, any>; export const vars: Record<string, any>; export const api: Record<string, any>; }
