import { mock } from 'bun:test';
import type { AppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates a complete mock for AppConfigurationService with all getters and methods
 * as spy-able mock functions. Each getter becomes a mock function that returns a
default value.
 */
export function getMockedAppConfigurationService(): ExtractMockMethods<AppConfigurationService> {
  return {
    polygonKey: 'polygon-key',
    openAIKey: 'openai-key',
    googleGenAIKey: 'mock-google-genai-key',
    groqKey: 'mock-groq-key',
    nodeEnv: 'development',
    jwtPublicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA698Pbq58th9itKlttpav
sQf1kyv8G9/uzWBQtgsPB40m9ChE8zOTpbtkcCj7mb/zkQInNufxBTtHtKZYV+IX
WuE2QManKL17EfNlfoOJb3wIMafaBOO0rvjea182GFgxmdLywWUQC/kkfqdaQaUR
CYk8xF8h0QkoptR4v40fuPFjFp9mUBC+2q+loDl+xORFmO0NLQ/X7aiUn6Baqyde
QrIOmWn5LvdGHmC0cVs7lgiq3pdbxBCb6zkk6Udgv61GpZrjEZh3kqXBPqCzQW+5
XDlR2TeS6/3bRqAgfLaOaVs/XOdD4ocKSIQ5Sn1pi+wPhrvfG/Zk2AV6S3px/Kpc
PwIDAQAB
-----END PUBLIC KEY-----`,
    jwtPrivateKey: `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDr3w9urny2H2K0
qW22lq+xB/WTK/wb3+7NYFC2Cw8HjSb0KETzM5Olu2RwKPuZv/ORAic25/EFO0e0
plhX4hda4TZAxqcovXsR82V+g4lvfAgxp9oE47Su+N5rXzYYWDGZ0vLBZRAL+SR+
p1pBpREJiTzEXyHRCSim1Hi/jR+48WMWn2ZQEL7ar6WgOX7E5EWY7Q0tD9ftqJSf
oFqrJ15Csg6Zafku90YeYLRxWzuWCKrel1vEEJvrOSTpR2C/rUalmuMRmHeSpcE+
oLNBb7lcOVHZN5Lr/dtGoCB8to5pWz9c50PihwpIhDlKfWmL7A+Gu98b9mTYBXpL
enH8qlw/AgMBAAECggEAcDjfscxo34nNP6GA5qeJDdR4nb4GpAiGKMbTf9mBHBmn
V/E05PU8IVUoM0j8dClkrDB3EeOGw/NxaVzfmWijrgSK+ITLkVGdlWvVdT0GDbnY
eC+hRkREeh9ES5ewOCL17nb0MtlvqhKur2fWRHdRxNS7yb5ta3RNGBrtHE37stSU
eR2Lm/SsaizO2fAiAVTCaaNvAhVb2/Oq+og+T6Jo48tpTJVX6GDFnRaoV9cG0CaZ
+XE6nnNYqFufgUaFY8VS0B8+ahfzWsvZhK3qQeAulEOCEuunzERHCBsKryxlQcaL
igOR4blu/pSNddana7ZmhYbIBLrIwpCZ16qaKzNloQKBgQD2ZTYeP9tWtj6ZxBj9
gefEsre5ZHS/8OMP4rrL/lg8sPG35+fo9rF4dDMtJ3bXbWBQ4YdTPxd9DfVBqE27
LnUhcqSseZMFHhNGIJa2WsGjHjX1FTlGziyRvQ+SPAPvlo9i7i9i0ZfnPN3ESKCY
PnrVikxYtu7UEESBcHR1YR0AcQKBgQD1ENRHNJGnG2ibKVoAPFaLzI2MSiictbNK
53KuuFzwu9vM/kBFhbJh5DzWOZV0JpO6BaP6sjpGdtVUzPt2xGMe23D7rNjtl8q+
Cr3dNjMg1n2skISgI7pratuyTTevxqOFqcwmnJosLuqb51WvWcJKmIQSCVlCsN6E
WgWvMA9/rwKBgQDDyXDTYJJ9uJrNvJDPACaWmhx7aGONEXCb8uHTruuWblPkepZA
+6XRvSPdQXqhe/wIyOyrLXsQl8LGxWHe1u+kAGDx3DkC2/8cvlCD3mH3p83gTVkR
9kpcFAsHfED0ZILTbcihkUJPMIJXsg5Ka3tXq2k3JUVppPOKlz0y+FP/QQKBgQC4
RIU5XT+/xQ4szTUNRFFXIOG2APT0kHNV+R30XlAT+01UoEC3hcYRcUqFUhsckP03
PJKGKIlE/ol+D/ts3FIjm6EivF8Il8AskWsd8GkVYfJxVOFEgFjl+B1lvkYG93dx
Q7Frvwj1+/kQbSuyg+1hpbh4z2q8iL1oC0CG775XpQKBgQC1skuICi4a/KDsEgxd
As0u10EeVSA0lnSRAF+k7cg+PaRFCk0pxVVeAUxoWuKBrr/aMLM5SfBWlkVz3HqG
8jMCQLfBmpqIF2KKerR+VmHumkn7mnewIhsBM5ZXp9mrD4bzsOEVGa2CcrEh4Pux
D/CSwUIUzDUWifG1nHgcS2H2Kg==
-----END PRIVATE KEY-----`,
    secretsPublicKey: 'mock-secrets-public-key',
    secretsPrivateKey: 'mock-secrets-private-key',
    databaseUrl: 'mock-database-url',
    redisUrl: 'mock-redis-url',
    apiKey: 'mock-api-key',
    environment: 'development',
    site: 'localhost:3000',
    siteUrl: 'http://localhost:3000',
    isLocal: mock(),
  };
}
