# Shopkeeper V2

A mobile-first ledger and inventory management application for small business owners.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4
- **State Management:** TanStack Query v5, React Router v7
- **Backend/BaaS:** Firebase 12 (Firestore + Auth)
- **Mobile:** Capacitor 8 (Android/iOS)
- **AI:** Google Generative AI (Gemini)
- **Charts:** Recharts
- **Icons:** Lucide React

## Project Structure

- `src/` - Core React application
  - `components/` - UI components (auth, cards, charts, layout, modals, views, widgets)
  - `context/` - Global state providers (Auth, Data, Role, UI)
  - `services/` - API logic, Firebase config, utility services
  - `hooks/` - Custom hooks (offline sync, pagination, UI)
  - `types/` - TypeScript interfaces
- `android/` & `ios/` - Capacitor native project folders
- `pdf-generator/` - Custom Capacitor plugin for native PDF generation
- `public/` - Static assets, PWA icons

## Development

```bash
npm install --legacy-peer-deps
npm run dev
```

The dev server runs on port 5000 (http://0.0.0.0:5000).

## Notes

- Uses `--legacy-peer-deps` due to peer dependency conflict with `@capacitor-community/barcode-scanner` (requires Capacitor 5 core but project uses Capacitor 8)
- Firebase config is required via environment variables for the app to function
- Uses HashRouter for Capacitor compatibility
