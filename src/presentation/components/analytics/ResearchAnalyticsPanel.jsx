import { useMemo } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toTitleLabel(value, fallback = 'Uploads') {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getSubmittedDate(record) {
  return (
    toValidDate(record?.submittedAt) ||
    toValidDate(record?.submitted_at) ||
    toValidDate(record?.createdAt) ||
    toValidDate(record?.created_at) ||
    toValidDate(record?.updatedAt) ||
    toValidDate(record?.updated_at)
  );
}

function getPublishedDate(record) {
  return (
    toValidDate(record?.reviewedAt) ||
    toValidDate(record?.reviewed_at) ||
    getSubmittedDate(record)
  );
}

export function ResearchAnalyticsPanel({
  records = [],
  title = 'Research Analytics',
  subtitle = 'Year and strand distribution overview',
  focusLabel = 'uploads'
}) {
  const primaryLabel = toTitleLabel(focusLabel, 'Uploads');

  const analytics = useMemo(() => {
    const monthlyUploads = Array(12).fill(0);
    const monthlyPublished = Array(12).fill(0);

    records.forEach((record) => {
      const submittedDate = getSubmittedDate(record);
      const submittedMonth = submittedDate?.getMonth();
      if (Number.isInteger(submittedMonth) && submittedMonth >= 0 && submittedMonth <= 11) {
        monthlyUploads[submittedMonth] += 1;
      }

      const normalizedStatus = String(record?.status ?? '').trim().toLowerCase();
      if (normalizedStatus === 'approved') {
        const publishedDate = getPublishedDate(record);
        const publishedMonth = publishedDate?.getMonth();
        if (Number.isInteger(publishedMonth) && publishedMonth >= 0 && publishedMonth <= 11) {
          monthlyPublished[publishedMonth] += 1;
        }
      }
    });

    return {
      monthlySeries: MONTH_LABELS.map((label, index) => ({
        label,
        uploads: monthlyUploads[index],
        published: monthlyPublished[index]
      })),
      uploadData: monthlyUploads,
      publishedData: monthlyPublished,
      total: records.length
    };
  }, [records]);

  const hasData = analytics.total > 0;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Analytics</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Total: {analytics.total}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Monthly Trend (Jan-Dec)
        </p>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
          {hasData ? (
            <LineChart
              height={320}
              margin={{ top: 20, right: 20, bottom: 30, left: 45 }}
              xAxis={[
                {
                  id: 'months',
                  scaleType: 'point',
                  data: MONTH_LABELS
                }
              ]}
              yAxis={[
                {
                  id: 'records',
                  label: 'Records',
                  min: 0
                }
              ]}
              grid={{ horizontal: true, vertical: false }}
              series={[
                {
                  id: 'uploads',
                  label: primaryLabel,
                  data: analytics.uploadData,
                  area: true,
                  showMark: true,
                  color: '#38bdf8'
                },
                {
                  id: 'published',
                  label: 'Published',
                  data: analytics.publishedData,
                  area: true,
                  showMark: true,
                  color: '#14b8a6'
                }
              ]}
              slotProps={{
                legend: {
                  position: {
                    vertical: 'top',
                    horizontal: 'middle'
                  },
                  direction: 'row'
                }
              }}
              sx={{
                '& .MuiChartsAxis-line': { stroke: '#cbd5e1' },
                '& .MuiChartsAxis-tick': { stroke: '#cbd5e1' },
                '& .MuiChartsGrid-line': { stroke: '#e2e8f0' }
              }}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500">
              No analytics data available yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
