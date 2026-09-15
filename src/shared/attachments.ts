/** Shared intake limits; services validate again before accepting a file. */
export const messageAttachmentAccept =
  ".xlsx,.xls,.csv,.doc,.docx,.pdf,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp";
export function messageAttachmentError(file: File): string | undefined {
  if (!file.size || file.size > 20 * 1024 * 1024)
    return "附件须大于 0 且不超过 20 MB";
  if (!/\.(xlsx?|csv|docx?|pdf|pptx?|txt|md|png|jpe?g|webp)$/i.test(file.name))
    return "请选择表格、文档或图片附件";
}
