/**
 * xlsx native
 *
 * Purpose: xlsx native — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/utils
 * Key exports: (see file)
 *
 * @file-header
 */
// Native (iOS/Android) — Metro polyfills in metro.config.js allow the real SheetJS build.
import * as XLSX from 'xlsx';

export default XLSX;
