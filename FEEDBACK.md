# Storage Service Code Review Feedback

## Priority 1: Critical Issues

### 1.1 Queue Callbacks Not Wired (Bug/Incomplete)
**Location**: `services/StorageService.ts:52-56`, `queue/UploadQueue.ts:32-48`

The `UploadQueue` requires `UploadQueueCallbacks` (`onUploadSuccess`, `onUploadFailure`) to update cache state when async uploads complete. However, `StorageService` passes `config.uploadQueue` directly without providing these callbacks.

**Impact**: Async uploads will complete in storage but cache state will never transition from `uploading` to `ready` or `failed`. Callers polling `getFileStatus()` will see stale state.

**Fix**: Either:
1. Create the queue internally with callbacks wired to cache operations, or
2. Document that callers must wire callbacks when creating the queue

---

### 1.2 Upload Timeout Doesn't Abort Actual Upload (Resource Leak)
**Location**: `queue/UploadQueue.ts:227-245`

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.uploadTimeoutMs);
// controller.signal is never passed to storageProvider.put()
```

The AbortController is created but never passed to the storage provider. On timeout, you mark the upload as failed, but the actual GCS upload continues running and consuming resources.

**Impact**: Timed-out uploads continue consuming network/memory. In high-load scenarios, this could cause resource exhaustion.

**Fix**: Pass `AbortSignal` through `IStorageProvider.put()` and respect it in `GCSStorageAdapter`.

---

### 1.3 Race Condition in Confirm Flow
**Location**: `actions/confirmUpload.ts:48-72`

If `confirmUpload` is called while an async upload is in progress:
1. File doesn't exist in storage yet → cache marked as `failed`
2. Async upload completes successfully → callback overwrites with success

There's no coordination between the confirmation flow and async upload flow.

**Impact**: Unpredictable state transitions; clients may see incorrect failure states.

**Fix**: Add a lock or check upload state before marking as failed. Consider whether `confirmUpload` should only apply to client-side (signed URL) uploads.

---

## Priority 2: High Importance

### 2.1 Missing Tests
**Location**: `packages/backend/src/storage/` (no `__tests__` directory)

No unit or integration tests exist for the storage service.

**Required tests**:
- Unit tests for `buildObjectKey.ts`, `calculateChecksum.ts`
- Action tests for each action with mocked dependencies
- Integration tests for full upload/download flows

---

### 2.2 Queue Instantiation Unclear (API Design)
**Location**: `services/StorageService.ts`, `queue/UploadQueue.ts`

The `UploadQueue` is passed via config but requires dependencies (`storageProvider`, `buildObjectKey`, `callbacks`) that are internal to `StorageService`. This creates a circular dependency problem.

**Question**: How is the caller supposed to construct the queue with the right dependencies?

**Fix options**:
1. Create queue internally in `StorageService` constructor
2. Use a factory pattern that receives only config, not the queue instance
3. Export helpers to construct the queue with proper wiring

---

### 2.3 No Retry Logic for Storage Operations
**Location**: `adapters/GCSStorageAdapter.ts`

GCS operations have no retry logic for transient failures (network timeouts, 503s, rate limits).

**Impact**: Single transient failures cause permanent upload failures.

**Fix**: Add retry with exponential backoff, or use a retry wrapper around the GCS client.

---

## Priority 3: Medium Importance

### 3.1 Silent Validation Skip in listFiles
**Location**: `actions/listFiles.ts:41-44`

```typescript
if (fileIdResult.isErr()) {
  continue;  // Silently skips invalid files
}
```

Invalid file IDs are silently skipped without logging.

**Impact**: Data corruption or migration issues may go unnoticed.

**Fix**: Add warning log when skipping invalid entries.

---

### 3.2 Type Inconsistency: FileAsset.size vs UploadState.size
**Locations**: 
- `core/domain/file/FileAsset.ts:18-20` - size is optional
- `storage/cache/domain/UploadState.ts:31` - size is required

**Impact**: Potential runtime issues when converting between types.

**Fix**: Align the schemas or handle the optional case explicitly.

---

### 3.3 createdAt Type Mismatch
**Location**: Multiple actions (`getFileStatus.ts:79`, etc.)

`UploadState.createdAt` is `Date` but `FileAsset.createdAt` is `string` (ISO 8601). Conversion is done inline with `.toISOString()`.

**Impact**: Works but relies on implicit knowledge of type differences.

**Fix**: Consider using consistent types or creating explicit conversion helpers.

---

## Priority 4: Low Importance / Suggestions

### 4.1 Unused Context Parameters
**Locations**: 
- `getDownloadUrl.ts:19` - `_ctx`
- `listFiles.ts:17` - `_ctx`
- `upload.ts:42` - `_ctx` in `uploadSync`

Context is accepted but not used in several actions.

**Note**: This is fine if reserved for future use (logging, cancellation). The underscore prefix correctly indicates intentional non-use.

---

### 4.2 Consider Idempotency for confirmUpload
**Location**: `actions/confirmUpload.ts`

**Question**: What happens if `confirmUpload` is called multiple times for the same file?
- First call: succeeds, deletes cache
- Second call: file exists in storage, cache already deleted → succeeds again

This is actually fine (idempotent), but worth documenting the expected behavior.

---

## Questions to Resolve

1. **Queue instantiation**: Should the service create the queue internally, or is external creation intentional?

2. **Confirm flow scope**: Should `confirmUpload` only apply to client-side (signed URL) uploads, not async queue uploads?

3. **Future adapters**: Are S3/Azure adapters planned? The abstraction supports it.

---

## What's Done Well

- Clean `IStorageProvider` abstraction (provider-agnostic)
- Consistent use of `neverthrow` Result types
- Action pattern follows `(ctx, request, deps)` signature
- Smart size-based routing (sync for small, async for large)
- Cache for transient states, storage as source of truth
- Memory safety with explicit `job.data = null` in queue
