export function sanitizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  return digits || undefined;
}

export function buildWhatsAppUrl(params: { phone?: string; text: string }): string {
  const encodedText = encodeURIComponent(params.text);
  if (params.phone) {
    const phone = sanitizePhone(params.phone);
    if (phone) {
      return `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}&type=phone_number&app_absent=0`;
    }
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
