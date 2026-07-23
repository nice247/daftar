class DebtModel {
  final dynamic id;
  final dynamic customerId;
  final double amount;
  final String? note;
  final String createdAt;

  DebtModel({
    required this.id,
    required this.customerId,
    required this.amount,
    this.note,
    required this.createdAt,
  });

  factory DebtModel.fromJson(Map<String, dynamic> json) {
    return DebtModel(
      id: json['id'] ?? 0,
      customerId: json['customer_id'] ?? 0,
      amount: (json['amount'] is num) ? (json['amount'] as num).toDouble() : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      note: json['note'],
      createdAt: json['created_at'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'customer_id': customerId,
      'amount': amount,
      'note': note,
      'created_at': createdAt,
    };
  }
}

class CustomerModel {
  final dynamic id;
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
    if (json['debts'] != null && json['debts'] is List) {
      debtsList = (json['debts'] as List).map((d) => DebtModel.fromJson(d)).toList();
    }

    return CustomerModel(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      totalDebt: (json['total_debt'] is num)
          ? (json['total_debt'] as num).toDouble()
          : (json['totalDebt'] is num)
              ? (json['totalDebt'] as num).toDouble()
              : double.tryParse(json['total_debt']?.toString() ?? '0') ?? 0.0,
      debts: debtsList,
      isSynced: json['is_synced'] ?? true,
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
}
