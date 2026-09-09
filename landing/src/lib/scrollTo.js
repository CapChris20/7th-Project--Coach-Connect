export function scrollToProgress(p) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: max * Math.min(1, Math.max(0, p)), behavior: 'smooth' });
}
