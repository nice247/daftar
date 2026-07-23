class UserModel {
  final dynamic id;
  final String phone;
  final String? fullName;
  final String? businessName;
  final String role; // 'admin' or 'merchant'
  final String? subscriptionStatus;
  final String? subscriptionExpiresAt;

  UserModel({
    required this.id,
    required this.phone,
    this.fullName,
    this.businessName,
    required this.role,
    this.subscriptionStatus,
    this.subscriptionExpiresAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      phone: json['phone'] ?? '',
      fullName: json['full_name'] ?? json['fullName'] ?? json['store_name'],
      businessName: json['store_name'] ?? json['business_name'] ?? json['businessName'],
      role: json['role'] ?? 'merchant',
      subscriptionStatus: json['status'] ?? json['subscription_status'] ?? json['subscriptionStatus'],
      subscriptionExpiresAt: json['subscription_end_date'] ?? json['subscription_expires_at'] ?? json['subscriptionExpiresAt'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'full_name': fullName,
      'business_name': businessName,
      'store_name': businessName,
      'role': role,
      'subscription_status': subscriptionStatus,
      'subscription_expires_at': subscriptionExpiresAt,
    };
  }

  bool get isAdmin => role.toLowerCase() == 'admin';
}
