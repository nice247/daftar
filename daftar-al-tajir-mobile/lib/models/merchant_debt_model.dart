class MerchantDebtModel {
  final dynamic id;
  final String supplierName;
  final String? supplierPhone;
  final double totalAmount;
  final double paidAmount;
  final double remainingAmount;
  final String? dueDate;
  final String status; // 'pending', 'partial', 'paid'
  final bool isSynced;

  MerchantDebtModel({
    required this.id,
    required this.supplierName,
    this.supplierPhone,
    required this.totalAmount,
    required this.paidAmount,
    required this.remainingAmount,
    this.dueDate,
    required this.status,
    this.isSynced = true,
  });

  factory MerchantDebtModel.fromJson(Map<String, dynamic> json) {
    return MerchantDebtModel(
      id: json['id'] ?? 0,
      supplierName: json['supplier_name'] ?? json['supplierName'] ?? '',
      supplierPhone: json['supplier_phone'] ?? json['supplierPhone'],
      totalAmount: (json['total_amount'] is num)
          ? (json['total_amount'] as num).toDouble()
          : double.tryParse(json['total_amount']?.toString() ?? '0') ?? 0.0,
      paidAmount: (json['paid_amount'] is num)
          ? (json['paid_amount'] as num).toDouble()
          : double.tryParse(json['paid_amount']?.toString() ?? '0') ?? 0.0,
      remainingAmount: (json['remaining_amount'] is num)
          ? (json['remaining_amount'] as num).toDouble()
          : double.tryParse(json['remaining_amount']?.toString() ?? '0') ?? 0.0,
      dueDate: json['due_date'] ?? json['dueDate'],
      status: json['status'] ?? 'pending',
      isSynced: json['is_synced'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'supplier_name': supplierName,
      'supplier_phone': supplierPhone,
      'total_amount': totalAmount,
      'paid_amount': paidAmount,
      'remaining_amount': remainingAmount,
      'due_date': dueDate,
      'status': status,
      'is_synced': isSynced ? 1 : 0,
    };
  }
}
