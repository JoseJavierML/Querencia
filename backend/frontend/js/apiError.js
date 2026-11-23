export class ApiError extends Error {
    constructor(status, message, code = 'API_ERROR') {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}
