class DebtModel {
  final String id;
  final String customerId;
  final double amount;
  final double paidAmount;
  final double remainingAmount;
  final String? note;
  final String createdAt;

  DebtModel({
    required this.id,
    required this.customerId,
    required this.amount,
    this.paidAmount = 0.0,
    this.remainingAmount = 0.0,
    this.note,
    required this.createdAt,
  });

  factory DebtModel.fromJson(Map<String, dynamic> json) {
    final total = (json['total_amount'] is num)
        ? (json['total_amount'] as num).toDouble()
        : (json['amount'] is num)
            ? (json['amount'] as num).toDouble()
            : double.tryParse((json['total_amount'] ?? json['amount'])?.toString() ?? '0') ?? 0.0;
    final paid = (json['paid_amount'] is num)
        ? (json['paid_amount'] as num).toDouble()
        : double.tryParse(json['paid_amount']?.toString() ?? '0') ?? 0.0;
    final remaining = (json['remaining'] is num)
        ? (json['remaining'] as num).toDouble()
        : (total - paid);

    return DebtModel(
      id: json['id']?.toString() ?? '0',
      customerId: json['customer_id']?.toString() ?? '',
      amount: total,
      paidAmount: paid,
      remainingAmount: remaining > 0 ? remaining : total,
      note: json['description'] ?? json['note'],
      createdAt: json['created_at']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'customer_id': customerId,
      'amount': amount,
      'total_amount': amount,
      'paid_amount': paidAmount,
      'remaining': remainingAmount,
      'description': note,
      'note': note,
      'created_at': createdAt,
    };
  }
}

class CustomerModel {
  final String id;
  final String name;
  final String phone;
  final double totalDebt;
  final List<DebtModel> debts;
  final bool isSynced;

  CustomerModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.totalDebt,
    this.debts = const [],
    this.isSynced = true,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    var debtsList = <DebtModel>[];
    final invoices = json['outstanding_invoices'] ?? json['debts'];
    if (invoices != null && invoices is List) {
      debtsList = invoices.map((d) => DebtModel.fromJson(d)).toList();
    }

    return CustomerModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      totalDebt: (json['total_debt'] is num)
          ? (json['total_debt'] as num).toDouble()
          : (json['totalDebt'] is num)
              ? (json['totalDebt'] as num).toDouble()
              : double.tryParse(json['total_debt']?.toString() ?? '0') ?? 0.0,
      debts: debtsList,
      isSynced: (json['is_synced'] == 1 || json['is_synced'] == true || json['is_synced'] == null),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'total_debt': totalDebt,
      'debts': debts.map((d) => d.toJson()).toList(),
      'is_synced': isSynced ? 1 : 0,
    };
  }

  CustomerModel copyWith({
    String? id,
    String? name,
    String? phone,
    double? totalDebt,
    List<DebtModel>? debts,
    bool? isSynced,
  }) {
    return CustomerModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      totalDebt: totalDebt ?? this.totalDebt,
      debts: debts ?? this.debts,
      isSynced: isSynced ?? this.isSynced,
    );
  }
}
