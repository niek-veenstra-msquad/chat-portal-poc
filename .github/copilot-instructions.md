# copilot-instructions.md — Chat Portal

## Stack

- **PHP** / **Laravel** — backend
- **Inertia.js** (`inertiajs/inertia-laravel` + `@inertiajs/react`) — SPA bridge, no separate API
- **React** + **TypeScript** (strict mode) — frontend
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
    Controllers/        # thin controllers — no business logic
    Middleware/
      HandleInertiaRequests.php   # shared Inertia props live here
    Requests/           # Form Request classes for validation
  Models/               # Eloquent models
  Services/             # Services for external integrations (Ollama, etc.)
resources/
  js/
    pages/              # Inertia page components (map 1:1 to routes)
      chats/            # chat pages
    components/         # shared React components
    components/ui/      # shadcn/ui components
    types/              # shared TypeScript types
    layouts/            # layout components
    app.tsx             # Inertia bootstrap
  css/
    app.css             # Tailwind entry point
  views/
    app.blade.php       # single Blade root template
routes/
  web.php               # all routes (no api.php used)
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

### Non-navigating HTTP requests (useHttp)

When a component needs to call a backend endpoint **without** triggering an Inertia page visit (e.g. JSON APIs, setup flows, toggles), use `useHttp` from `@inertiajs/react`. Never use raw `fetch()` or `axios` directly.

`useHttp` provides reactive `data`, `errors`, `processing`, and `response` state — consistent with how `useForm` works but for non-navigating requests.

```tsx
import { useHttp } from '@inertiajs/react'

interface SetupResponse {
    secret: string
    qrCode: string
}

const form = useHttp<{ code: string }, SetupResponse>('post', '/portal/settings/mfa/confirm', { code: '' })

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    form.post('/portal/settings/mfa/confirm', {
        onSuccess: (response) => {
            // response is typed as SetupResponse
        },
    })
}
```

Prefer `useHttp` over `useForm` when:
- The endpoint returns JSON data you need to use (e.g. QR codes, tokens)
- The request should not trigger a page reload or Inertia visit
- You need access to the response body

Use `router.post()` / `useForm` when:
- The action should redirect or reload Inertia page props
- Standard form submissions with server-side validation via `usePage().props.errors`

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

Controller actions that accept user input or need request-specific authorization must receive a custom `FormRequest` as their first argument — never the base `Illuminate\Http\Request`. Form Requests live in `app/Http/Requests/`, are named `<Action>Request` (e.g. `LoginRequest`, `InviteUserRequest`), and own all validation rules so controllers stay free of inline `$request->validate([...])` calls. Read validated input with `$request->validated()`.

```php
// app/Http/Requests/InviteUserRequest.php
class InviteUserRequest extends FormRequest
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
            'voornaam' => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email'],
            'rechten'  => ['required', 'string', 'in:Beheerder,Gebruiker,Alleen lezen'],
        ];
    }
}
```

**Exception:** Actions that have no validation rules and no custom authorization logic (e.g. simple `index()` or `show()` methods) do not need a dedicated FormRequest. Omit the request parameter entirely for these actions.

### Routes

All routes are in `routes/web.php`. No `api.php` — Inertia handles everything over HTTP with session auth. Group protected routes under `middleware('auth')`:
Don't render components in web.php use controllers for this.

```php
Route::middleware('auth')->prefix('portal')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('portal.dashboard');
});
```

Name every route.

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
