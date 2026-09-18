# Blueprint: Sistem Manajemen Logistik (CRUD)

## Tech Stack
- Frontend: HTML5 Semantik, CSS3 Modern, Vanilla JavaScript (ES6)
- Backend & Database: Supabase (PostgreSQL via Supabase JS Client)

## Arsitektur Database (Tabel: assets)
- `id` (UUID, auto-generated)
- `item_name` (string)
- `category` (string)
- `status` (string) 
- `destination` (string)
- `created_at` (timestamp)

## Kredensial API (Aman untuk Frontend Client)
- SUPABASE_URL = "https://tsmynpxmxfjdthhgonow.supabase.co/rest/v1/"
- SUPABASE_ANON_KEY = "sb_publishable_LAKA901Ubhz1g7en9ZvkMA_vLiQfbXk"

## Aturan Pembelajaran (SANGAT PENTING)
1. DILARANG menggunakan framework (React, Vue, Tailwind). Tulis murni Vanilla JS.
2. DILARANG menulis seluruh fungsi CRUD sekaligus. Kerjakan bertahap sesuai instruksi saya (misal: Create dulu, lalu Read, dst).
3. Setiap kali kamu selesai menulis sebuah blok logika utama (misal: fungsi fetch ke API atau DOM manipulation), berikan saya penjelasan singkat NAMUN mendalam mengenai:
   - Kenapa struktur logika ini yang dipilih.
   - Konsep fundamental di balik syntax tersebut (misal: async/await, promise, event delegation) agar saya bisa menggunakannya di project lain.