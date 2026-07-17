export function excerpt(bodyMd: string, maxLength = 110) {
  const plain = bodyMd.replace(/[#*_>`\[\]]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trim()}...` : plain;
}
