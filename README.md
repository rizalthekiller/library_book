# PustakaScan - Aplikasi OCR Cover Buku & PWA Cerdas

Aplikasi mobile-first cerdas berbasis web yang memindai cover buku menggunakan OCR lokal (tanpa server) lalu mencari data buku secara otomatis dari berbagai sumber gratis di internet (Google Books, OpenLibrary, dsb). Aplikasi ini didesain agar dapat berjalan baik secara online maupun offline penuh (sebagai PWA yang dapat diinstal).

## 🚀 Fitur Utama
1. **OCR Klien Lokal (Offline)**: Menggunakan Tesseract.js yang berjalan langsung di browser HP pengguna tanpa server eksternal berbayar.
2. **Pencarian Multi-Sumber Gratis**: Mengintegrasikan API publik gratis dari Google Books dan OpenLibrary tanpa membutuhkan API Key atau token berbayar.
3. **PWA (Progressive Web App)**: Mendukung Service Worker untuk caching penuh sehingga aplikasi dapat dibuka dan berjalan offline.
4. **Desain Mobile-First Premium**: Desain premium glassmorphic, gelap neon yang modern dan responsif untuk browser mobile.
5. **Ekspor Data**: Dapat mengekspor seluruh daftar buku yang disimpan ke format CSV secara offline.

## 📦 Cara Deploy Ke Vercel (Sangat Mudah!)
Aplikasi ini 100% statis tanpa server-side build step yang rumit. 
1. Masuk ke [Vercel](https://vercel.com).
2. Hubungkan repositori Git Anda (atau unggah folder ini secara manual).
3. Vercel akan otomatis mengenali berkas `index.html` dan `vercel.json` dan mendeploy aplikasi Anda dalam waktu kurang dari 1 menit!

## 💻 Menjalankan Secara Lokal
Cukup buka berkas `index.html` di browser Anda melalui server lokal (seperti Live Server di VS Code, XAMPP, atau command line tool python/node).

```bash
# Contoh dengan Python
python -m http.server 8000
```
Buka browser Anda di `http://localhost:8000`. Untuk mengaktifkan kamera secara aman di HP, pastikan Anda mengaksesnya via `https` (yang otomatis disediakan oleh Vercel secara gratis saat dideploy).
