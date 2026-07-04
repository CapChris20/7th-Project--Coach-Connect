export function detectFormat(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const cm = /^([$€£¥])\s*(-?[\d,]+(?:\.\d+)?)$/.exec(s);
  if (cm) return { format: 'currency', normalized: cm[2].replace(/,/g, ''), currency: cm[1] };
  const pm = /^(-?[\d,]+(?:\.\d+)?)\s*%$/.exec(s);
  if (pm) return { format: 'percent', normalized: String(parseFloat(pm[1].replace(/,/g, '')) / 100) };
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s)) return { format: 'email', normalized: s };
  if (/^https?:\/\/\S+$/i.test(s)) return { format: 'url', normalized: s };
  if (/^\+?[\d][\d\s\-().]{6,}\d$/.test(s) && s.replace(/\D/g, '').length >= 7 && s.replace(/\D/g, '').length <= 15) {
    return { format: 'phone', normalized: s };
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return { format: 'date', normalized: d.toISOString().slice(0, 10) };
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { format: 'number', normalized: s.replace(/,/g, '') };
  return null;
}

export function formatValue(value, cell) {
  if (value == null || value === '') return '';
  const fmt = cell?.format;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  switch (fmt) {
    case 'currency': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      const sym = cell?.currency || '$';
      return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case 'percent': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      return (n * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
    }
    case 'number': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      return n.toLocaleString();
    }
    case 'date': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString();
    }
    case 'phone':
    case 'email':
    case 'url':
      return String(value);
    case 'checkbox':
      return String(value).toLowerCase() === 'true' || value === true ? '☑' : '☐';
    default:
      if (typeof value === 'number') {
        if (Number.isInteger(value) && Math.abs(value) < 1e6) return String(value);
        return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
      }
      return String(value);
  }
}

export function formatNumberNice(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1000 || Number.isInteger(n)) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
