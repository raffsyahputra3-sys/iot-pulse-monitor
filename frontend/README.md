# Frontend

Dashboard web monitoring kandang ayam. Di-serve oleh `backend/server.js`
via `express.static` — route `/` dan SPA fallback mengarah ke `v10.html`.

## Entry points

| File | Fungsi |
|------|--------|
| `v10.html` | **Aplikasi utama** — dashboard 3D kandang + 8 modal (4 sensor + 4 aktuator), konek Socket.IO via `connector.js` |
| `index.html` | Dashboard sederhana alternatif (kartu + Chart.js + tabel), pakai `css/style.css` + `js/main.js` |
| `connector.js` | Bridge frontend ↔ backend Socket.IO (mapping field + state aktuator + kirim perintah) |

## Struktur

```
frontend/
├── v10.html        # app utama (single-file, CDN: three.js + socket.io)
├── index.html      # dashboard simpel alternatif
├── connector.js    # bridge Socket.IO
├── css/style.css   # style dashboard simpel
├── js/main.js      # logic dashboard simpel
└── _legacy/        # arsip dashboard lama (tidak dipakai, jangan diimpor)
```

`v10.html` self-contained kecuali `connector.js` — tidak ada build step,
tidak ada dependensi lokal selain file di atas.
