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
      amount: (json['amount'] is num) ? (json['amount'] as num).toDouble() : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      category: json['category'] ?? 'عام',
      note: json['note'],
      date: json['date'] ?? json['created_at'] ?? '',
      isSynced: json['is_synced'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'amount': amount,
      'category': category,
      'note': note,
      'date': date,
      'is_synced': isSynced ? 1 : 0,
    };
  }
}
