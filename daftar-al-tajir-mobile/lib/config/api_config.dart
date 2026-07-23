class ApiConfig {
  static const String baseUrl = 'https://daftar-str8.onrender.com/api/v1';

  // Auth
  static const String verifyPhone = '/auth/verify-phone';
  static const String confirmPhone = '/auth/confirm-phone';
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String forgotPassword = '/auth/forgot-password';
  static const String verifyOtp = '/auth/verify-otp';
  static const String resetPassword = '/auth/reset-password';

  // User
  static const String userProfile = '/users/me';

  // EOD
  static const String eodSave = '/eod/save';
  static const String eodLastRestock = '/eod/last-restock';
  static const String eodCycleStatus = '/eod/cycle-status';
  static const String eodToday = '/eod/today';
  static const String eodYesterday = '/eod/yesterday';

  // Customers & Debts
  static const String customers = '/customers/';
  static const String customerDebt = '/customers/debt';
  static const String customerDebtPay = '/customers/debt/pay';
  static const String customerDebtWaive = '/customers/debt/waive';

  // Expenses
  static const String expenses = '/expenses/';

  // Merchant Debts
  static const String merchantDebts = '/merchant-debts/';
  static const String merchantDebtPay = '/merchant-debts/pay';
  static const String merchantDebtSummary = '/merchant-debts/summary';

  // Reports
  static const String reports = '/reports/';

  // Subscriptions & OCR
  static const String subscriptionUploadReceipt = '/subscriptions/upload-receipt';
  static const String subscriptionMy = '/subscriptions/my';
  static const String subscriptionPending = '/subscriptions/pending';
  static const String subscriptionReview = '/subscriptions/review';
  static const String subscriptionPrices = '/subscriptions/prices';
  static const String ocrExtract = '/ocr/extract';

  // Admin
  static const String adminUsers = '/admin/users';
  static const String adminExtendSub = '/admin/extend-subscription';
  static const String adminToggleUser = '/admin/toggle-user';
  static const String adminAddUser = '/admin/add-user';
  static const String adminStats = '/admin/stats';
  static const String adminSettings = '/admin/settings';
}
