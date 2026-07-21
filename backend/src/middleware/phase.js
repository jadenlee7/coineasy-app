import { PHASE } from '../../utils/easygo.js';

export function requirePhase(phaseName, phaseConfig = PHASE) {
  return (_req, res, next) => {
    if (!phaseConfig[phaseName]) return res.status(404).json({ error: 'not_found' });
    return next();
  };
}
