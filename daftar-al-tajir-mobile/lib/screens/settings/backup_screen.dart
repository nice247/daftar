import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/backup_service.dart';

class BackupScreen extends StatefulWidget {
  const BackupScreen({super.key});

  @override
  State<BackupScreen> createState() => _BackupScreenState();
}

class _BackupScreenState extends State<BackupScreen> {
  final MobileBackupService _backupService = MobileBackupService();

  Map<String, dynamic>? _summary;
  bool _loadingSummary = true;
  bool _isProcessing = false;
  String _processStatus = '';

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() => _loadingSummary = true);
    final data = await _backupService.getCloudSummary();
    if (mounted) {
      setState(() {
        _summary = data;
        _loadingSummary = false;
      });
    }
  }

  // --- 1. Cloud Backup Export & Download ---
  Future<void> _handleCloudBackup() async {
    setState(() {
      _isProcessing = true;
      _processStatus = "جاري إنشاء النسخة الاحتياطية السحابية...";
    });

    try {
      final backupData = await _backupService.exportCloudBackup();
      if (!mounted) return;

      if (backupData != null) {
        final jsonStr = const JsonEncoder.withIndent('  ').convert(backupData);
        await Clipboard.setData(ClipboardData(text: jsonStr));

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("تم إنشاء النسخة السحابية ونسخ محتواها للحافظة بنجاح!"),
              backgroundColor: Color(0xFF2B8A3E),
            ),
          );
        }
        _showBackupSuccessDialog(backupData);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("تعذر إنشاء النسخة السحابية، يرجى التحقق من الاتصال"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("حدث خطأ: $e"), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _processStatus = '';
        });
      }
      _loadSummary();
    }
  }

  // --- 2. Restore from Cloud or JSON ---
  Future<void> _handleRestoreDialog() async {
    final textCtrl = TextEditingController();
    bool replaceMode = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.restore_page_outlined, color: Color(0xFF2B8A3E)),
              SizedBox(width: 8),
              Text("استعادة نسخة احتياطية", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "الصق محتوى ملف النسخة الاحتياطية (JSON) في الحقل أدناه لاستعادة بياناتك:",
                  style: TextStyle(fontSize: 13, color: Color(0xFF495057)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: textCtrl,
                  maxLines: 6,
                  decoration: const InputDecoration(
                    hintText: '{\n  "schema_version": "2.0",\n  "customers": [...]\n}',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  title: const Text("استبدال كامل البيانات الحالية (مسح القديم)", style: TextStyle(fontSize: 13)),
                  subtitle: const Text("عند التفعيل سيتم استبدال البيانات المسجلة بالنسخة المستعادة", style: TextStyle(fontSize: 11, color: Colors.grey)),
                  value: replaceMode,
                  activeColor: Colors.red,
                  onChanged: (val) => setDState(() => replaceMode = val ?? false),
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("إلغاء"),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
              onPressed: () async {
                final raw = textCtrl.text.trim();
                if (raw.isEmpty) return;

                Navigator.pop(ctx);
                setState(() {
                  _isProcessing = true;
                  _processStatus = "جاري استعادة البيانات والتحقق من سلامتها...";
                });

                try {
                  final decoded = jsonDecode(raw) as Map<String, dynamic>;
                  // 1. Restore local SQLite
                  await _backupService.restoreLocalBackup(decoded);

                  // 2. Restore Cloud Backend
                  final cloudRes = await _backupService.restoreCloudBackup(decoded, replaceMode: replaceMode);

                  if (mounted) {
                    if (cloudRes['success'] == true) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text("تمت استعادة النسخة الاحتياطية بنجاح وتحديث السجلات!"),
                          backgroundColor: Color(0xFF2B8A3E),
                        ),
                      );
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text("تمت الاستعادة محلياً (تنبيه السحابة: ${cloudRes['message']})"),
                          backgroundColor: Colors.amber,
                        ),
                      );
                    }
                  }
                } catch (err) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text("فشلت الاستعادة: صيغة البيانات غير صحيحة ($err)"), backgroundColor: Colors.red),
                    );
                  }
                } finally {
                  if (mounted) {
                    setState(() {
                      _isProcessing = false;
                      _processStatus = '';
                    });
                  }
                  _loadSummary();
                }
              },
              child: const Text("تأكيد الاستعادة"),
            ),
          ],
        ),
      ),
    );
  }

  // --- 3. Local SQLite Backup Export ---
  Future<void> _handleLocalExport() async {
    setState(() {
      _isProcessing = true;
      _processStatus = "جاري استخراج النسخة المحلية من جهازك...";
    });

    try {
      final localBackup = await _backupService.exportLocalBackup();
      final jsonStr = const JsonEncoder.withIndent('  ').convert(localBackup);
      await Clipboard.setData(ClipboardData(text: jsonStr));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("تم تصدير النسخة المحلية ونسخها إلى الحافظة! يمكنك حفظها أو إرسالها"),
            backgroundColor: Color(0xFF2B8A3E),
          ),
        );
      }
      _showBackupSuccessDialog(localBackup);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("فشل التصدير المحلي: $e"), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _processStatus = '';
        });
      }
    }
  }

  void _showBackupSuccessDialog(Map<String, dynamic> data) {
    final stats = data['stats'] as Map<String, dynamic>? ?? {};
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: Color(0xFF2B8A3E), size: 28),
            SizedBox(width: 8),
            Text("تم إعداد النسخة الاحتياطية", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("تم استخراج كامل بيانات دفتر التاجر بنجاح ونسخها إلى الحافظة.", style: TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF2B8A3E).withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  _buildStatRow("عدد العملاء", "${stats['customers_count'] ?? 0}"),
                  _buildStatRow("عدد المعاملات / الديون", "${stats['invoices_count'] ?? stats['customer_debts_count'] ?? 0}"),
                  _buildStatRow("عدد المصروفات", "${stats['expenses_count'] ?? 0}"),
                  _buildStatRow("ديون الموردين", "${stats['merchant_debts_count'] ?? 0}"),
                ],
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
            onPressed: () => Navigator.pop(ctx),
            child: const Text("حسناً"),
          ),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF495057))),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("النسخ الاحتياطي والاستعادة", style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF212529),
        elevation: 0.5,
      ),
      body: _isProcessing
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(color: Color(0xFF2B8A3E)),
                  const SizedBox(height: 16),
                  Text(_processStatus, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Status & Info Card
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2B8A3E).withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.cloud_done_rounded,
                              size: 48,
                              color: Color(0xFF2B8A3E),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            "حماية وأمان بياناتك",
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            "احفظ نسخة احتياطية مشفرة لدفترك واستعدها في أي وقت على أي هاتف جديد بدون أي فقدان للبيانات.",
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Color(0xFF6C757D)),
                          ),
                          const Divider(height: 28),
                          if (_loadingSummary)
                            const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)))
                          else ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _buildSummaryBadge("العملاء", "${_summary?['customers_count'] ?? 0}"),
                                _buildSummaryBadge("المصروفات", "${_summary?['expenses_count'] ?? 0}"),
                                _buildSummaryBadge("الموردين", "${_summary?['merchant_debts_count'] ?? 0}"),
                                _buildSummaryBadge("السجلات", "${_summary?['total_records'] ?? 0}"),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Actions Section: Cloud Backup
                  const Text(
                    "النسخ الاحتياطي السحابي (Cloud)",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF212529)),
                  ),
                  const SizedBox(height: 10),

                  ElevatedButton.icon(
                    onPressed: _handleCloudBackup,
                    icon: const Icon(Icons.cloud_upload_rounded),
                    label: const Text("إنشاء نسخة سحابية ونسخها للحافظة"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2B8A3E),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _handleRestoreDialog,
                    icon: const Icon(Icons.cloud_download_rounded, color: Color(0xFF2B8A3E)),
                    label: const Text("استعادة البيانات من نسخة احتياطية", style: TextStyle(color: Color(0xFF2B8A3E))),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF2B8A3E), width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Actions Section: Local Backup
                  const Text(
                    "النسخ الاحتياطي المحلي (الجهاز)",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF212529)),
                  ),
                  const SizedBox(height: 10),

                  ElevatedButton.icon(
                    onPressed: _handleLocalExport,
                    icon: const Icon(Icons.save_alt_rounded),
                    label: const Text("تصدير النسخة المحلية من الهاتف"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F172A),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Security Note
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, color: Colors.amber.shade900, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            "نصيحة أمان: يُفضل أخذ نسخة احتياطية أسبوعياً وحفظ النص المشفر في مكان آمن أو إرساله إلى محادثتك المحفوظة في الواتساب.",
                            style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryBadge(String title, String count) {
    return Column(
      children: [
        Text(count, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF2B8A3E))),
        const SizedBox(height: 2),
        Text(title, style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
      ],
    );
  }
}
