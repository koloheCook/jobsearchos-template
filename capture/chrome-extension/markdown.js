export function escapeHtmlLikeMarkdown(value) {
  return String(value)
    .replace(/<[^>\r\n]+>/g, (match) => match.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .replace(/<(?=[A-Za-z/!?])/g, "&lt;");
}
