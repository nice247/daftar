class ExpenseModel {
  final dynamic id;
  final double amount;
  final String category;
  final String? note;
  final String date;
  final bool isSynced;

  ExpenseModel({
    required this.id,
    required this.amount,
    required this.category,
    this.note,
    required this.date,
    this.isSynced = true,
  });

  factory ExpenseModel.fromJson(Map<String, dynamic> json) {
    return ExpenseModel(
      id: json['id'] ?? 0,
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      category: json['category'] ?? 'OTHER',
      note: json['description'] ?? json['note'],
      date: json['created_at']?.toString() ?? json['date']?.toString() ?? '',
      isSynced: (json['is_synced'] == 1 || json['is_synced'] == true),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'amount': amount,
      'category': category,
      'description': note,
      'note': note,
      'date': date,
      'created_at': date,
      'is_synced': isSynced ? 1 : 0,
    };
  }

  String get categoryArabicName {
    switch (category.toUpperCase()) {
      case 'RESTOCK':
        return 'بضاعة (تجديد مخزون)';
      case 'BILL':
        return 'فواتير (إيجار، كهرباء، ماء)';
      case 'MERCHANT_DEBT_PAY':
        return 'سداد دين مورد';
      case 'DEBT_WAIVER':
        return 'إعفاء من دين';
      case 'OTHER':
      default:
        return 'مصروفات عامة / أخرى';
    }
  }
}
