function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

interface ApiOptions extends Omit<RequestInit, 'headers'> {
    headers?: Record<string, string>;
}

export async function api<T>(url: string, options: ApiOptions = {}): Promise<T> {
    const { headers = {}, ...rest } = options;

    const response = await fetch(url, {
        ...rest,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getCsrfToken(),
            ...headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.message ?? 'Er ging iets mis.', error);
    }

    return response.json();
}

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public data?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
