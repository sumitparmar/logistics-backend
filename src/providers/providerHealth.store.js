/**
 * In-memory provider health registry
 */

const healthMap = {};

/**
 * Mark provider UP
 */
function markUp(name) {
  healthMap[name] = true;
}

/**
 * Mark provider DOWN
 */
function markDown(name) {
  healthMap[name] = false;
}

/**
 * Check if provider is UP
 */
function isUp(name) {
  return healthMap[name] === true;
}

/**
 * Get full snapshot (for debugging)
 */
function snapshot() {
  return { ...healthMap };
}

module.exports = {
  markUp,
  markDown,
  isUp,
  snapshot,
};
