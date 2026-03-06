const { randomUUID } = require('crypto');

function requestContext(req, res, next) {
    const incoming = req.header('x-request-id');
    const requestId = incoming && String(incoming).trim()
        ? String(incoming).trim()
        : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
}

module.exports = {
    requestContext,
};
