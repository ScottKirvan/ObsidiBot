// Tell TypeScript that .jpg imports are data URLs (handled by esbuild's dataurl loader)
declare module '*.jpg' {
  const dataUrl: string;
  export default dataUrl;
}
