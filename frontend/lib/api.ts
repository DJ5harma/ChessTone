const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000") + "/api";

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: object;
    headers?: Record<string, string>;
}

class ApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ApiError";
    }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const config: RequestInit = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...headers,
        },
        credentials: "include",
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "An error occurred" }));
        throw new ApiError(errorData.message || "An error occurred", response.status);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

export const Api = {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),

    post: <T>(endpoint: string, body: object) =>
        request<T>(endpoint, { method: "POST", body }),

    put: <T>(endpoint: string, body: object) =>
        request<T>(endpoint, { method: "PUT", body }),

    patch: <T>(endpoint: string, body: object) =>
        request<T>(endpoint, { method: "PATCH", body }),

    delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};

export { ApiError };