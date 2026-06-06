# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                  # Start Metro bundler
npm run ios                # Build and run on iOS Simulator
npm run android            # Build and run on Android Emulator
npm run lint               # ESLint check
npm run test               # Run Jest tests

# iOS native dependencies (after adding packages)
cd ios && pod install && cd ..

# Run a single Jest test file
npx jest src/path/to/test.ts
```

## Architecture

**HuastexApp** is a React Native 0.83 (React 19) B2B sales and inventory management app for a multi-branch company. It uses TypeScript across most of the codebase.

### Authentication & State

- `src/contexts/AuthContext.js` — single source of truth for auth state. Stores `token`, `role`, `branch`, and `email` in AsyncStorage. Decodes JWT expiry via `src/utils/jwt.js` and auto-logs out on expiry.
- No Redux — all cross-screen state flows through AuthContext or screen-local `useState`.

### Navigation

`src/navigation/AppNavigator.js` — single Native Stack navigator that switches between two route groups based on `AuthContext.isAuthenticated`:

- **Unauthenticated**: `SignIn`, `SignUp`
- **Authenticated**: `Home`, `Sales`, `Payments`, `Inventory`, `Dailyreport`, `User`, `Forms`, `Us`

`Navbar.js` is the shared header; it receives navigation props and renders a hamburger menu with role-filtered links.

### API Layer

`src/api.js` exports a pre-configured Axios instance:

- Base URL: `https://api.huastex.com`
- Request interceptor attaches the JWT from AsyncStorage on every call
- Screens call endpoints directly (no service layer abstraction) — follow the same pattern when adding new API calls

### Role-Based Access

Four roles (`superadmin`, `admin`, `staff`, `iT`) control which screens and actions are visible. Role is stored in AuthContext and checked inline in components. Branch names (`Cerro Azul`, `Aquismon`, `Tepetzintla`, `Tlacolula`) determine which branch-specific pricing tier is applied to sales and inventory.

### Key Screens & Components

| File | Responsibility |
|---|---|
| `screens/Sales/SalesScreen.tsx` | Full CRUD for sales; calls `SaleModal` for create/edit |
| `components/SaleModal.tsx` | Sale form with product picker, payment terms, date pickers, signature canvas |
| `screens/InventoryScreen.tsx` | Product list with branch-specific pricing (cash / MSI / credit) |
| `components/InventoryModal.tsx` | Add/edit product form |
| `screens/PaymentsScreen.tsx` | Payment history per sale; calls `PaymentsModal` |
| `screens/ReportScreen.tsx` | Daily accounting and transaction log |
| `screens/HomeScreen.tsx` | Dashboard showing logged-in user's orders |
| `screens/FormsScreen.tsx` | Formula management (superadmin only) |
| `utils/Incoms.ts` | Builds the income payload shape for daily report submissions |

### TypeScript

Most screens and components are `.tsx`; context and navigation files remain `.js`. `tsconfig.json` is in place with standard RN settings. New files should be `.tsx`/`.ts`.
