class UserModel {
  final dynamic id;
  final String phone;
  final String? fullName;
  final String? storeName;
  final String role; // 'admin' or 'merchant'
  final String status; // 'ACTIVE', 'FROZEN', 'PENDING'
  final String? subscriptionEndDate;

  UserModel({
    required this.id,
    required this.phone,
    this.fullName,
    this.storeName,
    required this.role,
    required this.status,
    this.subscriptionEndDate,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      phone: json['phone'] ?? '',
      fullName: json['full_name'] ?? json['fullName'] ?? json['store_name'] ?? '',
      storeName: json['store_name'] ?? json['business_name'] ?? json['businessName'] ?? 'متجر التاجر',
      role: json['role'] ?? 'merchant',
      status: json['status'] ?? 'ACTIVE',
      subscriptionEndDate: json['subscription_end_date'] ?? json['subscription_expires_at'] ?? json['subscriptionExpiresAt'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'full_name': fullName,
      'store_name': storeName,
      'business_name': storeName,
      'role': role,
      'status': status,
      'subscription_end_date': subscriptionEndDate,
    };
  }

  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isFrozen => status.toUpperCase() == 'FROZEN';
}
