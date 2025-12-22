/**
 * Re-export Source types from the shared domain.
 * The conversation layer uses the base Source without provider metadata.
 */
export {
  type DocumentSource,
  documentSourceSchema,
  type Source,
  sourceSchema,
  type UrlSource,
  urlSourceSchema,
} from '@core/domain/source/Source';
