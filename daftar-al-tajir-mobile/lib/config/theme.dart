import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // React App Color Tokens
  static const Color primaryGreen = Color(0xFF2B8A3E);
  static const Color primaryGreenHover = Color(0xFF237032);
  static const Color accentAmber = Color(0xFFD97706);
  static const Color dangerRed = Color(0xFFC92A2A);

  static const Color bgWhite = Color(0xFFFFFFFF);
  static const Color bgLightGrey = Color(0xFFF8F9FA);
  static const Color borderGrey = Color(0xFFDEE2E6);

  static const Color textDark = Color(0xFF212529);
  static const Color textMuted = Color(0xFF6C757D);

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      primaryColor: primaryGreen,
      scaffoldBackgroundColor: bgWhite,
      cardColor: bgWhite,
      colorScheme: const ColorScheme.light(
        primary: primaryGreen,
        secondary: accentAmber,
        surface: bgWhite,
        error: dangerRed,
      ),
      textTheme: GoogleFonts.cairoTextTheme(ThemeData.light().textTheme).apply(
        bodyColor: textDark,
        displayColor: textDark,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bgWhite,
        elevation: 0.5,
        centerTitle: true,
        iconTheme: const IconThemeData(color: textDark),
        titleTextStyle: GoogleFonts.cairo(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: textDark,
        ),
      ),
      cardTheme: CardThemeData(
        color: bgWhite,
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: borderGrey, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgWhite,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderGrey),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderGrey),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryGreen, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        labelStyle: const TextStyle(color: textMuted, fontSize: 13),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGreen,
          foregroundColor: Colors.white,
          elevation: 1,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.cairo(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme => lightTheme;
}
