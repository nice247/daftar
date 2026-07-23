class EodRecordModel {
  final int? id;
  final double totalSales;
  final double cashAmount;
  final double bankAmount;
  final double expensesAmount;
  final double netCash;
  final String date;
  final bool isSynced;

  EodRecordModel({
    this.id,
    required this.totalSales,
    required this.cashAmount,
    required this.bankAmount,
    required this.expensesAmount,
    required this.netCash,
    required this.date,
    this.isSynced = true,
  });

  factory EodRecordModel.fromJson(Map<String, dynamic> json) {
    return EodRecordModel(
      id: json['id'] != null ? (json['id'] is int ? json['id'] : int.parse(json['id'].toString())) : null,
      totalSales: (json['total_sales'] is num)
          ? (json['total_sales'] as num).toDouble()
          : double.tryParse(json['total_sales']?.toString() ?? '0') ?? 0.0,
      cashAmount: (json['cash_amount'] is num)
          ? (json['cash_amount'] as num).toDouble()
          : double.tryParse(json['cash_amount']?.toString() ?? '0') ?? 0.0,
      bankAmount: (json['bank_amount'] is num)
          ? (json['bank_amount'] as num).toDouble()
          : double.tryParse(json['bank_amount']?.toString() ?? '0') ?? 0.0,
      expensesAmount: (json['expenses_amount'] is num)
          ? (json['expenses_amount'] as num).toDouble()
          : double.tryParse(json['expenses_amount']?.toString() ?? '0') ?? 0.0,
      netCash: (json['net_cash'] is num)
          ? (json['net_cash'] as num).toDouble()
          : double.tryParse(json['net_cash']?.toString() ?? '0') ?? 0.0,
      date: json['date'] ?? '',
      isSynced: json['is_synced'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'total_sales': totalSales,
      'cash_amount': cashAmount,
      'bank_amount': bankAmount,
      'expenses_amount': expensesAmount,
      'net_cash': netCash,
      'date': date,
      'is_synced': isSynced ? 1 : 0,
    };
  }
}
