# @autoflow/web

React UI components and frontend application code.

## Purpose

This package contains:

1. **Application Shell** - Entry point and root component
2. **Page Components** - Top-level page views
3. **UI Components** - Reusable interface elements
4. **Layout Components** - Page structure and navigation
5. **Context Providers** - Shared state management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│                   (Root Component)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│ CookiesProvider │ │LayoutProvider│ │     Pages     │
└─────────────────┘ └───────────┘ └─────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│   DefaultLayout │ │  TopMenu  │ │    LeftMenu     │
└─────────────────┘ └───────────┘ └─────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI Components                            │
│          (IconButton, Panel, APITester, etc.)               │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 |
| Styling | Tailwind CSS, styled-components |
| UI Library | Radix UI, Radix Themes |
| Icons | Radix Icons, Lucide React |
| State | React Context |
| Build | Bun bundler |

## Components

### App Shell

The root application component sets up providers and renders the main page:

```typescript
// App.tsx
export function App() {
  return (
    <CookiesProvider>
      <LayoutProvider>
        <Home />
      </LayoutProvider>
    </CookiesProvider>
  );
}
```

### Layout Context

Manages UI state like panel visibility and dimensions:

```typescript
import { LayoutContext } from '@web/components/context/LayoutContext';

function MyComponent() {
  const { state, dispatch } = useContext(LayoutContext);
  
  // Toggle left panel
  dispatch({ type: 'TOGGLE_LEFT_PANEL', toggle: true });
  
  // Update chat dimensions
  dispatch({ 
    type: 'UPDATE_CHAT_DIMENSIONS', 
    height: '400px',
    width: '300px',
  });
}
```

### UI Components

| Component | Description |
|-----------|-------------|
| `IconButton` | Icon-only button with hover states |
| `Panel` | Resizable panel container |
| `LeftMenu` | Left sidebar with buttons and expandable panel |
| `TopMenu` | Top navigation bar |
| `TopRightMenu` | Right-side panel (chat, tools) |
| `DefaultLayout` | Page layout wrapper |

### Menu System

The menu system is hierarchical:

```
TopMenu
├── TopLeftMenu (logo, navigation)
└── TopRightMenu
    ├── Buttons (chat toggle, etc.)
    └── Content panel (expandable)

LeftMenu
├── Top buttons (account, alerts, saved)
├── Bottom buttons
└── Expandable panel (content area)
```

## Directory Structure

```
src/
├── app/
│   ├── frontend.tsx      # Entry point (renders to DOM)
│   ├── index.html        # HTML template
│   └── lib/
│       └── utils.ts      # Utility functions
│
├── components/
│   ├── App.tsx           # Root component
│   ├── App.css           # Global styles
│   ├── globals.css       # CSS reset/base
│   │
│   ├── context/
│   │   └── LayoutContext.tsx  # UI state management
│   │
│   ├── layout/
│   │   └── DefaultLayout.tsx  # Page wrapper
│   │
│   ├── pages/
│   │   └── Home.tsx      # Home page
│   │
│   └── ui/
│       ├── IconButton.tsx
│       ├── Panel.tsx
│       ├── APITester.tsx
│       │
│       ├── left-menu/
│       │   ├── LeftMenu.tsx
│       │   └── buttons/
│       │       └── LeftMenuButtons.tsx
│       │
│       ├── top-menu/
│       │   ├── TopMenu.tsx
│       │   ├── top-left-menu/
│       │   │   ├── TopLeftMenu.tsx
│       │   │   └── LogoIcon.tsx
│       │   └── top-right-menu/
│       │       ├── TopRightMenu.tsx
│       │       ├── buttons/
│       │       ├── content/
│       │       └── pannel/
│       │
│       ├── bottom-menu/
│       │   └── BottomMenu.tsx
│       │
│       └── header/
│           └── Header.tsx
│
├── index.tsx             # Package entry
├── build.ts              # Build configuration
└── components.json       # shadcn/ui config
```

## Styling Approach

### Tailwind CSS

Used for utility-first styling:

```tsx
<div className="flex flex-col items-center p-4 bg-gray-100">
  <h1 className="text-2xl font-bold">Title</h1>
</div>
```

### styled-components

Used for component-specific styles with dynamic props:

```tsx
const StyledPanel = styled(Flex)<{ isExpanded: boolean }>`
  opacity: ${({ isExpanded }) => (isExpanded ? 1 : 0.5)};
  transition: opacity 0.3s ease-in-out;
`;
```

### Radix UI

Used for accessible, unstyled primitives:

```tsx
import { Flex } from '@radix-ui/themes';
import { PersonIcon } from '@radix-ui/react-icons';

<Flex align="center" gap="2">
  <PersonIcon />
  <span>Profile</span>
</Flex>
```

## Build

The package uses Bun's bundler for development and production builds:

```bash
# Development with HMR
bun run dev

# Production build
bun run build
```

## Usage

Components are imported via the `@web` path alias:

```typescript
import { App } from '@web/components/App';
import { IconButton } from '@web/components/ui/IconButton';
import { LayoutContext } from '@web/components/context/LayoutContext';
```

## Dependencies

- `@autoflow/core` - Domain types
- `@autoflow/client` - API client and hooks
- `react`, `react-dom` - React framework
- `@radix-ui/*` - UI primitives
- `styled-components` - CSS-in-JS
- `tailwindcss` - Utility CSS
