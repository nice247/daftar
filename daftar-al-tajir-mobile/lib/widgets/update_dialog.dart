import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';

class UpdateDialog extends StatefulWidget {
  final String versionName;
  final String downloadUrl;
  final bool forceUpdate;
  final String releaseNotes;

  const UpdateDialog({
    super.key,
    required this.versionName,
    required this.downloadUrl,
    required this.forceUpdate,
    required this.releaseNotes,
  });

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  bool _isDownloading = false;
  double _progressValue = 0.0;
  String _statusText = "";

  void _startUpdate() async {
    setState(() {
      _isDownloading = true;
      _statusText = "جاري الاتصال بالسيرفر...";
    });

    try {
      final client = http.Client();
      final request = http.Request('GET', Uri.parse(widget.downloadUrl));
      final response = await client.send(request);

      final totalBytes = response.contentLength ?? 0;
      int downloadedBytes = 0;

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/daftar_update.apk');
      final sink = file.openWrite();

      response.stream.listen(
        (chunk) {
          downloadedBytes += chunk.length;
          sink.add(chunk);
          if (totalBytes > 0) {
            final progress = downloadedBytes / totalBytes;
            if (mounted) {
              setState(() {
                _progressValue = progress;
                _statusText = "جاري التنزيل: ${(progress * 100).toInt()}%";
              });
            }
          }
        },
        onDone: () async {
          await sink.close();
          if (mounted) {
            setState(() {
              _statusText = "تم التنزيل بنجاح! جاري فتح التثبيت...";
            });
          }
          await OpenFilex.open(file.path);
        },
        onError: (e) {
          if (mounted) {
            setState(() {
              _statusText = "حدث خطأ أثناء التنزيل";
              _isDownloading = false;
            });
          }
        },
        cancelOnError: true,
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusText = "تعذر الاتصال بالسيرفر لتنزيل التحديث";
          _isDownloading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.forceUpdate && !_isDownloading,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.system_update, color: Color(0xFF10B981), size: 28),
            const SizedBox(width: 8),
            Text(
              widget.forceUpdate ? "تحديث إجباري جديد" : "تحديث جديد متوفر",
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "الإصدار الجديد: ${widget.versionName}",
              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669)),
            ),
            const SizedBox(height: 8),
            Text(
              widget.releaseNotes.isNotEmpty
                  ? widget.releaseNotes
                  : "يتوفر إصدار جديد يحتوي على تحسينات ملموسة في أداء واستقرار تطبيق دفتر التاجر.",
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 16),
            if (_isDownloading) ...[
              LinearProgressIndicator(
                value: _progressValue > 0 ? _progressValue : null,
                backgroundColor: Colors.grey.shade800,
                color: const Color(0xFF10B981),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  _statusText,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (!widget.forceUpdate && !_isDownloading)
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("تذكيري لاحقاً"),
            ),
          ElevatedButton.icon(
            onPressed: _isDownloading ? null : _startUpdate,
            icon: const Icon(Icons.download),
            label: Text(_isDownloading ? "جاري التحميل..." : "تحديث الآن"),
          ),
        ],
      ),
    );
  }
}
