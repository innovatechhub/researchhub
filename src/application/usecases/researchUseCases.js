import { mapResearchEntity } from '../../domain/entities/research';
import {
  addResearchCommentRepository,
  getResearchFileDownloadUrlRepository,
  listAllResearchesRepository,
  listApprovedResearchesRepository,
  listStudentResearchesRepository,
  listTeacherResearchQueueRepository,
  updateResearchStatusRepository,
  submitResearchRepository
} from '../../infrastructure/repositories/researchRepository';

const REVIEW_STATUSES = ['needs_revision', 'approved', 'rejected'];

function parseCommaSeparatedText(value) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateResearchYear(yearValue) {
  const parsedYear = Number(yearValue);
  const maxYear = new Date().getFullYear() + 1;

  if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > maxYear) {
    throw new Error(`Research year must be between 1900 and ${maxYear}.`);
  }

  return parsedYear;
}

function ensureSupportedDocument(file) {
  if (!file) {
    throw new Error('Research file is required.');
  }

  const normalizedName = file.name?.toLowerCase() ?? '';
  const normalizedType = file.type?.toLowerCase() ?? '';
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const hasAllowedExtension = allowedExtensions.some((extension) => normalizedName.endsWith(extension));
  const hasAllowedMimeType = allowedMimeTypes.includes(normalizedType);

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    throw new Error('Only PDF or Word files (.doc, .docx) are allowed.');
  }
}

export async function submitResearchUseCase({
  studentId,
  title,
  abstract,
  authorsText,
  keywordsText,
  strand,
  category,
  year,
  file
}) {
  const normalizedTitle = title?.trim() ?? '';
  const normalizedAbstract = abstract?.trim() ?? '';
  const normalizedStrand = strand?.trim() ?? '';
  const normalizedCategory = category?.trim() ?? '';

  if (!normalizedTitle) {
    throw new Error('Research title is required.');
  }

  if (!normalizedAbstract) {
    throw new Error('Research abstract is required.');
  }

  const authors = parseCommaSeparatedText(authorsText);
  if (authors.length === 0) {
    throw new Error('At least one author is required.');
  }

  if (!normalizedStrand) {
    throw new Error('Strand is required.');
  }

  if (!normalizedCategory) {
    throw new Error('Category is required.');
  }

  const researchYear = validateResearchYear(year);
  const keywords = parseCommaSeparatedText(keywordsText);

  ensureSupportedDocument(file);

  const rawResearch = await submitResearchRepository({
    studentId,
    title: normalizedTitle,
    abstract: normalizedAbstract,
    authors,
    keywords,
    strand: normalizedStrand,
    category: normalizedCategory,
    year: researchYear,
    file
  });

  return mapResearchEntity(rawResearch);
}

export async function listStudentResearchesUseCase(studentId) {
  const rawResearchList = await listStudentResearchesRepository(studentId);
  return rawResearchList.map(mapResearchEntity);
}

export async function listTeacherResearchQueueUseCase() {
  const rawResearchList = await listTeacherResearchQueueRepository();
  return rawResearchList.map(mapResearchEntity);
}

export async function listAllResearchesUseCase() {
  const rawResearchList = await listAllResearchesRepository();
  return rawResearchList.map(mapResearchEntity);
}

export async function reviewResearchUseCase({ teacherId, researchId, comment, suggestion, status }) {
  const normalizedComment = comment?.trim() ?? '';
  const normalizedSuggestion = suggestion?.trim() ?? '';

  if (!researchId) {
    throw new Error('Research id is required.');
  }

  if (!teacherId) {
    throw new Error('Teacher id is required.');
  }

  if (status && !REVIEW_STATUSES.includes(status)) {
    throw new Error('Invalid review status.');
  }

  if (!status && !normalizedComment && !normalizedSuggestion) {
    throw new Error('Add a comment or suggestion before submitting.');
  }

  if ((status === 'rejected' || status === 'needs_revision') && !normalizedComment) {
    throw new Error('Comment is required for reject/request edits actions.');
  }

  if (normalizedComment || normalizedSuggestion) {
    await addResearchCommentRepository({
      researchId,
      authorId: teacherId,
      comment: normalizedComment || 'No additional comment provided.',
      suggestion: normalizedSuggestion || null
    });
  }

  if (status) {
    const rawResearch = await updateResearchStatusRepository({ researchId, status });
    return mapResearchEntity(rawResearch);
  }

  return null;
}

export async function listApprovedResearchesUseCase() {
  const rawResearchList = await listApprovedResearchesRepository();
  return rawResearchList.map(mapResearchEntity);
}

export async function getResearchFileDownloadUrlUseCase(filePath) {
  if (!filePath) {
    throw new Error('File path is required.');
  }

  return getResearchFileDownloadUrlRepository(filePath);
}

export async function getApprovedResearchFileDownloadUrlUseCase({ status, filePath }) {
  if (status !== 'approved') {
    throw new Error('Only approved research files can be downloaded.');
  }

  return getResearchFileDownloadUrlUseCase(filePath);
}
