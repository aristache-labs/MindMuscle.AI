import AsyncStorage from '@react-native-async-storage/async-storage';
import { validationService } from '../services/validationService';
import { logger } from '../utils/logger';
import { ApiResponse } from './httpClient';

// Cache configuration
export interface CacheConfig {
  defaultTtl: number;
  maxSize: number;
  enablePersistence: boolean;
  enableCompression: boolean;
  enableMetrics: boolean;
  cleanupInterval: number;
}

// Cache entry metadata
export interface CacheEntryMetadata {
  key: string;
  size: number;
  accessCount: number;
  lastAccessed: number;
  created: number;
  ttl: number;
  tags: string[];
  priority: CachePriority;
  compressed: boolean;
}

// Cache priority levels
export enum CachePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

// Cache entry
export interface CacheEntry<T = unknown> {
  data: T;
  metadata: CacheEntryMetadata;
}

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  lastCleanup: number;
  memoryUsage: number;
}

// Cache invalidation strategies
export enum InvalidationStrategy {
  TTL = 'ttl',
  LRU = 'lru',
  LFU = 'lfu',
  PRIORITY = 'priority',
  TAG_BASED = 'tag_based',
}

// Cache warming configuration
export interface CacheWarmingConfig {
  enabled: boolean;
  strategies: string[];
  batchSize: number;
  interval: number;
  priority: CachePriority;
}

export class EnhancedCacheManager {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  private warmingTimer?: NodeJS.Timeout;
  private warmingConfig: CacheWarmingConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 300000, // 5 minutes
      maxSize: 100 * 1024 * 1024, // 100MB
      enablePersistence: true,
      enableCompression: false,
      enableMetrics: true,
      cleanupInterval: 60000, // 1 minute
      ...config,
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      lastCleanup: Date.now(),
      memoryUsage: 0,
    };

    this.warmingConfig = {
      enabled: false,
      strategies: [],
      batchSize: 10,
      interval: 300000, // 5 minutes
      priority: CachePriority.NORMAL,
    };

    this.startCleanupTimer();
    this.loadPersistedCache();
  }

  // Set cache entry
  async set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      priority?: CachePriority;
      persist?: boolean;
    } = {},
  ): Promise<void> {
    const {
      ttl = this.config.defaultTtl,
      tags = [],
      priority = CachePriority.NORMAL,
      persist = this.config.enablePersistence,
    } = options;

    // Calculate data size
    const serializedData = JSON.stringify(data);
    const size = new Blob([serializedData]).size;

    // Check if we need to evict entries
    await this.ensureCapacity(size);

    const metadata: CacheEntryMetadata = {
      key,
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
      created: Date.now(),
      ttl,
      tags,
      priority,
      compressed: false,
    };

    const entry: CacheEntry<T> = {
      data,
      metadata,
    };

    // Compress if enabled and data is large enough
    if (this.config.enableCompression && size > 1024) {
      // Note: In a real implementation, you'd use a compression library
      // For now, we'll just mark it as compressed
      entry.metadata.compressed = true;
    }

    this.cache.set(key, entry);
    this.updateStats();

    // Persist to storage if enabled
    if (persist) {
      await this.persistEntry(key, entry);
    }

    logger.debug('Cache entry set', {
      context: { key, size, ttl, tags, priority },
    });
  }

  // Get cache entry
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now > entry.metadata.created + entry.metadata.ttl) {
      await this.delete(key);
      this.recordMiss();
      return null;
    }

    // Update access metadata
    entry.metadata.accessCount++;
    entry.metadata.lastAccessed = now;

    this.recordHit();

    logger.debug('Cache entry retrieved', {
      context: { key, accessCount: entry.metadata.accessCount },
    });

    return entry.data;
  }

  // Delete cache entry
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.updateStats();

    // Remove from persistent storage
    if (this.config.enablePersistence) {
      await this.removePersistentEntry(key);
    }

    logger.debug('Cache entry deleted', { context: { key } });
    return true;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.metadata.created + entry.metadata.ttl) {
      this.delete(key); // Clean up expired entry
      return false;
    }

    return true;
  }

  // Clear all cache entries
  async clear(): Promise<void> {
    this.cache.clear();
    this.updateStats();

    if (this.config.enablePersistence) {
      await this.clearPersistentCache();
    }

    logger.info('Cache cleared');
  }

  // Invalidate by tags
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const hasMatchingTag = tags.some((tag) => entry.metadata.tags.includes(tag));
      if (hasMatchingTag) {
        await this.delete(key);
        invalidatedCount++;
      }
    }

    logger.info('Cache invalidated by tags', {
      context: { tags, invalidatedCount },
    });

    return invalidatedCount;
  }

  // Invalidate by pattern
  async invalidateByPattern(pattern: RegExp): Promise<number> {
    let invalidatedCount = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        await this.delete(key);
        invalidatedCount++;
      }
    }

    logger.info('Cache invalidated by pattern', {
      context: { pattern: pattern.toString(), invalidatedCount },
    });

    return invalidatedCount;
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Get cache entries by priority
  getEntriesByPriority(priority: CachePriority): string[] {
    const keys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.priority === priority) {
        keys.push(key);
      }
    }

    return keys;
  }

  // Warm cache with predefined strategies
  async warmCache(strategies: string[] = []): Promise<void> {
    if (!this.warmingConfig.enabled) return;

    const strategiesToUse = strategies.length > 0 ? strategies : this.warmingConfig.strategies;

    logger.info('Starting cache warming', {
      context: { strategies: strategiesToUse },
    });

    for (const strategy of strategiesToUse) {
      await this.executeWarmingStrategy(strategy);
    }
  }

  // Configure cache warming
  configureCacheWarming(config: Partial<CacheWarmingConfig>): void {
    this.warmingConfig = { ...this.warmingConfig, ...config };

    if (this.warmingConfig.enabled) {
      this.startWarmingTimer();
    } else {
      this.stopWarmingTimer();
    }

    logger.info('Cache warming configured', {
      context: { config: this.warmingConfig },
    });
  }

  // Ensure cache capacity
  private async ensureCapacity(requiredSize: number): Promise<void> {
    const currentSize = this.calculateTotalSize();

    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    // Evict entries using LRU strategy
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      // Sort by priority first, then by last accessed time
      if (a[1].metadata.priority !== b[1].metadata.priority) {
        return a[1].metadata.priority - b[1].metadata.priority;
      }
      return a[1].metadata.lastAccessed - b[1].metadata.lastAccessed;
    });

    let freedSize = 0;
    let evictedCount = 0;

    for (const [key, entry] of entries) {
      if (freedSize >= requiredSize) break;

      await this.delete(key);
      freedSize += entry.metadata.size;
      evictedCount++;
    }

    this.stats.evictionCount += evictedCount;

    logger.info('Cache capacity ensured', {
      context: { requiredSize, freedSize, evictedCount },
    });
  }

  // Calculate total cache size
  private calculateTotalSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.metadata.size;
    }
    return totalSize;
  }

  // Update cache statistics
  private updateStats(): void {
    if (!this.config.enableMetrics) return;

    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = this.calculateTotalSize();
    this.stats.memoryUsage = process.memoryUsage?.()?.heapUsed || 0;
  }

  // Record cache hit
  private recordHit(): void {
    if (!this.config.enableMetrics) return;

    const totalRequests = this.stats.hitRate + this.stats.missRate + 1;
    this.stats.hitRate = (this.stats.hitRate * (totalRequests - 1) + 1) / totalRequests;
    this.stats.missRate = 1 - this.stats.hitRate;
  }

  // Record cache miss
  private recordMiss(): void {
    if (!this.config.enableMetrics) return;

    const totalRequests = this.stats.hitRate + this.stats.missRate + 1;
    this.stats.missRate = (this.stats.missRate * (totalRequests - 1) + 1) / totalRequests;
    this.stats.hitRate = 1 - this.stats.missRate;
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // Start warming timer
  private startWarmingTimer(): void {
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }

    this.warmingTimer = setInterval(() => {
      this.warmCache();
    }, this.warmingConfig.interval);
  }

  // Stop warming timer
  private stopWarmingTimer(): void {
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
      this.warmingTimer = undefined;
    }
  }

  // Cleanup expired entries
  private async cleanup(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.metadata.created + entry.metadata.ttl) {
        await this.delete(key);
        cleanedCount++;
      }
    }

    this.stats.lastCleanup = now;

    if (cleanedCount > 0) {
      logger.debug('Cache cleanup completed', {
        context: { cleanedCount },
      });
    }
  }

  // Execute warming strategy
  private async executeWarmingStrategy(strategy: string): Promise<void> {
    // This would be implemented based on specific warming strategies
    // For example: 'popular_exercises', 'user_workouts', 'recent_plans', etc.
    logger.debug('Executing warming strategy', { context: { strategy } });
  }

  // Persist entry to storage
  private async persistEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const serialized = JSON.stringify(entry);
      await AsyncStorage.setItem(`cache:${key}`, serialized);
    } catch (error) {
      logger.warn('Failed to persist cache entry', {
        context: { key, error: (error as Error).message },
      });
    }
  }

  // Remove persistent entry
  private async removePersistentEntry(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`cache:${key}`);
    } catch (error) {
      logger.warn('Failed to remove persistent cache entry', {
        context: { key, error: (error as Error).message },
      });
    }
  }

  // Load persisted cache
  private async loadPersistedCache(): Promise<void> {
    if (!this.config.enablePersistence) return;

    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cache:'));

      for (const storageKey of cacheKeys) {
        const cacheKey = storageKey.replace('cache:', '');
        const serialized = await AsyncStorage.getItem(storageKey);

        if (serialized) {
          const entry = JSON.parse(serialized) as CacheEntry;

          // Check if entry is still valid
          const now = Date.now();
          if (now <= entry.metadata.created + entry.metadata.ttl) {
            this.cache.set(cacheKey, entry);
          } else {
            // Remove expired entry from storage
            await AsyncStorage.removeItem(storageKey);
          }
        }
      }

      this.updateStats();

      logger.info('Persisted cache loaded', {
        context: { loadedEntries: this.cache.size },
      });
    } catch (error) {
      logger.error('Failed to load persisted cache', error as Error);
    }
  }

  // Clear persistent cache
  private async clearPersistentCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cache:'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      logger.warn('Failed to clear persistent cache', {
        context: { error: (error as Error).message },
      });
    }
  }

  // Cleanup on destroy
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }
    this.cache.clear();
  }

  async getItem<T>(key: string): Promise<CacheEntry<T> | null> {
    logger.debug(`Getting item for key: ${key}`);
    try {
      const serialized = await AsyncStorage.getItem(`cache:${key}`);
      if (!serialized) {
        logger.debug(`No item found for key: ${key}`);
        return null;
      }

      const validationResult = await validationService.validateCacheEntry(JSON.parse(serialized));

      if (!validationResult.success) {
        logger.warn(`Invalid cache entry for key ${key}, removing.`, {
          context: { errors: validationResult.errors },
        });
        await AsyncStorage.removeItem(`cache:${key}`);
        return null;
      }

      // Convert validated data to internal cache entry format
      const validatedEntry = validationResult.data;
      const entry: CacheEntry<T> = {
        data: validatedEntry.data as T,
        metadata: {
          key,
          size: 0, // Will be calculated if needed
          accessCount: 0,
          lastAccessed: Date.now(),
          created: validatedEntry.timestamp,
          ttl: validatedEntry.ttl || this.config.defaultTtl,
          tags: [],
          priority: CachePriority.NORMAL,
          compressed: false,
        },
      };

      if (this.isExpired(entry)) {
        logger.info(`Cache item expired for key: ${key}, removing.`);
        await AsyncStorage.removeItem(`cache:${key}`);
        this.stats.missRate++;
        return null;
      }

      logger.info(`Cache hit for key: ${key}`);
      this.stats.hitRate++;
      return entry;
    } catch (error) {
      logger.error(`Error getting item for key ${key}:`, error as Error);
      this.recordMiss();
      return null;
    }
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    const now = Date.now();
    return now > entry.metadata.created + entry.metadata.ttl;
  }
}

// Default cache manager instance
export const enhancedCacheManager = new EnhancedCacheManager();

// Cache decorators for API responses
export function cacheApiResponse<T>(
  key: string,
  options: {
    ttl?: number;
    tags?: string[];
    priority?: CachePriority;
  } = {},
) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Try to get from cache first
      const cached = await enhancedCacheManager.getItem<ApiResponse<T>>(key);
      if (cached) {
        return cached;
      }

      // Execute original method
      const result = await method.apply(this, args);

      // Cache the result
      await enhancedCacheManager.set(key, result, options);

      return result;
    };

    return descriptor;
  };
}

// Types and enums are already exported above with their declarations
