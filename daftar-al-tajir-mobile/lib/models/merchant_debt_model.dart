class MerchantDebtModel {
  final dynamic id;
  final String supplierName;
  final String? supplierPhone;
  final String debtType; // 'cash', 'bank', 'goods'
  final double totalAmount;
  final double paidAmount;
  final double remainingAmount;
  final String? dueDate;
  final String? description;
  final String status; // 'unpaid', 'partial', 'paid'
  final bool isSynced;

  MerchantDebtModel({
    required this.id,
    required this.supplierName,
    this.supplierPhone,
    this.debtType = 'goods',
    required this.totalAmount,
    required this.paidAmount,
    required this.remainingAmount,
    this.dueDate,
    this.description,
    required this.status,
    this.isSynced = true,
  });

  factory MerchantDebtModel.fromJson(Map<String, dynamic> json) {
    final total = (json['total_amount'] is num)
        ? (json['total_amount'] as num).toDouble()
        : double.tryParse(json['total_amount']?.toString() ?? '0') ?? 0.0;
    final paid = (json['paid_amount'] is num)
        ? (json['paid_amount'] as num).toDouble()
        : double.tryParse(json['paid_amount']?.toString() ?? '0') ?? 0.0;
    final remaining = (json['remaining'] is num)
        ? (json['remaining'] as num).toDouble()
        : (json['remaining_amount'] is num)
            ? (json['remaining_amount'] as num).toDouble()
            : (total - paid);

    return MerchantDebtModel(
      id: json['id']?.toString() ?? '0',
      supplierName: json['supplier_name'] ?? json['supplierName'] ?? '',
      supplierPhone: json['supplier_phone'] ?? json['supplierPhone'],
      debtType: json['debt_type'] ?? 'goods',
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: remaining,
      dueDate: json['due_date'] ?? json['dueDate'],
      description: json['description'] ?? json['notes'],
      status: json['status'] ?? (paid >= total ? 'paid' : (paid > 0 ? 'partial' : 'unpaid')),
      isSynced: (json['is_synced'] == 1 || json['is_synced'] == true),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'supplier_name': supplierName,
      'supplier_phone': supplierPhone,
      'debt_type': debtType,
      'total_amount': totalAmount,
      'paid_amount': paidAmount,
      'remaining': remainingAmount,
      'remaining_amount': remainingAmount,
      'due_date': dueDate,
      'description': description,
      'status': status,
      'is_synced': isSynced ? 1 : 0,
    };
  }

  String get debtTypeArabicName {
    switch (debtType.toLowerCase()) {
      case 'cash':
        return 'نقدي (كاش)';
      case 'bank':
        return 'بنكي (بنكك)';
      case 'goods':
      default:
        return 'بضاعة (آجل)';
    }
  }

  String get statusArabicName {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'مسدد بالكامل';
      case 'partial':
        return 'سداد جزئي';
      case 'unpaid':
      case 'pending':
      default:
        return 'غير مسدد';
    }
  }
}
