export function formatDate(dateInput) {
  if (!dateInput) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateInput));
}
