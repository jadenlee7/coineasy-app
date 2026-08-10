/**
 * Express 4 does not forward rejected async handlers to error middleware.
 * Wrap every new async route so a database/provider rejection cannot become
 * an unhandled promise rejection and terminate the process.
 */
export function express4AsyncHandler(handler) {
  return function handleAsyncRoute(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default express4AsyncHandler;
