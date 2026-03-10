export function mapResearchEntity(rawResearch) {
  return {
    id: rawResearch.id,
    studentId: rawResearch.student_id,
    title: rawResearch.title,
    abstract: rawResearch.abstract,
    authors: rawResearch.authors ?? [],
    keywords: rawResearch.keywords ?? [],
    strand: rawResearch.strand ?? '',
    category: rawResearch.category ?? '',
    year: rawResearch.year ?? null,
    status: rawResearch.status,
    filePath: rawResearch.file_path,
    fileUrl: rawResearch.file_url,
    submittedAt: rawResearch.submitted_at,
    reviewedAt: rawResearch.reviewed_at,
    updatedAt: rawResearch.updated_at,
    comments: (rawResearch.research_comments ?? []).map((entry) => ({
      id: entry.id,
      comment: entry.comment,
      suggestion: entry.suggestion,
      createdAt: entry.created_at
    }))
  };
}
