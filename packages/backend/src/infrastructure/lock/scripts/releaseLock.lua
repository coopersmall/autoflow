-- Release a lock only if held by the specified holder
-- KEYS[1] = lock key
-- ARGV[1] = holder ID
-- Returns: 1 if released, 0 if not held by this holder

if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
