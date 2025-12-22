import type { Attachment } from '../shared/Attachment';
import type { StepContent } from '../steps/StepContent';

/**
 * Merges uploaded files into step content.
 *
 * Use this after file uploads complete, before finalizing step content.
 * This makes the file merge explicit since accumulateSteps() does not
 * handle files (they require separate upload processing).
 *
 * @param content - The step content to add files to
 * @param files - The uploaded file attachments
 * @returns A new StepContent with files merged in
 */
export function withFiles(
  content: StepContent,
  files: Attachment[],
): StepContent {
  return {
    ...content,
    files: files.length > 0 ? files : undefined,
  };
}
