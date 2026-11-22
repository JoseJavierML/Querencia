class HttpError extends Error {
    constructor(status, message, { code = 'HTTP_ERROR', cause } = {}) {
        super(message, { cause });
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
    }
}

module.exports = {
    HttpError
};
