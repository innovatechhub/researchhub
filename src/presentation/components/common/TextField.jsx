export function TextField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4
}) {
  return (
    <label className="block space-y-2" htmlFor={id}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {type === 'textarea' ? (
        <textarea
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          rows={rows}
        />
      ) : (
        <input
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}
