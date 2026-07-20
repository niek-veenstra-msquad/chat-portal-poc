# copilot-instructions.md — Chat Portal

## Stack

- **PHP** / **Laravel** — backend
- **Inertia.js** (`inertiajs/inertia-laravel` + `@inertiajs/react`) — SPA bridge, no separate API
- **React** + **TypeScript** (strict mode) — frontend
- **TanStack Query** (`@tanstack/react-query`) — server state management for API calls
- **Tailwind CSS** (Vite plugin, no config file) — styling
- **shadcn/ui** — component library (new-york style, lucide icons)
- **Vite** + `laravel-vite-plugin` — asset bundling
- **Lucide React** — icons only (no other icon libraries)
- **PostgreSQL** — database (via Docker)
- **Ollama** — local LLM inference (via Docker)

## Commands

```bash
composer run dev        # starts Laravel, queue, pail logs, and Vite concurrently
composer run setup      # fresh install: composer + npm + migrate + build
composer run test       # clears config cache, then runs PHPUnit
npm run build           # production Vite build
npm run dev             # Vite dev server only
./vendor/bin/pint       # PHP code style fixer (Laravel Pint)
php artisan migrate     # run database migrations
docker compose up -d    # start PostgreSQL and Ollama containers
docker compose down     # stop containers
```

## Project Structure

```
app/
  DTO/                  # Data Transfer Objects for frontend
  Http/
    Controllers/
      Api/              # mutation controllers (store, update, delete — no rendering)
      Web/              # page-rendering controllers (Inertia::render)
    Middleware/
      HandleInertiaRequests.php   # shared Inertia props live here
    Requests/
      Api/              # Form Requests for Api controllers
      Web/              # Form Requests for Web controllers
  Models/               # Eloquent models
  Services/             # Services for external integrations (Ollama, etc.)
resources/
  js/
    pages/              # Inertia page components (map 1:1 to routes)
      chats/            # chat pages
    components/         # shared React components
    components/ui/      # shadcn/ui components
    hooks/
      api/              # TanStack Query hooks (useMutation, useQuery, useInfiniteQuery)
      ui/               # UI/utility hooks (useAppearance, useMobile, useCurrentUrl, etc.)
    lib/
      api.ts            # shared fetch wrapper with CSRF + error handling
      utils.ts          # general utilities (cn, etc.)
    types/              # shared TypeScript types
    layouts/            # layout components
    app.tsx             # Inertia bootstrap + QueryClientProvider
  css/
    app.css             # Tailwind entry point
  views/
    app.blade.php       # single Blade root template
routes/
  web.php               # page-rendering routes (Web controllers)
  api.php               # mutation routes (Api controllers, /api/ prefix)
docker-compose.yml      # PostgreSQL + Ollama containers
```

## Comments.
Never use code comments to indicate information about layouts or other react things.
If you see comments always remove them when they are describing what part of ui some component or html is.

## Inertia Conventions

### Lazy Loading
By default, make sure data props which come from external services / API's are lazy loaded so that a user does not have to wait long before the page renders.

### Shared props

All data shared on every request is defined in `HandleInertiaRequests::share()`:

```php
public function share(Request $request): array
{
    return [
        ...parent::share($request),
        'auth' => [
            'user' => $request->user(),
        ],
    ];
}
```

Never pass the authenticated user through a page-specific `Inertia::render()` call — it belongs in shared props.

### Accessing inertia props on page components.

Always type pages types using an interface directly above the page component.
Page props should always be passed directly in the component and not through the usePage hook.
```tsx
import { usePage } from '@inertiajs/react'
import { PageProps } from '@/types'

interface PageProps {
    user: null | UserType
}
export default function Page(props: PageProps){
    
}
```

### Page components

- Files in `resources/js/Pages/` map directly to route names passed to `Inertia::render()`.
- Use default exports for page components.
- Wrap the layout inline inside the component's return statement:

```tsx
export default function Dashboard() {
  return (
    <PortalLayout>
      {/* page content */}
    </PortalLayout>
  )
}
```

### Navigation

Always use `<Link href="...">` from `@inertiajs/react` for internal navigation. Never use `<a>` for internal links.

Use `router.visit()` for programmatic navigation, `router.post()` for form actions (login, logout):

```tsx
import { router } from '@inertiajs/react'

// navigation
router.visit('/portal', { replace: true })

// form submission
router.post('/login', { email, password }, { onFinish: () => setSubmitting(false) })

// logout
router.post('/logout')
```

### API mutations (non-page-rendering requests)

API controllers (`App\Http\Controllers\Api`) handle data mutations (create, update, delete, toggle) and return JSON responses. The frontend communicates with these endpoints exclusively through **TanStack Query** hooks (`useMutation`). Never use `router.post()`, `router.patch()`, or `router.delete()` for API endpoints — those are Inertia methods that expect redirect responses.

**Convention: always wait for the response before reflecting changes in the UI.** Never optimistically update local state. After a successful mutation, call `router.reload()` to refresh the Inertia page props with the latest server state:

```tsx
import { router } from '@inertiajs/react';
import { useUpdateChat } from '@/hooks/api/use-update-chat';

export default function ChatPage({ chat }) {
    const updateChat = useUpdateChat(chat.id);

    function handleRename(newTitle: string) {
        updateChat.mutate({ title: newTitle }, {
            onSuccess: () => router.reload(),
        });
    }
}
```

**Exception:** Creating a resource that should navigate to its new page can use `<Link method="post">` or `router.post()` with Inertia (the controller returns a redirect in this case). Example: creating a new chat that redirects to `chats.show`.

### Non-navigating HTTP requests (TanStack Query hooks)

All API calls to backend endpoints (`/api/*`) that return JSON must use **TanStack Query** via custom hooks. This includes both data fetching (`useQuery`) and mutations (`useMutation`). Never use raw `fetch()`, `axios`, or Inertia's `router.patch()`/`router.delete()` for JSON API endpoints.

#### Hook directory structure

Hooks are organized into subdirectories under `resources/js/hooks/`. **No hook files may live directly in `hooks/`** — every hook must belong to a subdirectory:

- `hooks/api/` — TanStack Query hooks (`useMutation`, `useQuery`, `useInfiniteQuery`) that call backend endpoints
- `hooks/ui/` — UI/utility hooks (`useAppearance`, `useMobile`, `useCurrentUrl`, etc.)

#### Creating API hooks

Each API hook wraps a single endpoint and lives in its own file. Use the `api()` helper from `@/lib/api` for all fetch calls:

```tsx
// hooks/api/use-send-message.ts
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

export function useSendMessage(chatId: number) {
    return useMutation<Message, Error, string>({
        mutationFn: (content) =>
            api<Message>(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content }),
            }),
    });
}
```

#### Using hooks in components

Never inline `useMutation` or `useQuery` calls directly in a component. Always import and call the dedicated hook:

```tsx
import { useSendMessage } from '@/hooks/api/use-send-message';

export default function ChatPage({ chat }) {
    const sendMessage = useSendMessage(chat.id);

    function handleSubmit(content: string) {
        sendMessage.mutate(content, {
            onSuccess: (data) => { /* update local state */ },
            onError: () => { /* handle error */ },
        });
    }
}
```

#### When to use TanStack Query vs Inertia router

| Scenario | Tool |
|----------|------|
| Page navigation / redirect after action | `router.visit()` / `<Link>` (Inertia) |
| Creating a resource with redirect to its page | `router.post()` / `<Link method="post">` (Inertia) |
| Data mutations (update, delete, toggle) | `useMutation` (TanStack Query) → `router.reload()` on success |
| Fetching JSON data from API | `useQuery` (TanStack Query) |
| Infinite scroll / pagination | `useInfiniteQuery` (TanStack Query) |
| Login / logout | `router.post()` (Inertia, session-based) |

#### API utility (`lib/api.ts`)

The `api()` function handles CSRF tokens, JSON headers, and error parsing. All API hooks must use it — never call `fetch()` directly:

```tsx
import { api } from '@/lib/api';

// GET
const data = await api<ResponseType>('/api/endpoint');

// POST
const result = await api<ResponseType>('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify({ key: 'value' }),
});
```

On non-2xx responses, `api()` throws an `ApiError` with `status`, `message`, and `data` properties.

### Form errors

Validation errors from Laravel come through `usePage().props.errors` — keyed by field name. Never manage server-side validation error state locally with `useState`. Never read errors from `useForm().errors`.

`PageProps` (defined in `types.ts`) carries the `errors` key and is the type to pass to `usePage<T>()`:

```tsx
import { usePage } from '@inertiajs/react'
import { PageProps } from '@/types'

const { errors } = usePage<PageProps>().props
// use errors.email, errors.password, errors.invite, etc.
```

### External API failures (Power Platform / deferred data)

Data props loaded from external services (Power Platform, SharePoint, etc.) must use `Inertia::defer()` so the page renders immediately with a loading state. The deferred callback **always** returns a `{ data: T[], error: string|null }` object — never a redirect or `back()->withErrors()` (those cannot be used inside a deferred callback).

- `error: null` → success
- `error: 'message'` → failure; `data` will be `[]`

Never cache results inside external api calling classes. If results need to be cached, do this inside a controller or other managing class.
```php
// Controller
'documents' => Inertia::defer(function () {
    $response = $this->pp->getSharepointFiles();

    return [
        'data' => $response->successful()
            ? collect($response->json())->map(SharepointDocumentData::fromArray(...))->values()
            : [],
        'error' => $response->successful() ? null : 'Ophalen van documenten mislukt. Probeer het later opnieuw.',
    ];
}),
```

The TypeScript prop type must use the shared `DeferredResult<T>` generic (defined in `types.ts`) and be optional (`?`) since it is `undefined` until the deferred resolves:

```tsx
import { DeferredResult } from '@/types'

interface PageProps {
    documents?: DeferredResult<DocumentLine>
}
```

On the frontend, wrap the content in `<Deferred>` with a loading fallback. Inside, check `prop?.error` for the error banner, and use `prop?.data ?? []` for the data:

```tsx
<Deferred data={['documents']} fallback={<Spinner />}>
    {documents?.error && (
        <div className="...error banner...">
            <AlertCircle size={16} />
            {documents.error}
        </div>
    )}
    <DataTable items={documents?.data ?? []} />
</Deferred>
```

### Authentication guard

Protected pages are wrapped with Laravel's `auth` middleware in `routes/web.php`. The frontend checks `auth.user` from Inertia props — if `null`, render nothing or redirect:

```tsx
const { auth: { user } } = usePage<PageProps>().props
if (!user) return null
```

Do **not** use `useEffect` + `router.visit` to redirect unauthenticated users on the frontend. The `auth` middleware on the route handles this server-side.

## TypeScript Conventions

### PageProps

All shared Inertia props are typed in `resources/js/types.ts`. Extend this file when new shared props are added to the middleware:

```typescript
export interface User {
  id: number
  name: string
  email: string
  klantnummer?: string
  company?: string
}
```

### Path alias

`@/` maps to `resources/js/`. Always use it for internal imports:

```tsx
import { PageProps } from '@/types'
import { PortalLayout } from '@/components/portal-layout'
```

### Strict mode

`tsconfig.json` has `"strict": true`. No `any` types. No `ts-ignore` comments without an explanation.

### No magic numbers or strings

Never use raw numeric or string literals when a named constant or enum exists. Mirror backend enums in `resources/js/types.ts` and import them wherever comparisons are needed:

```typescript
// types.ts
export enum Role {
  AlleenLezen = 1,
  Gebruiker   = 2,
  Beheerder   = 10,
}

// Usage
const isAdmin = user.roles === Role.Beheerder
```

## Laravel Conventions

### Eloquent-Centric Architecture
This project follows an Eloquent-centric architecture. We prefer to place data access and domain-related behavior close to the models that own the data.

#### Principles

* Controllers should remain thin and focus on HTTP concerns.
* Eloquent relationships should be defined on the owning model.
* Reusable query logic should be implemented using Eloquent scopes.
* Domain-specific behavior should be implemented as model methods.
* Services should only be introduced when logic spans multiple models, external systems, or complex business processes.
* Repository patterns should not be introduced by default. Eloquent already provides an abstraction over data access.

#### Preferred

```php
$user = auth()->user();

$quickLinks = $user->quickLinks()
    ->visible()
    ->ordered()
    ->get();
```

Or:

```php
$quickLinks = $user->visibleQuickLinks();
```

#### Avoid

```php
$quickLinks = $userRepository->getVisibleQuickLinksForUser($userId);
```

when the repository merely wraps Eloquent queries without adding meaningful abstraction.

#### Scopes

Reusable filtering and ordering logic should be expressed as scopes.

```php
class QuickLink extends Model
{
    public function scopeVisible($query)
    {
        return $query->where('is_visible', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('position');
    }
}
```

#### Services

Introduce a service when logic:

* Combines multiple aggregates or models.
* Calls external APIs.
* Coordinates workflows.
* Performs complex business operations.
* Requires caching, synchronization, or orchestration.

Example:

```php
$dashboard = $dashboardService->buildForUser($user);
```

Always register services as singletons in `AppServiceProvider::register()` so they are shared across the container and resolved via DI:

```php
$this->app->singleton(ProfilePhotoService::class);
```

If the service has no custom constructor logic, the short form above is sufficient — Laravel will auto-resolve its dependencies. Use the closure form only when manual wiring is needed:

```php
$this->app->singleton(MyService::class, fn (Application $app) => new MyService(
    config('services.my_key'),
));
```

Never instantiate services with `new` inside controllers or middleware — always inject them via the constructor.

### Rule of Thumb

If the logic answers the question:

> "What data belongs to this model?"

it probably belongs on the model or in a scope.

If the logic answers the question:

> "How do multiple systems work together to achieve a business goal?"

it probably belongs in a service.

### Controllers

Controllers are thin. They never type-hint the base `Illuminate\Http\Request` — every controller action takes a dedicated Form Request (see below) instead, reads input via `$request->validated()`, calls `Auth::attempt()` or model/service methods, and returns an Inertia response or redirect:

```php
public function login(LoginRequest $request)
{
    $credentials = $request->validated();

    if (Auth::attempt($credentials, $request->boolean('remember'))) {
        $request->session()->regenerate();
        return redirect()->intended('/portal');
    }

    return back()->withErrors(['email' => '...'])->onlyInput('email');
}
```

### Form Requests

Controller actions that accept user input or need request-specific authorization must receive a custom `FormRequest` as their first argument — never the base `Illuminate\Http\Request`. Form Requests own all validation rules so controllers stay free of inline `$request->validate([...])` calls. Read validated input with `$request->validated()`.

Form Requests are organized by controller type:

- `app/Http/Requests/Api/` — requests for API controllers (mutations: store, update, delete)
- `app/Http/Requests/Web/` — requests for Web controllers (page rendering with validated query params)

If a request is shared between both Api and Web controllers, place it in the root `app/Http/Requests/` directory. Prefer duplication over premature abstraction — only share a request when the rules are truly identical.

```php
// app/Http/Requests/Api/StoreChatRequest.php
namespace App\Http\Requests\Api;

class StoreChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
        ];
    }
}
```

For authorization within Form Requests, use `$this->route('model')->user_id === $this->user()->id` to verify ownership:

```php
public function authorize(): bool
{
    return $this->route('chat')->user_id === $this->user()->id;
}
```

**Exception:** Actions that have no validation rules and no custom authorization logic (e.g. simple `index()` or `show()` methods) do not need a dedicated FormRequest. Omit the request parameter entirely for these actions.

### Routes

Routes are split across two files:

- **`routes/web.php`** — page-rendering routes (GET requests that return `Inertia::render()`). Uses Web controllers.
- **`routes/api.php`** — API routes (POST, PATCH, DELETE, GET) that return JSON. Uses Api controllers. All routes are prefixed with `/api/` automatically.

API routes use the `web` middleware group (session + CSRF) since they are called from the same browser session — no tokens needed.

```php
// routes/web.php — page rendering
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('chats/{chat}', [ChatController::class, 'show'])->name('chats.show');
});

// routes/api.php — JSON API (called via TanStack Query hooks)
Route::middleware(['web', 'auth', 'verified'])->group(function () {
    Route::post('chats', [ChatController::class, 'store'])->name('chats.store');
    Route::patch('chats/{chat}', [ChatController::class, 'update'])->name('chats.update');
    Route::delete('chats/{chat}', [ChatController::class, 'destroy'])->name('chats.destroy');
});
```

Don't render components in `web.php` — use controllers for this. Name every route. Frontend API calls must use the `/api/` prefix and always go through TanStack Query hooks:

```tsx
// In a hook (hooks/api/use-update-chat.ts)
api<ResponseType>(`/api/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify({ title }) })

// In a component
const updateChat = useUpdateChat(chat.id);
updateChat.mutate({ title: newTitle }, { onSuccess: () => router.reload() });
```

### Models

Use PHP 8 attribute syntax for `$fillable` and `$hidden` (available since Laravel 13):

```php
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable { ... }
```

### Migrations

Use anonymous migration classes (the Laravel default). Column order: `id` → domain columns → foreign keys → `timestamps`.

### DTOs

Use DTO classes to transform model data for the frontend. DTOs live in `app/DTO/` and have a static `fromModel()` factory method. Never add frontend-mapping logic directly to Eloquent models.

```php
// app/DTO/QuickLinkData.php
final class QuickLinkData
{
    public function __construct(
        public readonly string $id,
        public readonly string $title,
        public readonly string $href,
    ) {}

    public static function fromModel(QuickLink $link): self
    {
        return new self(
            id:    $link->link_id,
            title: $link->title,
            href:  $link->href,
        );
    }
}
```

Use them in controllers when passing data to Inertia:

```php
'quickLinks' => $user->quickLinks()->ordered()->get()->map(QuickLinkData::fromModel(...))->values(),
```

### First-class callable syntax

Use PHP 8.1+ first-class callable syntax (`...`) instead of wrapping callables in closures:

```php
// Preferred
->map(QuickLinkData::fromModel(...))

// Avoid
->map(fn ($l) => QuickLinkData::fromModel($l))
```

Works on static methods, instance methods, and regular functions.

## Component Extraction

When a logical UI entity (e.g. a card, list item, filter panel, modal body) takes up a significant number of lines inside a page component, extract it into its own component for readability. Place extracted components in `resources/js/components/` (shared) or co-locate them next to the page file when only used once.

Guidelines:
- **File size limit:** Frontend files should generally not exceed 500–800 lines of code. When a file grows beyond this, look for logical UI parts that can be extracted into separate components to maintain a clear mental overview for developers.
- If a self-contained UI block exceeds ~30–40 lines of JSX, it is a candidate for extraction.
- Name components after the UI concept they represent (e.g. `ArticleCard`, `CategoryFilter`).
- Keep props explicit and typed — no spreading of large objects without an interface.
- Extraction is about readability, not premature reuse. Even single-use blocks benefit from being named and separated.

## Styling Conventions

- Tailwind CSS 4 — no `tailwind.config.js`, configuration goes in `resources/css/app.css` via `@theme`.
- Brand colours: `#01673D` (dark green), `#005935` (deeper green), `#9DD15A` (lime accent).
- Use Tailwind utility classes directly. No CSS modules or styled components.
- Rounded corners: `rounded-xl` for cards/nav items, `rounded-2xl` for larger containers, `rounded-full` for buttons and badges.
- Shadows: `shadow-sm` for cards, `shadow-2xl` for modal-like surfaces.

# Git
By default, after creating new files, stage these files. 
