-- Extend a lock's TTL only if held by the specified holder
-- KEYS[1] = lock key
-- ARGV[1] = holder ID
-- ARGV[2] = new TTL in seconds
-- Returns: 1 if extended, 0 if not held by this holder

if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("EXPIRE", KEYS[1], ARGV[2])
else
  return 0
end
