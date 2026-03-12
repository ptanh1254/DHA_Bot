function createKickIntentStore(options = {}) {
    const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : 2 * 60 * 1000;
    const store = new Map();

    function getKey(threadId, userId) {
        return `${String(threadId || "").trim()}:${String(userId || "").trim()}`;
    }

    function isExpired(entry) {
        return !entry || !Number.isFinite(entry.expiresAt) || Date.now() > entry.expiresAt;
    }

    function pruneExpired() {
        for (const [key, value] of store.entries()) {
            if (isExpired(value)) {
                store.delete(key);
            }
        }
    }

    function rememberKickRequest(threadId, userIds, actor) {
        pruneExpired();

        const actorUserId = String(actor?.actorUserId || "").trim();
        const actorName = String(actor?.actorName || "").trim();
        if (!actorUserId && !actorName) return;

        const expiresAt = Date.now() + ttlMs;
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        for (const rawId of ids) {
            const userId = String(rawId || "").trim();
            if (!userId) continue;

            store.set(getKey(threadId, userId), {
                actorUserId,
                actorName,
                expiresAt,
            });
        }
    }

    function clearKickRequest(threadId, userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        for (const rawId of ids) {
            const userId = String(rawId || "").trim();
            if (!userId) continue;
            store.delete(getKey(threadId, userId));
        }
    }

    function consumeKickActor(threadId, userId) {
        pruneExpired();

        const key = getKey(threadId, userId);
        const entry = store.get(key);
        if (!entry) return null;

        store.delete(key);
        return {
            actorUserId: entry.actorUserId || "",
            actorName: entry.actorName || "",
        };
    }

    return {
        rememberKickRequest,
        clearKickRequest,
        consumeKickActor,
    };
}

module.exports = {
    createKickIntentStore,
};
