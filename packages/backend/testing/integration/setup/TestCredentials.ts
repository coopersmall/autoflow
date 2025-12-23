import { generateKeyPairSync } from "node:crypto";

import type { GCPServiceAccountCredentials } from "@backend/infrastructure/gcp/auth/domain/GCPServiceAccountCredentials";

// ============================================================================
// Types
// ============================================================================

interface RSAKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}

// ============================================================================
// Key Generation (Cached)
// ============================================================================

/**
 * Cached RSA key pair for test service account credentials.
 * Generated once per test run to avoid expensive key generation on each test.
 */
let cachedKeyPair: RSAKeyPair | undefined;

function getOrGenerateKeyPair(): RSAKeyPair {
  if (!cachedKeyPair) {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });
    cachedKeyPair = { publicKey, privateKey };
  }
  return cachedKeyPair;
}

// ============================================================================
// Test Credentials Factory
// ============================================================================

/**
 * Creates fake GCP service account credentials for integration testing.
 *
 * The credentials include a valid RSA private key that can be used to sign URLs.
 * The GCS emulator does not validate signatures, so the actual key content
 * doesn't matter - it just needs to be a valid RSA key format.
 *
 * @param projectId - The GCP project ID to use in the credentials
 * @returns Valid GCPServiceAccountCredentials object
 *
 * @example
 * ```typescript
 * const credentials = createTestServiceAccountCredentials('test-project');
 * const mechanism = {
 *   type: 'service_account',
 *   credentials,
 *   apiEndpoint: 'http://localhost:4443',
 * };
 * ```
 */
export function createTestServiceAccountCredentials(
  projectId: string,
): GCPServiceAccountCredentials {
  const { privateKey } = getOrGenerateKeyPair();

  return {
    type: "service_account",
    project_id: projectId,
    private_key_id: "test-key-id",
    private_key: privateKey,
    client_email: `test@${projectId}.iam.gserviceaccount.com`,
    client_id: "123456789012345678901",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/test%40${projectId}.iam.gserviceaccount.com`,
  };
}
