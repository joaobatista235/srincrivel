class ResponseOptimizer {
    constructor() {
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.responseCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
    }

    // Debounce para evitar spam de comandos
    debounce(key, fn, delay = 1000) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        const timer = setTimeout(() => {
            fn();
            this.debounceTimers.delete(key);
        }, delay);

        this.debounceTimers.set(key, timer);
    }

    // Throttle para limitar frequência de execução
    throttle(key, fn, delay = 2000) {
        if (this.throttleTimers.has(key)) {
            return;
        }

        fn();
        this.throttleTimers.set(key, true);

        setTimeout(() => {
            this.throttleTimers.delete(key);
        }, delay);
    }

    // Cache de respostas para comandos frequentes
    async getCachedResponse(key, generatorFn, ttl = this.cacheTimeout) {
        const cached = this.responseCache.get(key);

        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }

        const data = await generatorFn();
        this.responseCache.set(key, {
            data,
            timestamp: Date.now()
        });

        return data;
    }

    // Limpar cache antigo
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.responseCache) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.responseCache.delete(key);
            }
        }
    }

    // Otimizar resposta de interação
    async optimizeInteraction(interaction, responseFn, options = {}) {
        const userId = interaction.user.id;
        const commandName = interaction.commandName || interaction.customId;
        const key = `${userId}-${commandName}`;

        const {
            debounceDelay = 1000,
            throttleDelay = 2000,
            useCache = false,
            cacheKey = null,
            cacheTTL = this.cacheTimeout
        } = options;

        // Verificar se deve usar cache
        if (useCache && cacheKey) {
            return await this.getCachedResponse(cacheKey, responseFn, cacheTTL);
        }

        // Verificar se deve debounce
        if (debounceDelay > 0) {
            return new Promise((resolve, reject) => {
                this.debounce(key, async () => {
                    try {
                        const result = await responseFn();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                }, debounceDelay);
            });
        }

        // Verificar se deve throttle
        if (throttleDelay > 0) {
            return new Promise((resolve, reject) => {
                this.throttle(key, async () => {
                    try {
                        const result = await responseFn();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                }, throttleDelay);
            });
        }

        // Execução normal
        return await responseFn();
    }

    // Métricas de performance
    getMetrics() {
        return {
            debounceTimers: this.debounceTimers.size,
            throttleTimers: this.throttleTimers.size,
            cacheSize: this.responseCache.size,
            cacheKeys: Array.from(this.responseCache.keys())
        };
    }

    // Limpar todos os timers
    clearAll() {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.throttleTimers.clear();
        this.responseCache.clear();
    }
}

export default ResponseOptimizer; 