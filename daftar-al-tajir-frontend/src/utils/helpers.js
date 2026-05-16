export function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0';
  return new Intl.NumberFormat('ar-SD').format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ar-SD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPhone(phone) {
  if (!phone) return '';
  // Format local: 0902 642 768
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  // Format international: 249 902 642 768
  if (cleaned.startsWith('249') && cleaned.length === 12) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  return phone;
}

/**
 * Convert user input to local Sudan phone format: 0XXXXXXXXX
 * User enters: 0902642768 or 249902642768 or 902642768
 * Returns: 0902642768 (10 digits starting with 0)
 */
export function normalizePhone(value) {
  const cleaned = value.replace(/\s/g, '').replace(/-/g, '').replace('+', '');
  // Already local format: 0XXXXXXXXX
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return cleaned;
  }
  // International format: 249XXXXXXXXX → 0XXXXXXXXX
  if (cleaned.startsWith('249') && cleaned.length >= 12) {
    return '0' + cleaned.slice(3);
  }
  // Missing leading 0: 902642768 → 0902642768
  if (cleaned.length === 9 && /^\d+$/.test(cleaned)) {
    return '0' + cleaned;
  }
  // Return as-is for partial input
  return cleaned;
}

export const PLAN_NAMES = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semi_annual: 'نصف سنوي',
};

export const PLAN_PRICES = {
  monthly: '10,000',
  quarterly: '30,000',
  semi_annual: '60,000',
};

export const EXPENSE_CATEGORIES = {
  RESTOCK: 'تجديد مخزون',
  BILL: 'فاتورة',
  OTHER: 'أخرى',
  DEBT_WAIVER: 'إعفاء دين',
};

export const INVOICE_TYPES = {
  EOD_CASH: 'مبيعات نقدية',
  EOD_BANKAK: 'مبيعات بنكك',
  DEBT: 'دين كاش',
  CASH: 'دين بنكك',
};

export function getDaysRemaining(endDate) {
  if (!endDate) return 0;
  const today = new Date();
  const end = new Date(endDate);
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
