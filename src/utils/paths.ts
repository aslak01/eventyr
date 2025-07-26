export function createPathHelper(basePath: string) {
  const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const cleanBasePath = basePath === '' ? '' : normalizedBasePath.replace(/\/$/, '');
  
  return {
    asset: (path: string) => `${cleanBasePath}${path.startsWith('/') ? path : `/${path}`}`,
    page: (path: string) => `${cleanBasePath}${path.startsWith('/') ? path : `/${path}`}`,
  };
}