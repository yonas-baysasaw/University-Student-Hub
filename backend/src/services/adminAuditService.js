import SystemLog from '../models/SystemLog.js';

export const writeSystemLog = async (req, action, options = {}) => {
  try {
    await SystemLog.create({
      actor: req.user?._id,
      actorEmail: req.user?.email,
      action,
      entity: options.entity,
      entityId: options.entityId ? String(options.entityId) : undefined,
      status: options.status || 'success',
      ip: req.ip,
      userAgent: req.get?.('user-agent') || '',
      metadata: options.metadata || {},
    });
  } catch (error) {
    console.error('[admin-audit] failed to write system log', error);
  }
};

export const auditAdminAction = (action, getOptions = () => ({})) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode >= 400 ? 'failed' : 'success';
      Promise.resolve(getOptions(req, body))
        .then((options) =>
          writeSystemLog(req, action, {
            ...options,
            status,
          }),
        )
        .catch((error) =>
          console.error('[admin-audit] failed to resolve log options', error),
        );
      return originalJson(body);
    };
    return next();
  };
};
