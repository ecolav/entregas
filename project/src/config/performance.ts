// Configurações de performance da aplicação
export const PERFORMANCE_CONFIG = {
  // Cache
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos
  CACHE_MAX_SIZE: 100, // Máximo de itens no cache
  
  // Auto-refresh
  AUTO_REFRESH_INTERVAL: 2 * 60 * 1000, // 2 minutos
  CHECK_INTERVAL: 30 * 1000, // 30 segundos
  
  // Paginação
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  
  // Debounce para inputs
  DEBOUNCE_DELAY: 300, // 300ms
  
  // Timeout para requisições
  REQUEST_TIMEOUT: 10000, // 10 segundos
  
  // Retry
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 segundo
  
  // Lazy loading
  LAZY_LOAD_THRESHOLD: 100, // pixels antes do final da lista
};

// Função para debounce
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Função para throttle
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
