const express = require('express');
const { REACTION_DEFINITIONS } = require('./debateConstants');
const {
    DebateValidationError,
    DebateUserNotFoundError,
    DebateNotFoundError
} = require('./debateService');

const toReactionsResponse = (reactions = {}, viewerId = null) => {
    return REACTION_DEFINITIONS.reduce((response, { key, label }) => {
        const users = Array.isArray(reactions[key]) ? reactions[key] : [];
        response[key] = {
            label,
            count: users.length,
            reactedByMe: Boolean(
                viewerId && users.some((userId) => String(userId) === String(viewerId))
            )
        };
        return response;
    }, {});
};

const getAuthorEmail = (debate, fallback = null) => {
    if (fallback) {
        return fallback;
    }

    const author = debate.authorId;
    if (author && typeof author === 'object' && typeof author.email === 'string') {
        return author.email;
    }

    return null;
};

const toDebateResponse = (debate, viewerId = null, authorEmail = null) => ({
    _id: debate._id,
    title: debate.title,
    content: debate.content,
    createdAt: debate.createdAt,
    authorEmail: getAuthorEmail(debate, authorEmail),
    reactions: toReactionsResponse(debate.reactions, viewerId)
});

const toReactionResponse = (debate, viewerId) => ({
    _id: debate._id,
    reactions: toReactionsResponse(debate.reactions, viewerId)
});

const respondWithError = (res, error, fallbackMessage) => {
    if (error instanceof DebateValidationError) {
        return res.status(400).json({ message: error.message });
    }
    if (error instanceof DebateUserNotFoundError) {
        return res.status(401).json({ message: error.message });
    }
    if (error instanceof DebateNotFoundError) {
        return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const createDebateRouter = ({ debateService, authMiddleware, adminMiddleware }) => {
    if (!debateService) {
        throw new Error('debateService es obligatorio');
    }
    if (typeof authMiddleware !== 'function') {
        throw new Error('authMiddleware es obligatorio');
    }
    if (typeof adminMiddleware !== 'function') {
        throw new Error('adminMiddleware es obligatorio');
    }

    const router = express.Router();

    const optionalAuthMiddleware = (req, res, next) => {
        if (!req.headers.authorization) {
            return next();
        }
        return authMiddleware(req, res, next);
    };

    router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const debate = await debateService.createDebate({
                email: req.user.email,
                title: req.body ? req.body.title : undefined,
                content: req.body ? req.body.content : undefined
            });

            return res.status(201).json(toDebateResponse(debate, null, req.user.email));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo crear el debate');
        }
    });

    router.get('/', optionalAuthMiddleware, async (req, res) => {
        try {
            const { debates, viewerId } = await debateService.listDebates({
                email: req.user ? req.user.email : undefined
            });

            return res.status(200).json(
                debates.map((debate) => toDebateResponse(debate, viewerId))
            );
        } catch (error) {
            return respondWithError(res, error, 'No se pudieron obtener los debates');
        }
    });

    router.post('/:id/react', authMiddleware, async (req, res) => {
        try {
            const { debate, viewerId } = await debateService.reactToDebate({
                email: req.user.email,
                id: req.params.id,
                reaction: req.body ? req.body.reaction : undefined
            });

            return res.status(200).json(toReactionResponse(debate, viewerId));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo registrar la reacción');
        }
    });

    return router;
};

module.exports = { createDebateRouter };
